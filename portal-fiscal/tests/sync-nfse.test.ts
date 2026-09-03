import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { adnClient } from "../src/lib/fiscal/adn/client.ts";
import { syncCompanyNfseById } from "../src/lib/fiscal/sync-nfse.ts";
import { storeEncryptedCertificate } from "../src/lib/security/certificate-vault.ts";
import { rm } from "node:fs/promises";
import path from "node:path";

test("sincronizacao de NFS-e incrementa cursor e evita duplicados", async (t) => {
  // Configura a chave do cofre para o teste
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "8f".repeat(32);

  // Criação dos dados de teste no banco
  const org = await db.organization.create({
    data: { name: "Test Org Sync" },
  });

  const secretKey = await storeEncryptedCertificate({
    id: "sync-test-cert-id",
    pfx: Buffer.from("mock-pfx"),
    password: "mock-password",
  });

  const company = await db.company.create({
    data: {
      organizationId: org.id,
      legalName: "Empresa Teste Sync",
      cnpj: "12345678000195",
      status: "READY",
      nfseEnvironment: "RESTRICTED",
      certificate: {
        create: {
          secretProvider: "LOCAL_ENCRYPTED_VAULT",
          secretKey,
          fingerprint: "sync-test-fingerprint",
          subject: "CN=Empresa Teste Sync:12345678000195",
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
        },
      },
      cursors: {
        create: {
          source: "ADN_NFSE_RESTRICTED",
          lastNsu: 0,
        },
      },
    },
  });

  // Mock do adnClient.fetchNfseBatch para retornar 2 notas fiscais simuladas
  t.mock.method(adnClient, "fetchNfseBatch", async (input: any) => {
    assert.equal(input.cnpj, "12345678000195");
    return {
      ultimoNsu: 42,
      documentos: [
        {
          nsu: 10,
          tipoDocumento: "NFSE",
          xmlDocumento: "<NFS-e><NSU>10</NSU><prestador>12345678000195</prestador></NFS-e>",
          chaveAcesso: "35260812345678000195550010000000101000000101",
          dataHoraGeracao: new Date(),
        },
        {
          nsu: 20,
          tipoDocumento: "NFSE",
          xmlDocumento: "<NFS-e><NSU>20</NSU><prestador>12345678000195</prestador></NFS-e>",
          chaveAcesso: "35260812345678000195550010000000201000000202",
          dataHoraGeracao: new Date(),
        },
      ],
    };
  });

  try {
    // 1. Executa a primeira sincronização
    const result1 = await syncCompanyNfseById(company.id);
    assert.equal(result1.status, "SUCCEEDED");
    assert.equal(result1.documentCount, 2);

    // Verifica se o cursor no banco atualizou para 42
    const cursor = await db.syncCursor.findFirst({
      where: { companyId: company.id, source: "ADN_NFSE_RESTRICTED" },
    });
    assert.equal(Number(cursor?.lastNsu), 42);

    // Verifica se os dois documentos foram criados
    const docs = await db.fiscalDocument.findMany({
      where: { companyId: company.id },
    });
    assert.equal(docs.length, 2);

    // 2. Executa a segunda sincronização (com mesmos NSUs simulando novo fetch que traz repetidas)
    // Alteramos o mock para retornar a mesma lista
    const result2 = await syncCompanyNfseById(company.id);
    assert.equal(result2.status, "SUCCEEDED");
    // Não deve criar novos registros no banco, pois os NSUs já existem
    assert.equal(result2.documentCount, 0);

    const docsAfter = await db.fiscalDocument.findMany({
      where: { companyId: company.id },
    });
    assert.equal(docsAfter.length, 2);

  } finally {
    // Limpeza do banco de dados
    const docs = await db.fiscalDocument.findMany({
      where: { companyId: company.id },
      select: { xmlObjectKey: true },
    });

    await db.organization.delete({ where: { id: org.id } }); // Cascades delete company, certificate, cursors, syncRuns, documents

    // Limpeza de arquivos criados no cofre (.vault)
    await rm(path.join(process.cwd(), ".vault", secretKey), { force: true });
    for (const doc of docs) {
      await rm(path.join(process.cwd(), ".vault", doc.xmlObjectKey), { force: true });
    }

    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});
