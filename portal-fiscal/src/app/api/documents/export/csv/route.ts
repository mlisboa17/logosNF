import { db } from "@/lib/db";
import { organizationIds, authSession } from "@/lib/auth/session";

export const runtime = "nodejs";

function formatCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function POST(request: Request) {
  const session = await authSession.requireApiSession();
  if (!session) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((id): id is string => typeof id === "string"))] : [];

  if (ids.length === 0) return Response.json({ error: "Selecione ao menos um documento." }, { status: 400 });

  const documents = await db.fiscalDocument.findMany({
    where: {
      id: { in: ids },
      company: { organizationId: { in: organizationIds(session) } },
    },
    orderBy: { issuedAt: "asc" },
    include: {
      company: { select: { legalName: true, cnpj: true, organizationId: true } },
    },
  });

  if (documents.length === 0) {
    return Response.json({ error: "Nenhum documento encontrado." }, { status: 404 });
  }

  // BOM UTF-8 para garantir acentuação correta no Excel
  let csv = "\uFEFF";
  csv += "Chave de Acesso;NSU;Tipo;Empresa;CNPJ Emitente;CNPJ Destinatario;Data Emissao;Valor Total (R$);Situacao Manifestacao;Estado Documento;Ultimo Download\n";

  for (const doc of documents) {
    const meta = doc.rawMetadata ? (typeof doc.rawMetadata === 'string' ? JSON.parse(doc.rawMetadata) : doc.rawMetadata) as Record<string, any> : {};
    const stateLabel = doc.kind === "NFE" ? (meta.isSummary ? "Somente Resumo" : "XML Completo") : "XML Completo";
    const issuedAtFormatted = doc.issuedAt ? doc.issuedAt.toLocaleString("pt-BR") : "—";
    const downloadedFormatted = doc.lastDownloadedAt ? doc.lastDownloadedAt.toLocaleString("pt-BR") : "Não baixado";

    const row = [
      formatCsvValue(doc.accessKey || "—"),
      formatCsvValue(doc.nsu.toString()),
      formatCsvValue(doc.kind),
      formatCsvValue(doc.company.legalName),
      formatCsvValue(doc.issuerTaxId || meta.cnpjIssuer || "—"),
      formatCsvValue(doc.recipientTaxId || meta.cnpjRecipient || doc.company.cnpj),
      formatCsvValue(issuedAtFormatted),
      formatCsvValue(doc.totalAmount ? Number(doc.totalAmount).toFixed(2) : "0.00"),
      formatCsvValue(doc.manifestationStatus),
      formatCsvValue(stateLabel),
      formatCsvValue(downloadedFormatted),
    ].join(";");

    csv += row + "\n";
  }

  await authSession.logAuditEntry({
    action: "DOCUMENT_EXPORT_CSV",
    entityType: "FiscalDocument",
    organizationId: documents[0].company.organizationId,
    userId: session.userId,
    metadata: { count: documents.length },
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-documentos-fiscais.csv"`,
    },
  });
}
