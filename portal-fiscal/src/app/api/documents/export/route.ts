import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { Ambiente, gerarDanfse, parseNfseXml } from "open-nfse";
import { db } from "@/lib/db";
import { loadEncryptedDocument } from "@/lib/security/certificate-vault";
import { organizationIds, authSession } from "@/lib/auth/session";

export const runtime = "nodejs";
const MAX_DOCUMENTS = 100;
const FORMATS = new Set(["xml_zip", "pdf_zip", "complete_zip", "merged_pdf"]);

function filename(accessKey: string | null, nsu: bigint): string {
  return (accessKey || `nfse-nsu-${nsu}`).replace(/[^a-zA-Z0-9_-]/g, "");
}

function downloadableBody(data: Uint8Array | Buffer, type: string): Blob {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy.buffer], { type });
}

export async function POST(request: Request) {
  const session = await authSession.requireApiSession();
  if (!session) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { ids?: unknown; format?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((id): id is string => typeof id === "string" && id.length <= 64))] : [];
  const format = typeof body?.format === "string" ? body.format : "";
  if (ids.length === 0) return Response.json({ error: "Selecione ao menos um documento." }, { status: 400 });
  if (ids.length > MAX_DOCUMENTS) return Response.json({ error: `O limite por lote é ${MAX_DOCUMENTS} documentos.` }, { status: 400 });
  if (!FORMATS.has(format)) return Response.json({ error: "Formato de exportação inválido." }, { status: 400 });

  const documents = await db.fiscalDocument.findMany({
    where: { id: { in: ids }, company: { organizationId: { in: organizationIds(session) } } },
    orderBy: { issuedAt: "asc" },
    select: { id: true, kind: true, accessKey: true, nsu: true, source: true, xmlObjectKey: true },
  });
  if (documents.length !== ids.length) return Response.json({ error: "Um ou mais documentos não foram encontrados." }, { status: 404 });

  const zip = format === "merged_pdf" ? null : new JSZip();
  const xmlFolder = format === "xml_zip" || format === "complete_zip" ? zip?.folder("XML") : null;
  const pdfFolder = format === "pdf_zip" || format === "complete_zip" ? zip?.folder("PDF") : null;
  const merged = format === "merged_pdf" ? await PDFDocument.create() : null;
  const errors: string[] = [];
  let pdfCount = 0;

  for (const document of documents) {
    const xml = await loadEncryptedDocument(document.xmlObjectKey);
    const name = filename(document.accessKey, document.nsu);
    xmlFolder?.file(`${name}.xml`, Uint8Array.from(xml));

    if ((pdfFolder || merged) && document.kind === "NFSE") {
      try {
        const nfse = parseNfseXml(xml.toString("utf8"));
        const pdf = await gerarDanfse(nfse, { ambiente: document.source.endsWith("PRODUCTION") ? Ambiente.Producao : Ambiente.ProducaoRestrita });
        pdfCount += 1;
        if (pdfFolder) pdfFolder.file(`${name}.pdf`, Uint8Array.from(pdf));
        if (merged) {
          const sourcePdf = await PDFDocument.load(pdf);
          const pages = await merged.copyPages(sourcePdf, sourcePdf.getPageIndices());
          for (const page of pages) merged.addPage(page);
        }
        pdf.fill(0);
      } catch {
        errors.push(`${name}: falha ao gerar PDF.`);
      }
    }
    xml.fill(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await authSession.logAuditEntry({
    action: "DOCUMENT_BATCH_EXPORT",
    entityType: "FiscalDocument",
    metadata: {
      documentIds: documents.map((doc) => doc.id),
      format,
    },
  });
  if (merged) {
    if (pdfCount === 0) return Response.json({ error: "A seleção não contém NFS-e apta a gerar PDF." }, { status: 422 });
    const bytes = await merged.save();
    await db.fiscalDocument.updateMany({ where: { id: { in: documents.map((document) => document.id) } }, data: { lastDownloadedAt: new Date() } });
    return new Response(downloadableBody(bytes, "application/pdf"), { headers: { "Content-Disposition": `attachment; filename="nfse-agrupadas-${stamp}.pdf"`, "Cache-Control": "private, no-store" } });
  }

  if (errors.length) zip?.file("ERROS-PDF.txt", errors.join("\n"));
  zip?.file("LEIA-ME.txt", `Documentos selecionados: ${documents.length}\nPDFs gerados: ${pdfCount}\n`);
  const archive = await zip!.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await db.fiscalDocument.updateMany({ where: { id: { in: documents.map((document) => document.id) } }, data: { lastDownloadedAt: new Date() } });
  return new Response(new Blob([archive], { type: "application/zip" }), { headers: { "Content-Disposition": `attachment; filename="documentos-fiscais-${stamp}.zip"`, "Cache-Control": "private, no-store" } });
}
