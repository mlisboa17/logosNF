import JSZip from "jszip";
import { Ambiente, gerarDanfse, parseNfseXml } from "open-nfse";
import { db } from "@/lib/db";
import { loadEncryptedDocument } from "@/lib/security/certificate-vault";
import { organizationIds, authSession } from "@/lib/auth/session";

export const runtime = "nodejs";
const BATCH_LIMIT = 100;

function baseName(accessKey: string | null, nsu: bigint): string {
  return (accessKey || `nfse-nsu-${nsu}`).replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authSession.requireApiSession();
  if (!session) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  const company = await db.company.findFirst({
    where: { id, organizationId: { in: organizationIds(session) } },
    select: { legalName: true, cnpj: true, documents: { orderBy: { createdAt: "desc" }, take: BATCH_LIMIT, select: { id: true, kind: true, accessKey: true, nsu: true, source: true, xmlObjectKey: true } } },
  });
  if (!company) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
  if (company.documents.length === 0) return Response.json({ error: "A empresa ainda não possui documentos." }, { status: 404 });

  const zip = new JSZip();
  const xmlFolder = zip.folder("XML");
  const pdfFolder = zip.folder("PDF");
  const errors: string[] = [];

  for (const document of company.documents) {
    const xml = await loadEncryptedDocument(document.xmlObjectKey);
    const name = baseName(document.accessKey, document.nsu);
    xmlFolder?.file(`${name}.xml`, Uint8Array.from(xml));
    if (document.kind === "NFSE") {
      try {
        const nfse = parseNfseXml(xml.toString("utf8"));
        const pdf = await gerarDanfse(nfse, { ambiente: document.source.endsWith("PRODUCTION") ? Ambiente.Producao : Ambiente.ProducaoRestrita });
        pdfFolder?.file(`${name}.pdf`, Uint8Array.from(pdf));
        pdf.fill(0);
      } catch {
        errors.push(`${name}: não foi possível gerar o PDF.`);
      }
    }
    xml.fill(0);
  }

  zip.file("LEIA-ME.txt", `Empresa: ${company.legalName}\nCNPJ: ${company.cnpj}\nDocumentos no lote: ${company.documents.length}\nLimite por lote: ${BATCH_LIMIT}\n`);
  if (errors.length) zip.file("ERROS-PDF.txt", errors.join("\n"));
  const archive = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await db.fiscalDocument.updateMany({ where: { companyId: id, id: { in: company.documents.map((document) => document.id) } }, data: { lastDownloadedAt: new Date() } });
  await authSession.logAuditEntry({
    action: "COMPANY_ARCHIVE_DOWNLOAD",
    entityType: "Company",
    entityId: id,
    metadata: {
      cnpj: company.cnpj,
      legalName: company.legalName,
      documentCount: company.documents.length,
    },
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Blob([archive], { type: "application/zip" }), { headers: { "Content-Disposition": `attachment; filename="nfse-${company.cnpj}-${date}.zip"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
