import { Ambiente, gerarDanfse, parseNfseXml } from "open-nfse";
import { db } from "@/lib/db";
import { loadEncryptedDocument } from "@/lib/security/certificate-vault";
import { organizationIds, authSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authSession.requireApiSession();
  if (!session) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  const document = await db.fiscalDocument.findFirst({
    where: { id, company: { organizationId: { in: organizationIds(session) } } },
    select: { kind: true, xmlObjectKey: true, accessKey: true, nsu: true, source: true },
  });
  if (!document) return Response.json({ error: "Documento não encontrado." }, { status: 404 });
  if (document.kind !== "NFSE") return Response.json({ error: "Eventos não possuem DANFSe próprio." }, { status: 422 });

  try {
    const xml = await loadEncryptedDocument(document.xmlObjectKey);
    const nfse = parseNfseXml(xml.toString("utf8"));
    xml.fill(0);
    const pdf = await gerarDanfse(nfse, {
      ambiente: document.source.endsWith("PRODUCTION") ? Ambiente.Producao : Ambiente.ProducaoRestrita,
    });
    const filename = `${document.accessKey || `nfse-nsu-${document.nsu}`}.pdf`;
    const body = new Blob([Uint8Array.from(pdf)], { type: "application/pdf" });
    pdf.fill(0);
    await db.fiscalDocument.update({ where: { id }, data: { lastDownloadedAt: new Date() } });
    await authSession.logAuditEntry({
      action: "DOCUMENT_PDF_DOWNLOAD",
      entityType: "FiscalDocument",
      entityId: id,
    });
    return new Response(body, { headers: { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("DANFSE_GENERATION_FAILED", {
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Não foi possível gerar o DANFSe deste XML." }, { status: 500 });
  }
}
