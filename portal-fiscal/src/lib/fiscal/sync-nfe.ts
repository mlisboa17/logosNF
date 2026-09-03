import { createHash, randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sefazClient } from "@/lib/fiscal/sefaz/client";
import { loadEncryptedCertificate, storeEncryptedDocument } from "@/lib/security/certificate-vault";
import { logAuditEntry } from "@/lib/auth/session";

export type NfeSyncResult = {
  companyId: string;
  status: "SUCCEEDED" | "FAILED" | "SKIPPED" | "RATE_LIMITED";
  documentCount: number;
  message?: string;
};

export async function syncCompanyNfeById(companyId: string): Promise<NfeSyncResult> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: { certificate: true, cursors: true },
  });

  if (!company?.certificate) {
    return { companyId, status: "SKIPPED", documentCount: 0, message: "Empresa sem certificado A1." };
  }

  const isProduction = company.nfseEnvironment === "PRODUCTION";
  const source = isProduction ? "SEFAZ_NFE_PRODUCTION" : "SEFAZ_NFE_RESTRICTED";

  const activeRun = await db.syncRun.findFirst({
    where: { companyId, source, status: "RUNNING", startedAt: { gte: new Date(Date.now() - 15 * 60_000) } },
    select: { id: true },
  });

  if (activeRun) {
    return { companyId, status: "SKIPPED", documentCount: 0, message: "Sincronização NF-e já está em andamento." };
  }

  const cursor = company.cursors.find((item) => item.source === source) ??
    await db.syncCursor.create({ data: { companyId, source, lastNsu: 0 } });

  const run = await db.syncRun.create({
    data: { companyId, source, status: "RUNNING", startNsu: cursor.lastNsu },
  });

  const storedKeys: string[] = [];

  try {
    const certificate = await loadEncryptedCertificate(company.certificate.secretKey);
    const result = await sefazClient.fetchNfeBatch({
      certificate,
      cnpj: company.cnpj,
      lastNsu: Number(cursor.lastNsu),
      environment: isProduction ? "production" : "restricted",
    });

    if (result.cStat === "656") {
      await db.syncRun.update({
        where: { id: run.id },
        data: {
          status: "RATE_LIMITED",
          finishedAt: new Date(),
          errorCode: "656",
          errorMessage: result.xMotiv,
        },
      });

      await logAuditEntry({
        action: "SEFAZ_NFE_SYNC_RATE_LIMITED",
        entityType: "COMPANY",
        entityId: companyId,
        organizationId: company.organizationId,
        metadata: { cStat: "656", message: result.xMotiv },
      });

      return {
        companyId,
        status: "RATE_LIMITED",
        documentCount: 0,
        message: result.xMotiv,
      };
    }

    const newRecords: Prisma.FiscalDocumentCreateManyInput[] = [];
    const updatedCount = { count: 0 };

    for (const document of result.documentos) {
      const id = randomUUID();
      const xmlObjectKey = await storeEncryptedDocument({ id, xml: document.xmlDocument });
      storedKeys.push(xmlObjectKey);
      const xmlSha256 = createHash("sha256").update(document.xmlDocument).digest("hex");

      const isEvent = document.schema === "resEvento" || document.schema === "procEventoNFe";
      const kind = isEvent ? "NFE_EVENT" : "NFE";

      // Checa se ja existe por chave de acesso para atualização de Resumo -> XML Completo
      if (document.accessKey && !document.isSummary) {
        const existingSummary = await db.fiscalDocument.findFirst({
          where: { companyId, accessKey: document.accessKey, kind: "NFE" },
        });

        if (existingSummary) {
          const oldMeta = existingSummary.rawMetadata ? (typeof existingSummary.rawMetadata === 'string' ? JSON.parse(existingSummary.rawMetadata) : existingSummary.rawMetadata) as Record<string, any> : {};
          await db.fiscalDocument.update({
            where: { id: existingSummary.id },
            data: {
              xmlObjectKey,
              xmlSha256,
              rawMetadata: JSON.stringify({ ...oldMeta, isSummary: false, schema: document.schema }),
            },
          });
          updatedCount.count++;
          continue;
        }
      }

      // Checa duplicado por NSU
      const existing = await db.fiscalDocument.findUnique({
        where: { companyId_source_nsu: { companyId, source, nsu: BigInt(document.nsu) } },
      });

      if (existing) continue;

      newRecords.push({
        id,
        companyId,
        source,
        nsu: BigInt(document.nsu),
        kind,
        accessKey: document.accessKey || null,
        issuerTaxId: document.cnpjIssuer || null,
        recipientTaxId: document.cnpjRecipient || null,
        issuedAt: document.issuedAt || new Date(),
        totalAmount: document.totalAmount != null ? document.totalAmount : null,
        xmlObjectKey,
        xmlSha256,
        manifestationStatus: kind === "NFE" ? "PENDING" : "NOT_APPLICABLE",
        rawMetadata: JSON.stringify({
          isSummary: document.isSummary,
          schema: document.schema,
          cnpjIssuer: document.cnpjIssuer,
          cnpjRecipient: document.cnpjRecipient,
        }),
      });
    }

    const nextNsu = BigInt(result.ultimoNsu);

    await db.$transaction(async (transaction) => {
      if (newRecords.length) {
        await transaction.fiscalDocument.createMany({ data: newRecords });
      }
      await transaction.syncCursor.update({
        where: { id: cursor.id },
        data: { lastNsu: nextNsu, lastSyncAt: new Date() },
      });
      await transaction.syncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          finishedAt: new Date(),
          endNsu: nextNsu,
          documentCount: newRecords.length + updatedCount.count,
        },
      });
    });

    await logAuditEntry({
      action: "SEFAZ_NFE_SYNC_SUCCEEDED",
      entityType: "COMPANY",
      entityId: companyId,
      organizationId: company.organizationId,
      metadata: { lastNsu: nextNsu.toString(), documentsAdded: newRecords.length + updatedCount.count },
    });

    return { companyId, status: "SUCCEEDED", documentCount: newRecords.length + updatedCount.count };
  } catch (error) {
    await Promise.all(storedKeys.map((key) => unlink(path.join(process.cwd(), ".vault", key)).catch(() => undefined)));
    const message = error instanceof Error ? error.message : "Erro desconhecido na sincronização de NF-e.";
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message.slice(0, 1000) },
    });
    return { companyId, status: "FAILED", documentCount: 0, message };
  }
}
