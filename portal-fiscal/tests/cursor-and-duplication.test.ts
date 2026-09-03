import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../src/lib/db";

test("Garantia de cursor NSU e prevenção de duplicidade de documentos", async () => {
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const org = await db.organization.create({
    data: { name: "Org Teste Cursor" },
  });

  try {
    const company = await db.company.create({
      data: {
        organizationId: org.id,
        legalName: "Empresa Teste Cursor Ltda",
        cnpj: `88777${Math.floor(10000000 + Math.random() * 89999999).toString()}`,
        status: "READY",
        nfseEnvironment: "RESTRICTED",
        certificate: {
          create: {
            secretProvider: "LOCAL_ENCRYPTED_VAULT",
            secretKey: "certificates/test-mock.a1.enc",
            fingerprint: createHash("sha256").update(randomUUID()).digest("hex"),
            subject: "CNPJ 88777000000000",
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 365 * 86400_000),
          },
        },
      },
    });

    const nsu1 = BigInt(100);
    const nsu2 = BigInt(101);

    await db.fiscalDocument.createMany({
      data: [
        {
          id: randomUUID(),
          companyId: company.id,
          source: "ADN_NFSE_RESTRICTED",
          nsu: nsu1,
          kind: "NFSE",
          accessKey: "35260811222333000199000000000000000000000001",
          xmlObjectKey: "documents/test-xml-key-1.xml.enc",
          xmlSha256: "sha256-mock-1",
        },
        {
          id: randomUUID(),
          companyId: company.id,
          source: "ADN_NFSE_RESTRICTED",
          nsu: nsu2,
          kind: "NFSE",
          accessKey: "35260811222333000199000000000000000000000002",
          xmlObjectKey: "documents/test-xml-key-2.xml.enc",
          xmlSha256: "sha256-mock-2",
        },
      ],
    });

    await db.syncCursor.create({
      data: {
        companyId: company.id,
        source: "ADN_NFSE_RESTRICTED",
        lastNsu: nsu2,
        lastSyncAt: new Date(),
      },
    });

    const initialDocs = await db.fiscalDocument.count({
      where: { companyId: company.id },
    });
    assert.equal(initialDocs, 2, "Deveria ter exatamente 2 documentos no banco inicialmente.");

    try {
      await db.fiscalDocument.create({
        data: {
          id: randomUUID(),
          companyId: company.id,
          source: "ADN_NFSE_RESTRICTED",
          nsu: nsu1,
          kind: "NFSE",
          xmlObjectKey: "documents/test-xml-key-dup.xml.enc",
          xmlSha256: "sha256-mock-dup",
        },
      });
      assert.fail("Deveria ter lançado erro de chave única ao duplicar NSU.");
    } catch (error: any) {
      assert.match(error.message, /Unique constraint|unique/i, "A restrição única de NSU deve impedir duplicatas.");
    }

    const cursorAfter = await db.syncCursor.findUnique({
      where: { companyId_source: { companyId: company.id, source: "ADN_NFSE_RESTRICTED" } },
    });
    assert.equal(cursorAfter?.lastNsu, nsu2, "O cursor deve se manter no maior NSU processado.");

  } finally {
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined);
    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});
