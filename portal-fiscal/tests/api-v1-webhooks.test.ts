import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { createApiKey, validateApiKey } from "../src/lib/auth/api-key";
import { generateWebhookSignature, dispatchWebhookEvent } from "../src/lib/integrations/webhooks";
import { normalizeDocumentToJson } from "../src/lib/integrations/normalizer";
import { GET as getOpenApi } from "../src/app/api/v1/openapi.json/route";

test("API Keys: geração, hash SHA-256 e validação de escopos", async () => {
  const org = await db.organization.create({ data: { name: "Org API Test" } });

  try {
    const keyData = await createApiKey({
      organizationId: org.id,
      name: "Chave Integração ERP",
      scopes: ["documents:read", "erp:update"],
    });

    assert.ok(keyData.rawKey.startsWith("fb_live_"));
    assert.equal(keyData.name, "Chave Integração ERP");

    // Valida chave correta com escopo permitido
    const validKey = await validateApiKey(keyData.rawKey, "documents:read");
    assert.ok(validKey);
    assert.equal(validKey?.organizationId, org.id);

    // Valida rejeição se escopo exigido não for possuído
    const invalidScope = await validateApiKey(keyData.rawKey, "admin:delete");
    assert.equal(invalidScope, null, "Chave sem o escopo admin:delete deve ser rejeitada.");

    // Valida chave inexistente
    const invalidKey = await validateApiKey("fb_live_invalid_key", "documents:read");
    assert.equal(invalidKey, null);
  } finally {
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined);
  }
});

test("Webhooks: assinatura digital HMAC-SHA256 e formato de cabeçalho", async () => {
  const secret = "whsec_test_secret_123456789";
  const timestamp = 1750000000;
  const payload = JSON.stringify({ event: "document.received", data: { id: "doc_123" } });

  const signature = generateWebhookSignature(secret, timestamp, payload);

  assert.ok(signature.startsWith(`t=${timestamp},v1=`), "A assinatura do webhook deve seguir o formato Stripe/Standard t=timestamp,v1=hash.");
  assert.ok(signature.length > 40);
});

test("Normalizador de Documentos Fiscais para JSON OpenAPI/ERP", async () => {
  const mockDoc = {
    id: "doc-norm-123",
    companyId: "comp-456",
    kind: "NFE",
    source: "SEFAZ_NFE_PRODUCTION",
    nsu: BigInt(500),
    accessKey: "35260811222333000199000000000000000000000001",
    issuerTaxId: "11222333000144",
    recipientTaxId: "44333222000199",
    issuedAt: new Date("2026-08-10T12:00:00Z"),
    totalAmount: 2500.75,
    manifestationStatus: "CONFIRMED",
    erpStatus: "ACCEPTED",
    erpStatusMessage: "Integrado ao ERP SAP com sucesso",
    rawMetadata: JSON.stringify({ isSummary: false }),
  };

  const normalized = normalizeDocumentToJson(mockDoc);

  assert.equal(normalized.id, "doc-norm-123");
  assert.equal(normalized.kind, "NFE");
  assert.equal(normalized.nsu, "500");
  assert.equal(normalized.totalAmount, 2500.75);
  assert.equal(normalized.isSummary, false);
  assert.equal(normalized.links.self, "/api/v1/documents/doc-norm-123");
  assert.equal(normalized.links.xml, "/api/v1/documents/doc-norm-123/xml");
});

test("Especificação OpenAPI 3.0", async () => {
  const res = await getOpenApi();
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.openapi, "3.0.3");
  assert.equal(json.info.title, "FiscalBox Public API");
  assert.ok(json.paths["/documents"]);
  assert.ok(json.paths["/erp/integration-status"]);
});
