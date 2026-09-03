import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export type CreateApiKeyInput = {
  organizationId: string;
  name: string;
  scopes?: string[];
  expiresAt?: Date;
};

export async function createApiKey(input: CreateApiKeyInput) {
  const secretRandom = randomBytes(24).toString("hex");
  const keyPrefix = "fb_live";
  const rawKey = `${keyPrefix}_${secretRandom}`;
  const keyHash = hashKey(rawKey);

  const scopesString = Array.isArray(input.scopes) ? input.scopes.join(",") : (input.scopes || "documents:read,documents:write");

  const apiKey = await db.apiKey.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: scopesString,
      expiresAt: input.expiresAt || null,
    },
  });

  return {
    id: apiKey.id,
    name: apiKey.name,
    rawKey,
    scopes: apiKey.scopes.split(","),
    createdAt: apiKey.createdAt,
  };
}

export async function validateApiKey(rawKey: string | null, requiredScope?: string) {
  if (!rawKey || typeof rawKey !== "string" || !rawKey.startsWith("fb_live_")) {
    return null;
  }

  const keyHash = hashKey(rawKey);
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { organization: true },
  });

  if (!apiKey) return null;

  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
    return null;
  }

  const scopesList = typeof apiKey.scopes === "string" ? apiKey.scopes.split(",") : (apiKey.scopes || []);

  if (requiredScope && !scopesList.includes(requiredScope) && !scopesList.includes("*")) {
    return null;
  }

  db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

  return apiKey;
}
