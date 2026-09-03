import { createHash, randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { adnClient } from "@/lib/fiscal/adn/client";
import { loadEncryptedCertificate, storeEncryptedDocument } from "@/lib/security/certificate-vault";
import { fiscalLogger } from "@/lib/logging";

export type NfseSyncResult = { companyId: string; status: "SUCCEEDED" | "FAILED" | "SKIPPED"; documentCount: number; message?: string };

export async function syncCompanyNfseById(companyId: string): Promise<NfseSyncResult> {
  fiscalLogger.info({ companyId }, "NFSe sync started");

  const company = await db.company.findUnique({ where: { id: companyId }, include: { certificate: true, cursors: true } });
  if (!company?.certificate) {
    fiscalLogger.warn({ companyId }, "Sync skipped - no certificate");
    return { companyId, status: "SKIPPED", documentCount: 0, message: "Empresa sem certificado A1." };
  }

  const isProduction = company.nfseEnvironment === "PRODUCTION";
  const source = isProduction ? "ADN_NFSE_PRODUCTION" : "ADN_NFSE_RESTRICTED";
  fiscalLogger.debug({ companyId, source, environment: isProduction ? "production" : "restricted" }, "Sync environment configured");

  const activeRun = await db.syncRun.findFirst({ where: { companyId, source, status: "RUNNING", startedAt: { gte: new Date(Date.now() - 15 * 60_000) } }, select: { id: true } });
  if (activeRun) {
    fiscalLogger.warn({ companyId, source }, "Sync already in progress");
    return { companyId, status: "SKIPPED", documentCount: 0, message: "Sincronização já está em andamento." };
  }
  const cursor = company.cursors.find((item) => item.source === source) ?? await db.syncCursor.create({ data: { companyId, source, lastNsu: 0 } });
  const run = await db.syncRun.create({ data: { companyId, source, status: "RUNNING", startNsu: cursor.lastNsu } });
  const storedKeys: string[] = [];
  try {
    const certificate = await loadEncryptedCertificate(company.certificate.secretKey);
    const result = await adnClient.fetchNfseBatch({ certificate, cnpj: company.cnpj, lastNsu: Number(cursor.lastNsu), environment: isProduction ? "production" : "restricted" });
    const nsus = result.documentos.map((document) => BigInt(document.nsu));
    const existing = nsus.length ? await db.fiscalDocument.findMany({ where: { companyId, source, nsu: { in: nsus } }, select: { nsu: true } }) : [];
    const existingNsus = new Set(existing.map((document) => document.nsu.toString()));
    const records: Prisma.FiscalDocumentCreateManyInput[] = [];
    for (const document of result.documentos) {
      if (existingNsus.has(String(document.nsu))) continue;
      const id = randomUUID();
      const xmlObjectKey = await storeEncryptedDocument({ id, xml: document.xmlDocumento });
      storedKeys.push(xmlObjectKey);
      records.push({ id, companyId, source, nsu: BigInt(document.nsu), kind: document.tipoDocumento === "EVENTO" ? "NFSE_EVENT" : "NFSE", accessKey: document.chaveAcesso || null, issuedAt: document.dataHoraGeracao, xmlObjectKey, xmlSha256: createHash("sha256").update(document.xmlDocumento).digest("hex"), rawMetadata: JSON.stringify({ tipoDocumento: document.tipoDocumento, tipoEvento: document.tipoEvento }) });
    }
    await db.$transaction(async (transaction) => {
      if (records.length) await transaction.fiscalDocument.createMany({ data: records });
      await transaction.syncCursor.update({ where: { id: cursor.id }, data: { lastNsu: BigInt(result.ultimoNsu), lastSyncAt: new Date() } });
      await transaction.syncRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", finishedAt: new Date(), endNsu: BigInt(result.ultimoNsu), documentCount: records.length } });
    });

    fiscalLogger.info({ companyId, documentCount: records.length, lastNsu: result.ultimoNsu }, "NFSe sync completed successfully");
    return { companyId, status: "SUCCEEDED", documentCount: records.length };
  } catch (error) {
    await Promise.all(storedKeys.map((key) => unlink(path.join(process.cwd(), ".vault", key)).catch(() => undefined)));
    const message = error instanceof Error ? error.message : "Erro desconhecido na sincronização.";
    fiscalLogger.error({ companyId, error, message }, "NFSe sync failed");
    await db.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), errorMessage: message.slice(0, 1000) } });
    return { companyId, status: "FAILED", documentCount: 0, message };
  }
}
