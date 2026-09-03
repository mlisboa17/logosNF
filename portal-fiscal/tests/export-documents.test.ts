import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { authSession } from "../src/lib/auth/session.ts";
import { storeEncryptedDocument } from "../src/lib/security/certificate-vault.ts";
import { POST as exportPost } from "../src/app/api/documents/export/route.ts";
import { GET as archiveGet } from "../src/app/api/companies/[id]/documents/archive/route.ts";
import { rm } from "node:fs/promises";
import path from "node:path";

test("exportacao e download de lote e arquivo de documentos", async (t) => {
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "8f".repeat(32);

  // 1. Criação dos dados de teste
  const org = await db.organization.create({
    data: { name: "Test Org Export" },
  });

  const user = await db.user.create({
    data: {
      name: "Test User Export",
      email: "test-export@example.com",
      passwordHash: "dummy-hash",
    },
  });

  const company = await db.company.create({
    data: {
      organizationId: org.id,
      legalName: "Empresa Teste Export",
      cnpj: "98765432000100",
      status: "READY",
    },
  });

  const docId1 = "export-doc-1";
  const docId2 = "export-doc-2";

  // XMLs válidos da NFS-e (o parseNfseXml da open-nfse exige alguns campos mínimos dependendo da validação)
  // Vamos usar um XML de NFS-e simples
  const xmlContent1 = `<NFS-e><infNFSe><chNFSe>35260898765432000100550010000000000000000001</chNFSe><nNFSe>1</nNFSe><dEmi>2026-08-01</dEmi></infNFSe></NFS-e>`;
  const xmlContent2 = `<NFS-e><infNFSe><chNFSe>35260898765432000100550010000000000000000002</chNFSe><nNFSe>2</nNFSe><dEmi>2026-08-02</dEmi></infNFSe></NFS-e>`;

  const xmlObjectKey1 = await storeEncryptedDocument({ id: docId1, xml: xmlContent1 });
  const xmlObjectKey2 = await storeEncryptedDocument({ id: docId2, xml: xmlContent2 });

  await db.fiscalDocument.createMany({
    data: [
      {
        id: docId1,
        companyId: company.id,
        kind: "NFSE",
        source: "ADN_NFSE_RESTRICTED",
        nsu: 100n,
        accessKey: "35260898765432000100550010000000000000000001",
        xmlObjectKey: xmlObjectKey1,
        xmlSha256: "dummy-sha-1",
      },
      {
        id: docId2,
        companyId: company.id,
        kind: "NFSE",
        source: "ADN_NFSE_RESTRICTED",
        nsu: 101n,
        accessKey: "35260898765432000100550010000000000000000002",
        xmlObjectKey: xmlObjectKey2,
        xmlSha256: "dummy-sha-2",
      },
    ],
  });

  // Mock de requireApiSession e getSession usando o usuário real criado no banco
  const mockSession = async () => {
    return {
      id: "test-session-id",
      userId: user.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        memberships: [
          {
            organizationId: org.id,
            userId: user.id,
            role: "ADMIN",
          },
        ],
      },
    };
  };

  t.mock.method(authSession, "requireApiSession", mockSession);
  t.mock.method(authSession, "getSession", mockSession);

  try {
    // 2. Testar POST /api/documents/export para formato xml_zip
    const request = new Request("http://localhost/api/documents/export", {
      method: "POST",
      body: JSON.stringify({
        ids: [docId1, docId2],
        format: "xml_zip",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await exportPost(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Disposition")?.includes(".zip"), true);

    // Verifica se lastDownloadedAt foi atualizado no banco
    const updatedDocs = await db.fiscalDocument.findMany({
      where: { id: { in: [docId1, docId2] } },
      select: { lastDownloadedAt: true },
    });
    assert.ok(updatedDocs[0].lastDownloadedAt);
    assert.ok(updatedDocs[1].lastDownloadedAt);

    // 3. Testar GET /api/companies/[id]/documents/archive
    const archiveParams = Promise.resolve({ id: company.id });
    const archiveResponse = await archiveGet(
      new Request(`http://localhost/api/companies/${company.id}/documents/archive`),
      { params: archiveParams }
    );
    assert.equal(archiveResponse.status, 200);
    assert.equal(archiveResponse.headers.get("Content-Disposition")?.includes(".zip"), true);

  } finally {
    // Limpeza
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined); // Cascades to company, docs...
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await rm(path.join(process.cwd(), ".vault", xmlObjectKey1), { force: true });
    await rm(path.join(process.cwd(), ".vault", xmlObjectKey2), { force: true });

    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});
