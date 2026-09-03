import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/auth/api-key";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;

  const apiKey = await validateApiKey(rawKey, "erp:update");
  if (!apiKey) {
    return NextResponse.json({ error: "Chave de API inválida ou sem permissão de atualização do ERP." }, { status: 401 });
  }

  const body = await request.json();
  const { documentId, status, message } = body;

  if (!documentId || !["ACCEPTED", "ERROR", "REPROCESSED", "QUEUED"].includes(status)) {
    return NextResponse.json(
      { error: "Informe documentId e status válido (ACCEPTED, ERROR, REPROCESSED, QUEUED)." },
      { status: 400 }
    );
  }

  const doc = await db.fiscalDocument.findUnique({
    where: { id: documentId },
    include: { company: true },
  });

  if (!doc || doc.company.organizationId !== apiKey.organizationId) {
    return NextResponse.json({ error: "Documento fiscal não encontrado ou acesso negado." }, { status: 404 });
  }

  const updatedDoc = await db.fiscalDocument.update({
    where: { id: documentId },
    data: {
      erpStatus: status,
      erpStatusMessage: message || null,
      erpSyncedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    documentId: updatedDoc.id,
    erpStatus: updatedDoc.erpStatus,
    erpStatusMessage: updatedDoc.erpStatusMessage,
    erpSyncedAt: updatedDoc.erpSyncedAt,
  });
}
