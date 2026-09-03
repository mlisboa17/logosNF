import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { db } from "../src/lib/db";
import { sefazClient } from "../src/lib/fiscal/sefaz/client";
import { syncCompanyNfeById } from "../src/lib/fiscal/sync-nfe";
import { storeEncryptedCertificate } from "../src/lib/security/certificate-vault";

test("sincronizacao de NF-e (SEFAZ), transicao de resumo para completo e controle de duplicados", async (t) => {
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const testCnpj = `99888${Math.floor(10000000 + Math.random() * 89999999).toString()}`;
  await db.company.deleteMany({ where: { cnpj: testCnpj } });

  const org = await db.organization.create({ data: { name: "Test Org SEFAZ" } });
  const company = await db.company.create({
    data: {
      organizationId: org.id,
      legalName: "Empresa Teste SEFAZ LTDA",
      cnpj: testCnpj,
      status: "READY",
      nfseEnvironment: "RESTRICTED",
    },
  });

  const certId = randomUUID();
  const dummyPfx = Buffer.from("dummy-pfx-sefaz");
  const secretKey = await storeEncryptedCertificate({ id: certId, pfx: dummyPfx, password: "secret-password" });

  await db.certificateRef.create({
    data: {
      companyId: company.id,
      secretProvider: "VAULT_AES_256_GCM",
      secretKey,
      fingerprint: `fingerprint-sefaz-${testCnpj}`,
      subject: `CNPJ=${testCnpj}`,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 86400000),
    },
  });

  const accessKey1 = "35240899888777000166550010000001011000000101";

  // Mock do lote 1: Retorna 1 Resumo de NF-e (resNFe) no NSU 10
  t.mock.method(sefazClient, "fetchNfeBatch", async () => ({
    cStat: "138",
    xMotiv: "Documentos localizados",
    ultimoNsu: "10",
    maxNsu: "10",
    documentos: [
      {
        nsu: "10",
        schema: "resNFe" as const,
        accessKey: accessKey1,
        cnpjIssuer: "11222333000144",
        cnpjRecipient: "99888777000166",
        issuedAt: new Date("2026-08-08T10:00:00Z"),
        totalAmount: 1500.50,
        xmlDocument: `<resNFe><chNFe>${accessKey1}</chNFe><vNF>1500.50</vNF></resNFe>`,
        isSummary: true,
      },
    ],
  }));

  let storedFiles: string[] = [];

  try {
    // 1. Primeira sincronizacao: insere o resumo
    const res1 = await syncCompanyNfeById(company.id);
    assert.equal(res1.status, "SUCCEEDED");
    assert.equal(res1.documentCount, 1);

    const docSummary = await db.fiscalDocument.findFirst({
      where: { companyId: company.id, accessKey: accessKey1 },
    });
    assert.ok(docSummary);
    assert.equal(docSummary.kind, "NFE");
    assert.equal(Number(docSummary.nsu), 10);
    const metaSummary = docSummary.rawMetadata as { isSummary?: boolean };
    assert.equal(metaSummary.isSummary, true);
    storedFiles.push(docSummary.xmlObjectKey);

    // 2. Segunda sincronizacao: SEFAZ entrega o procNFe (XML Completo) da mesma nota no NSU 15
    t.mock.method(sefazClient, "fetchNfeBatch", async () => ({
      cStat: "138",
      xMotiv: "Documentos localizados",
      ultimoNsu: "15",
      maxNsu: "15",
      documentos: [
        {
          nsu: "15",
          schema: "procNFe" as const,
          accessKey: accessKey1,
          cnpjIssuer: "11222333000144",
          cnpjRecipient: "99888777000166",
          issuedAt: new Date("2026-08-08T10:00:00Z"),
          totalAmount: 1500.50,
          xmlDocument: `<nfeProc><NFe><infNFeId="${accessKey1}">Conteudo Completo XML</infNFeId></NFe></nfeProc>`,
          isSummary: false,
        },
      ],
    }));

    const res2 = await syncCompanyNfeById(company.id);
    assert.equal(res2.status, "SUCCEEDED");

    // Confirma que nao duplicou a nota e atualizou para isSummary = false
    const docsCount = await db.fiscalDocument.count({
      where: { companyId: company.id, kind: "NFE" },
    });
    assert.equal(docsCount, 1);

    const docFull = await db.fiscalDocument.findFirst({
      where: { companyId: company.id, accessKey: accessKey1 },
    });
    assert.ok(docFull);
    const metaFull = docFull.rawMetadata as { isSummary?: boolean };
    assert.equal(metaFull.isSummary, false);
    storedFiles.push(docFull.xmlObjectKey);

    // 3. Checa atualizacao do cursor para NSU 15
    const cursor = await db.syncCursor.findUnique({
      where: { companyId_source: { companyId: company.id, source: "SEFAZ_NFE_RESTRICTED" } },
    });
    assert.equal(Number(cursor?.lastNsu), 15);

    // 4. Terceira sincronizacao com simulacao de cStat 656 (Consumo Indevido)
    t.mock.method(sefazClient, "fetchNfeBatch", async () => ({
      cStat: "656",
      xMotiv: "Rejeição: Consumo Indevido",
      ultimoNsu: "15",
      maxNsu: "15",
      documentos: [],
    }));

    const res3 = await syncCompanyNfeById(company.id);
    assert.equal(res3.status, "RATE_LIMITED");

  } finally {
    // Limpeza
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined);
    await rm(path.join(process.cwd(), ".vault", secretKey), { force: true });
    for (const key of storedFiles) {
      await rm(path.join(process.cwd(), ".vault", key), { force: true });
    }

    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});
