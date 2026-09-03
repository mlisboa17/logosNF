import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/auth/api-key";
import { dispatchWebhookEvent } from "@/lib/integrations/webhooks";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;

  const apiKey = await validateApiKey(rawKey, "webhooks:manage");
  if (!apiKey) {
    return NextResponse.json({ error: "Chave de API inválida ou sem permissão para gerenciar webhooks." }, { status: 401 });
  }

  const results = await dispatchWebhookEvent({
    organizationId: apiKey.organizationId,
    event: "document.received.test",
    payload: {
      message: "Este é um disparo de teste de webhook assinado da plataforma FiscalBox.",
      timestamp: new Date().toISOString(),
      sampleDocumentId: "doc_test_12345",
    },
  });

  return NextResponse.json({
    message: `Teste enviado para ${results.length} endpoint(s) cadastrado(s).`,
    deliveries: results,
  });
}
