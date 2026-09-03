import JSZip from "jszip";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadEncryptedDocument } from "@/lib/security/certificate-vault";
import { organizationIds, authSession } from "@/lib/auth/session";

export const runtime = "nodejs";

function filename(accessKey: string | null, nsu: bigint): string {
  return (accessKey || `nsu-${nsu}`).replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await authSession.requireApiSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const url = new URL(request.url);
  const period = url.searchParams.get("period") || new Date().toISOString().slice(0, 7); // Ex: 2026-08

  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Formato de competência inválido. Use YYYY-MM." }, { status: 400 });
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const allowedOrgs = organizationIds(session);
  const company = await db.company.findFirst({
    where: { id, organizationId: { in: allowedOrgs } },
    select: { id: true, legalName: true, cnpj: true, organizationId: true },
  });

  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada ou acesso negado." }, { status: 404 });
  }

  const documents = await db.fiscalDocument.findMany({
    where: {
      companyId: company.id,
      issuedAt: { gte: startDate, lte: endDate },
    },
    orderBy: { issuedAt: "asc" },
  });

  const zip = new JSZip();
  const baseFolder = zip.folder(`${company.cnpj}/${period}`);
  const nfeFolder = baseFolder?.folder("NF-e");
  const nfseFolder = baseFolder?.folder("NFS-e");
  const eventFolder = baseFolder?.folder("Eventos");

  const incompleteSummaries: string[] = [];
  let csv = "\uFEFFChave;NSU;Tipo;Data Emissao;Valor Total;Situacao;Estado XML\n";

  for (const doc of documents) {
    const xml = await loadEncryptedDocument(doc.xmlObjectKey);
    const name = filename(doc.accessKey, doc.nsu);
    const meta = doc.rawMetadata ? (JSON.parse(doc.rawMetadata) as Record<string, any>) : {};

    if (doc.kind.endsWith("EVENT")) {
      eventFolder?.file(`${name}.xml`, Uint8Array.from(xml));
    } else if (doc.kind === "NFE") {
      nfeFolder?.file(`${name}.xml`, Uint8Array.from(xml));
      if (meta.isSummary) {
        incompleteSummaries.push(`Chave: ${doc.accessKey || doc.nsu.toString()} (NSU: ${doc.nsu})`);
      }
    } else {
      nfseFolder?.file(`${name}.xml`, Uint8Array.from(xml));
    }

    const stateLabel = meta.isSummary ? "Somente Resumo" : "XML Completo";
    csv += `"${doc.accessKey || "—"}";"${doc.nsu}";"${doc.kind}";"${doc.issuedAt?.toISOString() || "—"}";"${doc.totalAmount ? Number(doc.totalAmount).toFixed(2) : "0.00"}";"${doc.manifestationStatus}";"${stateLabel}"\n`;
  }

  baseFolder?.file("resumo_fechamento_competencia.csv", csv);

  if (incompleteSummaries.length > 0) {
    let pendenciesText = `RELATÓRIO DE PENDÊNCIAS DE FECHAMENTO FISCAL - COMPETÊNCIA ${period}\n`;
    pendenciesText += `Empresa: ${company.legalName} (${company.cnpj})\n`;
    pendenciesText += `Total de notas aguardando XML completo: ${incompleteSummaries.length}\n\n`;
    pendenciesText += `ATENÇÃO: As notas abaixo possuem apenas resumo e aguardam manifestação do destinatário ou busca do procNFe:\n`;
    pendenciesText += incompleteSummaries.join("\n") + "\n";
    baseFolder?.file("relatorio_pendencias.txt", pendenciesText);
  }

  const zipContent = await zip.generateAsync({ type: "nodebuffer" });

  await authSession.logAuditEntry({
    action: "COMPANY_MONTHLY_CLOSING",
    entityType: "Company",
    entityId: company.id,
    organizationId: company.organizationId,
    userId: session.userId,
    metadata: { period, documentCount: documents.length, incompleteCount: incompleteSummaries.length },
  });

  return new Response(new Uint8Array(zipContent), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="fechamento-${company.cnpj}-${period}.zip"`,
    },
  });
}
