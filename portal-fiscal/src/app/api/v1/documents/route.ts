import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/auth/api-key";
import { normalizeDocumentToJson } from "@/lib/integrations/normalizer";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;

  const apiKey = await validateApiKey(rawKey, "documents:read");
  if (!apiKey) {
    return NextResponse.json({ error: "Chave de API inválida, expirada ou sem permissão de leitura." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const kind = searchParams.get("kind");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const offset = Number(searchParams.get("offset") || 0);

  const whereClause: any = {
    company: {
      organizationId: apiKey.organizationId,
    },
  };

  if (companyId) whereClause.companyId = companyId;
  if (kind) whereClause.kind = kind;

  const [total, documents] = await Promise.all([
    db.fiscalDocument.count({ where: whereClause }),
    db.fiscalDocument.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    total,
    limit,
    offset,
    items: documents.map(normalizeDocumentToJson),
  });
}
