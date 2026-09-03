import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { manifestDocument, manifestDocumentsBatch } from "../src/app/actions";
import { db } from "../src/lib/db";
import { sendSefazManifestation } from "../src/lib/fiscal/sefaz/manifestation";
import { authSession } from "../src/lib/auth/session";
import { storeEncryptedDocument } from "../src/lib/security/certificate-vault";

test("manifestação do destinatário, validação de justificativa e evento SEFAZ", async (t) => {
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const testCnpj = `99555${Math.floor(10000000 + Math.random() * 89999999).toString()}`;
  const org = await db.organization.create({ data: { name: "Test Org Manifestation" } });
  const user = await db.user.create({
    data: { name: "User Manifest Test", email: `user-manifest-${testCnpj}@example.com`, passwordHash: "dummy-hash" },
  });

  const company = await db.company.create({
    data: {
      organizationId: org.id,
      legalName: "Empresa Manifestação LTDA",
      cnpj: testCnpj,
      status: "READY",
    },
  });

  const xmlSample = `<resNFe xmlns="http://www.portalfiscal.inf.br/nfe"><chNFe>35240899555111000188550010000000011000000011</chNFe></resNFe>`;
  const docId = randomUUID();
  const xmlObjectKey = await storeEncryptedDocument({ id: docId, xml: xmlSample });

  const docRecord = await db.fiscalDocument.create({
    data: {
      id: docId,
      companyId: company.id,
      source: "SEFAZ_NFE_RESTRICTED",
      nsu: BigInt(200),
      kind: "NFE",
      accessKey: "35240899555111000188550010000000011000000011",
      issuerTaxId: "11222333000144",
      recipientTaxId: testCnpj,
      totalAmount: 300.00,
      xmlObjectKey,
      xmlSha256: "sha-manifest-test",
      manifestationStatus: "PENDING",
      rawMetadata: JSON.stringify({ isSummary: true }),
    },
  });

  const mockSession = async () => ({
    id: "session-manifest-id",
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      memberships: [{ organizationId: org.id, userId: user.id, role: "ADMIN" as const }],
    },
  });

  t.mock.method(authSession, "requireFiscalOperator", mockSession);
  t.mock.method(authSession, "getSession", mockSession);
  t.mock.method(authSession, "requireApiSession", mockSession);

  try {
    // 1. Testar envio direto SEFAZ e rejeicao de justificativa curta
    await assert.rejects(
      async () => {
        await sendSefazManifestation({
          companyCnpj: company.cnpj,
          accessKey: docRecord.accessKey!,
          eventType: "NOT_PERFORMED",
          justification: "Curta", // < 15 caracteres
        });
      },
      /A justificativa para Operação não Realizada deve conter entre 15 e 255 caracteres/
    );

    const sefazOk = await sendSefazManifestation({
      companyCnpj: company.cnpj,
      accessKey: docRecord.accessKey!,
      eventType: "SCIENCE",
    });
    assert.equal(sefazOk.ok, true);
    assert.equal(sefazOk.sefazStat, 135);
    assert.ok(sefazOk.protocolNumber.length > 5);

    // 2. Testar Server Action manifestDocument (Ciência da Operação)
    const formData = new FormData();
    formData.append("documentId", docRecord.id);
    formData.append("eventType", "SCIENCE");

    const resultAction = await manifestDocument(formData);
    assert.equal(resultAction.ok, true);
    assert.equal(resultAction.status, "SCIENCE");
    assert.ok(resultAction.protocol);

    const updatedDoc = await db.fiscalDocument.findUnique({ where: { id: docRecord.id } });
    assert.equal(updatedDoc?.manifestationStatus, "SCIENCE");
    assert.ok(updatedDoc?.manifestedAt);

    const auditEntry = await db.auditEntry.findFirst({
      where: { action: "DOCUMENT_MANIFESTATION", entityId: docRecord.id },
    });
    assert.ok(auditEntry);

    // 3. Testar Server Action manifestDocumentsBatch (Manifestação em Lote)
    const batchFormData = new FormData();
    batchFormData.append("documentIds", docRecord.id);
    batchFormData.append("eventType", "CONFIRMED");

    const batchResult = await manifestDocumentsBatch(batchFormData);
    assert.equal(batchResult.ok, true);
    assert.equal(batchResult.successCount, 1);

    const updatedBatchDoc = await db.fiscalDocument.findUnique({ where: { id: docRecord.id } });
    assert.equal(updatedBatchDoc?.manifestationStatus, "CONFIRMED");

  } finally {
    await db.auditEntry.deleteMany({ where: { organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined);
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await rm(path.join(process.cwd(), ".vault", xmlObjectKey), { force: true });

    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});
