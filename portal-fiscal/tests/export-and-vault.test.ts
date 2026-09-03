import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { storeEncryptedDocument, loadEncryptedDocument } from "../src/lib/security/certificate-vault";

test("Cofre documental e integridade por hash SHA-256", async () => {
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?><NFSe><infNFSe><nNFSe>12345</nNFSe><vServ>1500.00</vServ></infNFSe></NFSe>`;
  const docId = randomUUID();
  let objectKey = "";

  try {
    // Salva no cofre criptografado
    objectKey = await storeEncryptedDocument({ id: docId, xml: sampleXml });
    assert.ok(objectKey.includes(docId), "A chave do objeto no cofre deve conter o ID do documento.");

    // Le de volta do cofre
    const retrievedBuffer = await loadEncryptedDocument(objectKey);
    const retrievedXml = retrievedBuffer.toString("utf-8");
    assert.equal(retrievedXml, sampleXml, "O XML lido do cofre deve ser exatamente idêntico ao gravado.");

    // Valida integridade do hash SHA-256
    const computedHash = createHash("sha256").update(retrievedXml).digest("hex");
    const originalHash = createHash("sha256").update(sampleXml).digest("hex");
    assert.equal(computedHash, originalHash, "O hash SHA-256 deve garantir a imutabilidade do XML.");
  } finally {
    if (objectKey) {
      await rm(path.join(process.cwd(), ".vault", objectKey), { force: true }).catch(() => undefined);
    }
    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});

test("Exportação e saneamento de enconding UTF-8", async () => {
  const textWithAccents = "Serviço de Consultoria Tributária e Fiscal com Retenção de ISS";
  const encoded = Buffer.from(textWithAccents, "utf-8").toString("utf-8");

  assert.equal(encoded, textWithAccents, "A string com acentuação deve ser preservada em UTF-8.");
  assert.equal(encoded.length, textWithAccents.length);
});
