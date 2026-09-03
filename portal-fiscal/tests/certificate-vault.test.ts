import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEncryptedCertificate, loadEncryptedDocument, storeEncryptedCertificate, storeEncryptedDocument } from "../src/lib/security/certificate-vault.ts";

const masterKey = "8f".repeat(32);

async function withTemporaryVault(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fiscalbox-test-"));
  const previousDirectory = process.cwd();
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.chdir(directory);
  process.env.CERTIFICATE_MASTER_KEY_HEX = masterKey;
  try {
    await run(directory);
  } finally {
    process.chdir(previousDirectory);
    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
    assert.ok(directory.startsWith(os.tmpdir()), "A limpeza deve permanecer no diretório temporário.");
    await rm(directory, { recursive: true, force: true });
  }
}

test("protege e recupera certificado A1 sem gravar senha em texto puro", async () => {
  await withTemporaryVault(async (directory) => {
    const objectKey = await storeEncryptedCertificate({ id: "certificate-test", pfx: Buffer.from("pfx-sensivel"), password: "senha-secreta" });
    const rawFile = await readFile(path.join(directory, ".vault", objectKey));
    assert.equal(rawFile.includes(Buffer.from("senha-secreta")), false);
    const recovered = await loadEncryptedCertificate(objectKey);
    assert.equal(recovered.pfx.toString(), "pfx-sensivel");
    assert.equal(recovered.password, "senha-secreta");
    recovered.pfx.fill(0);
  });
});

test("protege XML e bloqueia referência fora do cofre", async () => {
  await withTemporaryVault(async () => {
    const objectKey = await storeEncryptedDocument({ id: "document-test", xml: "<NFS-e>conteúdo</NFS-e>" });
    const recovered = await loadEncryptedDocument(objectKey);
    assert.equal(recovered.toString(), "<NFS-e>conteúdo</NFS-e>");
    recovered.fill(0);
    await assert.rejects(() => loadEncryptedDocument("documents/../../.env"), /cofre/i);
  });
});
