import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/auth/api-key";
import { normalizeDocumentToJson } from "@/lib/integrations/normalizer";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;

  const apiKey = await validateApiKey(rawKey, "documents:read");
  if (!apiKey) {
    return NextResponse.json({ error: "Chave de API inválida ou sem permissão." }, { status: 401 });
  }

  const doc = await db.fiscalDocument.findUnique({
    where: { id: params.id },
    include: { company: true },
  });

  if (!doc || doc.company.organizationId !== apiKey.organizationId) {
    return NextResponse.json({ error: "Documento fiscal não encontrado." }, { status: 404 });
  }

  return NextResponse.json(normalizeDocumentToJson(doc));
}
