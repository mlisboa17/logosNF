import { db } from "@/lib/db";
import { loadEncryptedDocument } from "@/lib/security/certificate-vault";
import { organizationIds, authSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authSession.requireApiSession();
  if (!session) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  const document = await db.fiscalDocument.findFirst({
    where: { id, company: { organizationId: { in: organizationIds(session) } } },
    select: { xmlObjectKey: true, accessKey: true, nsu: true },
  });
  if (!document) return Response.json({ error: "Documento não encontrado." }, { status: 404 });

  try {
    const xml = await loadEncryptedDocument(document.xmlObjectKey);
    const filename = `${document.accessKey || `nfse-nsu-${document.nsu}`}.xml`;
    const body = xml.toString("utf8");
    xml.fill(0);
    await db.fiscalDocument.update({ where: { id }, data: { lastDownloadedAt: new Date() } });
    await authSession.logAuditEntry({
      action: "DOCUMENT_XML_DOWNLOAD",
      entityType: "FiscalDocument",
      entityId: id,
    });
    return new Response(body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Não foi possível abrir o XML." }, { status: 500 });
  }
}
