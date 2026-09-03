export interface NormalizedFiscalDocument {
  id: string;
  kind: "NFSE" | "NFE" | "NFSE_EVENT" | "NFE_EVENT";
  accessKey: string | null;
  nsu: string;
  source: string;
  companyId: string;
  issuerTaxId: string | null;
  recipientTaxId: string | null;
  totalAmount: number | null;
  issuedAt: string | null;
  isSummary: boolean;
  manifestationStatus: string;
  erpStatus: string;
  erpStatusMessage: string | null;
  links: {
    self: string;
    xml: string;
    pdf?: string;
  };
  rawMetadata?: any;
}

export function normalizeDocumentToJson(doc: any): NormalizedFiscalDocument {
  let meta: Record<string, any> = {};
  if (typeof doc.rawMetadata === "string") {
    try {
      meta = JSON.parse(doc.rawMetadata);
    } catch {
      meta = {};
    }
  } else if (doc.rawMetadata && typeof doc.rawMetadata === "object") {
    meta = doc.rawMetadata;
  }

  const isSummary = Boolean(meta.isSummary);

  return {
    id: doc.id,
    kind: doc.kind,
    accessKey: doc.accessKey || null,
    nsu: doc.nsu != null ? doc.nsu.toString() : "0",
    source: doc.source,
    companyId: doc.companyId,
    issuerTaxId: doc.issuerTaxId || meta.cnpjIssuer || null,
    recipientTaxId: doc.recipientTaxId || meta.cnpjRecipient || null,
    totalAmount: doc.totalAmount != null ? Number(doc.totalAmount) : null,
    issuedAt: doc.issuedAt ? new Date(doc.issuedAt).toISOString() : null,
    isSummary,
    manifestationStatus: doc.manifestationStatus || "NOT_APPLICABLE",
    erpStatus: doc.erpStatus || "PENDING",
    erpStatusMessage: doc.erpStatusMessage || null,
    links: {
      self: `/api/v1/documents/${doc.id}`,
      xml: `/api/v1/documents/${doc.id}/xml`,
      pdf: `/api/documents/${doc.id}/pdf`,
    },
    rawMetadata: meta,
  };
}
