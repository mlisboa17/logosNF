import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { POST as exportCsv } from "../src/app/api/documents/export/csv/route";
import { GET as monthlyClosing } from "../src/app/api/companies/[id]/closing/route";
import { updateDocumentMetadata } from "../src/app/actions";
import { db } from "../src/lib/db";
import { authSession } from "../src/lib/auth/session";
import { storeEncryptedDocument } from "../src/lib/security/certificate-vault";

test("fechamento mensal, exportação CSV e mutação de etiquetas/notas internas", async (t) => {
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const testCnpj = `99777${Math.floor(10000000 + Math.random() * 89999999).toString()}`;
  const org = await db.organization.create({ data: { name: "Test Org Closing" } });
  const user = await db.user.create({
    data: { name: "User Closing Test", email: `user-closing-${testCnpj}@example.com`, passwordHash: "dummy-hash" },
  });

  const company = await db.company.create({
    data: {
      organizationId: org.id,
      legalName: "Empresa Fechamento LTDA",
      cnpj: testCnpj,
      status: "READY",
    },
  });

  const xmlSample = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe35240899777"><ide><nNF>1</nNF></ide></infNFe></NFe></nfeProc>`;
  const docId = randomUUID();
  const xmlObjectKey = await storeEncryptedDocument({ id: docId, xml: xmlSample });

  const docRecord = await db.fiscalDocument.create({
    data: {
      id: docId,
      companyId: company.id,
      source: "SEFAZ_NFE_RESTRICTED",
      nsu: BigInt(100),
      kind: "NFE",
      accessKey: "35240899777111000188550010000000011000000011",
      issuerTaxId: "11222333000144",
      recipientTaxId: testCnpj,
      totalAmount: 150.00,
      issuedAt: new Date("2026-08-10T10:00:00Z"),
      xmlObjectKey,
      xmlSha256: "sha-closing-test",
      rawMetadata: JSON.stringify({ isSummary: true }), // Notação de nota incompleta para gerar relatório de pendências
    },
  });

  const mockSession = async () => ({
    id: "session-closing-id",
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      memberships: [{ organizationId: org.id, userId: user.id, role: "ADMIN" as const }],
    },
  });

  t.mock.method(authSession, "requireApiSession", mockSession);
  t.mock.method(authSession, "getSession", mockSession);
  t.mock.method(authSession, "requireFiscalOperator", mockSession);

  try {
    // 1. Testar Rota de Exportação CSV
    const csvReq = new Request("http://localhost/api/documents/export/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [docRecord.id] }),
    });

    const csvRes = await exportCsv(csvReq);
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes("Chave de Acesso;NSU;Tipo"));
    assert.ok(csvText.includes(docRecord.accessKey));

    const auditCsv = await db.auditEntry.findFirst({
      where: { action: "DOCUMENT_EXPORT_CSV", userId: user.id },
    });
    assert.ok(auditCsv);

    // 2. Testar Fechamento Mensal por Competência (ZIP)
    const closingReq = new Request(`http://localhost/api/companies/${company.id}/closing?period=2026-08`);
    const closingParams = Promise.resolve({ id: company.id });
    const closingRes = await monthlyClosing(closingReq, { params: closingParams });

    assert.equal(closingRes.status, 200);
    const zipBuffer = Buffer.from(await closingRes.arrayBuffer());
    const zip = await JSZip.loadAsync(zipBuffer);

    // Verificar se o arquivo ZIP possui a pasta da empresa, o resumo CSV e o relatório de pendências
    const csvFiles = zip.file(/resumo_fechamento_competencia\.csv$/);
    const pendenciesFiles = zip.file(/relatorio_pendencias\.txt$/);

    assert.ok(csvFiles.length > 0, "Resumo CSV de fechamento deve estar no ZIP");
    assert.ok(pendenciesFiles.length > 0, "Relatório de pendências deve existir pois a nota é resumo");

    const pendenciesText = await pendenciesFiles[0].async("text");
    assert.ok(pendenciesText.includes("RELATÓRIO DE PENDÊNCIAS DE FECHAMENTO FISCAL"));

    const auditClosing = await db.auditEntry.findFirst({
      where: { action: "COMPANY_MONTHLY_CLOSING", entityId: company.id },
    });
    assert.ok(auditClosing);

    // 3. Testar Server Action updateDocumentMetadata
    const formData = new FormData();
    formData.append("documentId", docRecord.id);
    formData.append("tags", "Urgente, Conferido, Fechamento2026");
    formData.append("assignedTo", "Contador Responsavel");
    formData.append("internalComment", "Nota conferida no fechamento de agosto.");

    await updateDocumentMetadata(formData);

    const updatedDoc = await db.fiscalDocument.findUnique({ where: { id: docRecord.id } });
    const meta = updatedDoc?.rawMetadata ? (typeof updatedDoc.rawMetadata === 'string' ? JSON.parse(updatedDoc.rawMetadata) : updatedDoc.rawMetadata) as Record<string, any> : {};

    assert.deepEqual(meta.tags, ["Urgente", "Conferido", "Fechamento2026"]);
    assert.equal(meta.assignedTo, "Contador Responsavel");
    assert.equal(meta.internalComment, "Nota conferida no fechamento de agosto.");

    const auditMeta = await db.auditEntry.findFirst({
      where: { action: "DOCUMENT_METADATA_UPDATE", entityId: docRecord.id },
    });
    assert.ok(auditMeta);

  } finally {
    await db.auditEntry.deleteMany({ where: { organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined);
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await rm(path.join(process.cwd(), ".vault", xmlObjectKey), { force: true });

    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});
