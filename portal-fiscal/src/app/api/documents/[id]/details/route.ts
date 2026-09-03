import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseDocumentDetails } from "@/lib/fiscal/details-parser";
import { loadEncryptedDocument } from "@/lib/security/certificate-vault";
import { authSession, organizationIds } from "@/lib/auth/session";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await authSession.requireApiSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const allowedOrgs = organizationIds(session);

  const documentRecord = await db.fiscalDocument.findFirst({
    where: {
      id,
      company: { organizationId: { in: allowedOrgs } },
    },
    include: {
      company: { select: { id: true, legalName: true, organizationId: true } },
    },
  });

  if (!documentRecord) {
    return NextResponse.json({ error: "Documento não encontrado ou acesso negado." }, { status: 404 });
  }

  let xmlContent = "";
  try {
    const xmlBuffer = await loadEncryptedDocument(documentRecord.xmlObjectKey);
    xmlContent = xmlBuffer.toString("utf8");
  } catch (error) {
    console.error("FALHA_AO_LER_XML_DO_COFRE", error);
    xmlContent = "<xml>Conteúdo indisponível ou inacessível no cofre</xml>";
  }

  const details = parseDocumentDetails(
    xmlContent,
    documentRecord.kind,
    documentRecord.rawMetadata,
    {
      nsu: documentRecord.nsu.toString(),
      issuedAt: documentRecord.issuedAt,
      createdAt: documentRecord.createdAt,
      lastDownloadedAt: documentRecord.lastDownloadedAt,
      manifestationStatus: documentRecord.manifestationStatus,
      manifestedAt: documentRecord.manifestedAt,
    }
  );

  await authSession.logAuditEntry({
    action: "DOCUMENT_VIEW_DETAILS",
    entityType: "FiscalDocument",
    entityId: documentRecord.id,
    organizationId: documentRecord.company.organizationId,
    userId: session.userId,
    metadata: { accessKey: documentRecord.accessKey, kind: documentRecord.kind },
  });

  return NextResponse.json({
    documentId: documentRecord.id,
    companyName: documentRecord.company.legalName,
    details,
    rawXml: xmlContent,
  });
}
