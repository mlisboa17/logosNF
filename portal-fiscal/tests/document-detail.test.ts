import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as getDocumentDetails } from "../src/app/api/documents/[id]/details/route";
import { db } from "../src/lib/db";
import { parseDocumentDetails } from "../src/lib/fiscal/details-parser";
import { authSession } from "../src/lib/auth/session";
import { storeEncryptedDocument } from "../src/lib/security/certificate-vault";

test("parser de detalhes fiscais e rota /api/documents/[id]/details com auditoria", async (t) => {
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const testCnpj = `99888${Math.floor(10000000 + Math.random() * 89999999).toString()}`;
  const org = await db.organization.create({ data: { name: "Test Org Detail" } });
  const user = await db.user.create({
    data: { name: "User Detail Test", email: `user-detail-${testCnpj}@example.com`, passwordHash: "dummy-hash" },
  });

  const company = await db.company.create({
    data: {
      organizationId: org.id,
      legalName: "Empresa Detail Teste LTDA",
      cnpj: testCnpj,
      status: "READY",
    },
  });

  const xmlSample = `
    <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
      <NFe>
        <infNFe Id="NFe35240899888777000166550010000001011000000101">
          <ide><nNF>101</nNF><serie>1</serie><dhEmi>2026-08-08T14:30:00Z</dhEmi></ide>
          <emit><CNPJ>11222333000144</CNPJ><xNome>Fornecedor de Alimentos SA</xNome><IE>123456789</IE><enderEmit><UF>SP</UF></enderEmit></emit>
          <dest><CNPJ>${testCnpj}</CNPJ><xNome>Empresa Detail Teste LTDA</xNome><IE>987654321</IE><enderDest><UF>SP</UF></enderDest></dest>
          <det n="1">
            <prod><cProd>PROD-001</cProd><xProd>Caixa de Leite Integral 1L</xProd><NCM>04012010</NCM><qCom>10</qCom><vUnCom>4.50</vUnCom><vProd>45.00</vProd></prod>
            <imposto><vICMS>8.10</vICMS><vPIS>0.74</vPIS><vCOFINS>3.42</vCOFINS></imposto>
          </det>
          <total><ICMSTot><vProd>45.00</vProd><vNF>45.00</vNF><vICMS>8.10</vICMS><vPIS>0.74</vPIS><vCOFINS>3.42</vCOFINS></ICMSTot></total>
        </infNFe>
      </NFe>
    </nfeProc>
  `;

  const docId = randomUUID();
  const xmlObjectKey = await storeEncryptedDocument({ id: docId, xml: xmlSample });

  const docRecord = await db.fiscalDocument.create({
    data: {
      id: docId,
      companyId: company.id,
      source: "SEFAZ_NFE_RESTRICTED",
      nsu: BigInt(50),
      kind: "NFE",
      accessKey: "35240899888777000166550010000001011000000101",
      issuerTaxId: "11222333000144",
      recipientTaxId: testCnpj,
      totalAmount: 45.00,
      xmlObjectKey,
      xmlSha256: "dummy-sha-detail",
      rawMetadata: JSON.stringify({ isSummary: false }),
    },
  });

  const mockSession = async () => ({
    id: "session-detail-id",
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

  try {
    // 1. Testar parser direto de detalhes
    const details = parseDocumentDetails(xmlSample, "NFE", { isSummary: false });
    assert.equal(details.issuer.name, "Fornecedor de Alimentos SA");
    assert.equal(details.issuer.taxId, "11222333000144");
    assert.equal(details.items.length, 1);
    assert.equal(details.items[0].code, "PROD-001");
    assert.equal(details.items[0].totalValue, 45.00);
    assert.equal(details.taxes.icmsTotal, 8.10);
    assert.equal(details.taxes.ibsEstimate, 0.00); // Placeholder IBS da Reforma
    assert.equal(details.taxes.cbsEstimate, 0.00); // Placeholder CBS da Reforma

    // 2. Testar rota GET de detalhes
    const params = Promise.resolve({ id: docRecord.id });
    const response = await getDocumentDetails(
      new Request(`http://localhost/api/documents/${docRecord.id}/details`),
      { params }
    );

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.documentId, docRecord.id);
    assert.equal(json.companyName, "Empresa Detail Teste LTDA");
    assert.equal(json.details.issuer.name, "Fornecedor de Alimentos SA");

    // 3. Testar se gravou o log de auditoria DOCUMENT_VIEW_DETAILS
    const audit = await db.auditEntry.findFirst({
      where: { action: "DOCUMENT_VIEW_DETAILS", entityId: docRecord.id },
    });
    assert.ok(audit);
    assert.equal(audit.userId, user.id);

  } finally {
    // Limpeza
    await db.auditEntry.deleteMany({ where: { organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined);
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await rm(path.join(process.cwd(), ".vault", xmlObjectKey), { force: true });

    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});
