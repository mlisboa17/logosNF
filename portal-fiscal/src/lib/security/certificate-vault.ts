import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { certificateLogger } from "@/lib/logging";

const ALGORITHM = "aes-256-gcm";

function masterKey(): Buffer {
  const value = process.env.CERTIFICATE_MASTER_KEY_HEX;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("CERTIFICATE_MASTER_KEY_HEX deve possuir 64 caracteres hexadecimais.");
  }
  return Buffer.from(value, "hex");
}

function resolveVaultKey(secretKey: string, expectedDirectory: "certificates" | "documents"): string {
  if (!secretKey || typeof secretKey !== "string") {
    throw new Error("Referência de segredo não fornecida.");
  }
  const normalized = secretKey.replace(/\\/g, "/");
  if (!normalized.startsWith(`${expectedDirectory}/`) || normalized.includes("..")) {
    throw new Error("Referência inválida para o cofre.");
  }
  const vaultRoot = path.resolve(process.cwd(), ".vault");
  const resolved = path.resolve(vaultRoot, normalized);
  if (!resolved.startsWith(`${vaultRoot}${path.sep}`)) throw new Error("Referência fora do cofre.");
  return resolved;
}

function decryptPayload(encrypted: Buffer): Buffer {
  if (encrypted.length < 29) throw new Error("Arquivo criptografado está inválido.");
  const iv = encrypted.subarray(0, 12);
  const authTag = encrypted.subarray(12, 28);
  const ciphertext = encrypted.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, masterKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function storeEncryptedCertificate(input: {
  id: string;
  pfx: Buffer;
  password: string;
}): Promise<string> {
  certificateLogger.debug({ id: input.id }, "Encrypting certificate");

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, masterKey(), iv);
  const plaintext = Buffer.from(JSON.stringify({
    pfx: input.pfx.toString("base64"),
    password: input.password,
  }), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  plaintext.fill(0);

  const vaultDirectory = path.join(process.cwd(), ".vault", "certificates");
  const filename = `${input.id}.a1.enc`;
  await mkdir(vaultDirectory, { recursive: true });
  await writeFile(path.join(vaultDirectory, filename), Buffer.concat([iv, authTag, ciphertext]), { flag: "wx", mode: 0o600 });
  ciphertext.fill(0);

  certificateLogger.info({ id: input.id, filename }, "Certificate encrypted and stored");
  return `certificates/${filename}`;
}

export async function loadEncryptedCertificate(secretKey: string): Promise<{ pfx: Buffer; password: string }> {
  certificateLogger.debug({ secretKey }, "Loading encrypted certificate");

  const encrypted = await readFile(resolveVaultKey(secretKey, "certificates"));
  const plaintext = decryptPayload(encrypted);

  try {
    const parsed = JSON.parse(plaintext.toString("utf8")) as { pfx: string; password: string };
    certificateLogger.info({ secretKey }, "Certificate loaded successfully");
    return { pfx: Buffer.from(parsed.pfx, "base64"), password: parsed.password };
  } catch (error) {
    certificateLogger.error({ secretKey, error }, "Failed to load certificate");
    throw error;
  } finally {
    plaintext.fill(0);
    encrypted.fill(0);
  }
}

export async function loadEncryptedDocument(objectKey: string): Promise<Buffer> {
  const encrypted = await readFile(resolveVaultKey(objectKey, "documents"));
  try {
    return decryptPayload(encrypted);
  } finally {
    encrypted.fill(0);
  }
}

export async function storeEncryptedDocument(input: { id: string; xml: string }): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, masterKey(), iv);
  const plaintext = Buffer.from(input.xml, "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  plaintext.fill(0);

  const directory = path.join(process.cwd(), ".vault", "documents");
  const filename = `${input.id}.xml.enc`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), Buffer.concat([iv, authTag, ciphertext]), { flag: "wx", mode: 0o600 });
  ciphertext.fill(0);
  return `documents/${filename}`;
}
