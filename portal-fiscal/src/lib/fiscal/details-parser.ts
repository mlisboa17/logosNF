export type FiscalParty = {
  name: string;
  taxId: string;
  stateRegistration?: string;
  cityUf?: string;
};

export type FiscalItem = {
  itemNumber: number;
  code: string;
  description: string;
  ncm?: string;
  quantity?: number;
  unitValue?: number;
  totalValue: number;
  icmsAmount?: number;
  ipiAmount?: number;
  pisAmount?: number;
  cofinsAmount?: number;
  issAmount?: number;
};

export type FiscalTaxBreakdown = {
  icmsTotal: number;
  ipiTotal: number;
  pisTotal: number;
  cofinsTotal: number;
  issTotal: number;
  ibsEstimate: number; // Placeholder IBS da Reforma Tributária (LC 214/2024)
  cbsEstimate: number; // Placeholder CBS da Reforma Tributária (LC 214/2024)
};

export type FiscalTimelineEvent = {
  date: string;
  title: string;
  description: string;
  badge: "emerald" | "blue" | "amber" | "violet" | "red";
};

export type FiscalDocumentDetails = {
  accessKey: string;
  kind: string;
  isSummary: boolean;
  number?: string;
  series?: string;
  issuedAt?: string;
  issuer: FiscalParty;
  recipient: FiscalParty;
  items: FiscalItem[];
  totals: {
    productsTotal: number;
    servicesTotal: number;
    discountTotal: number;
    freightTotal: number;
    grandTotal: number;
  };
  taxes: FiscalTaxBreakdown;
  timeline: FiscalTimelineEvent[];
};

function getXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function getXmlSubtag(xml: string, parentTag: string, subtag: string): string {
  const parentMatch = xml.match(new RegExp(`<${parentTag}[^>]*>([\\s\\S]*?)</${parentTag}>`, "i"));
  if (!parentMatch) return "";
  return getXmlTag(parentMatch[1], subtag);
}

export function parseDocumentDetails(
  xmlContent: string,
  kind: string,
  rawMetadata?: any,
  documentRecord?: {
    nsu: string;
    issuedAt?: Date | null;
    createdAt: Date;
    lastDownloadedAt?: Date | null;
    manifestationStatus?: string;
    manifestedAt?: Date | null;
  }
): FiscalDocumentDetails {
  const meta = rawMetadata ? (typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata) as Record<string, any> : {};
  const isSummary = Boolean(meta.isSummary);

  const accessKey = getXmlTag(xmlContent, "chNFe") || getXmlTag(xmlContent, "chNfse") || meta.accessKey || "—";
  const number = getXmlTag(xmlContent, "nNF") || getXmlTag(xmlContent, "nNfse") || "—";
  const series = getXmlTag(xmlContent, "serie") || "1";
  const dhEmi = getXmlTag(xmlContent, "dhEmi") || getXmlTag(xmlContent, "dEmi") || (documentRecord?.issuedAt ? documentRecord.issuedAt.toISOString() : "");

  // Partes (Emitente e Destinatário)
  const emitName = getXmlSubtag(xmlContent, "emit", "xNome") || meta.cnpjIssuer || "Emitente identificado no resumo";
  const emitCnpj = getXmlSubtag(xmlContent, "emit", "CNPJ") || getXmlSubtag(xmlContent, "emit", "CPF") || meta.cnpjIssuer || "—";
  const emitIE = getXmlSubtag(xmlContent, "emit", "IE") || "—";
  const emitUf = getXmlSubtag(xmlContent, "enderEmit", "UF") || "—";

  const destName = getXmlSubtag(xmlContent, "dest", "xNome") || meta.cnpjRecipient || "Destinatário identificado";
  const destCnpj = getXmlSubtag(xmlContent, "dest", "CNPJ") || getXmlSubtag(xmlContent, "dest", "CPF") || meta.cnpjRecipient || "—";
  const destIE = getXmlSubtag(xmlContent, "dest", "IE") || "—";
  const destUf = getXmlSubtag(xmlContent, "enderDest", "UF") || "—";

  // Extração dos Itens (<det n="1">...)
  const items: FiscalItem[] = [];
  const detMatches = xmlContent.match(/<det\b[\s\S]*?<\/det>/gi) ?? [];

  detMatches.forEach((detXml, index) => {
    const itemNumber = index + 1;
    const code = getXmlSubtag(detXml, "prod", "cProd") || `ITEM-${itemNumber}`;
    const description = getXmlSubtag(detXml, "prod", "xProd") || `Produto / Serviço ${itemNumber}`;
    const ncm = getXmlSubtag(detXml, "prod", "NCM") || "—";
    const quantity = parseFloat(getXmlSubtag(detXml, "prod", "qCom")) || 1;
    const unitValue = parseFloat(getXmlSubtag(detXml, "prod", "vUnCom")) || 0;
    const totalValue = parseFloat(getXmlSubtag(detXml, "prod", "vProd")) || unitValue * quantity;

    const icmsAmount = parseFloat(getXmlTag(detXml, "vICMS")) || 0;
    const ipiAmount = parseFloat(getXmlTag(detXml, "vIPI")) || 0;
    const pisAmount = parseFloat(getXmlTag(detXml, "vPIS")) || 0;
    const cofinsAmount = parseFloat(getXmlTag(detXml, "vCOFINS")) || 0;

    items.push({
      itemNumber,
      code,
      description,
      ncm,
      quantity,
      unitValue,
      totalValue,
      icmsAmount,
      ipiAmount,
      pisAmount,
      cofinsAmount,
    });
  });

  // Totais e Tributos
  const totalProducts = parseFloat(getXmlSubtag(xmlContent, "ICMSTot", "vProd")) || items.reduce((acc, i) => acc + i.totalValue, 0);
  const totalDiscount = parseFloat(getXmlSubtag(xmlContent, "ICMSTot", "vDesc")) || 0;
  const totalFreight = parseFloat(getXmlSubtag(xmlContent, "ICMSTot", "vFrete")) || 0;
  const grandTotal = parseFloat(getXmlTag(xmlContent, "vNF")) || parseFloat(getXmlTag(xmlContent, "vServ")) || totalProducts - totalDiscount + totalFreight;

  const icmsTotal = parseFloat(getXmlSubtag(xmlContent, "ICMSTot", "vICMS")) || items.reduce((acc, i) => acc + (i.icmsAmount || 0), 0);
  const ipiTotal = parseFloat(getXmlSubtag(xmlContent, "ICMSTot", "vIPI")) || items.reduce((acc, i) => acc + (i.ipiAmount || 0), 0);
  const pisTotal = parseFloat(getXmlSubtag(xmlContent, "ICMSTot", "vPIS")) || items.reduce((acc, i) => acc + (i.pisAmount || 0), 0);
  const cofinsTotal = parseFloat(getXmlSubtag(xmlContent, "ICMSTot", "vCOFINS")) || items.reduce((acc, i) => acc + (i.cofinsAmount || 0), 0);
  const issTotal = parseFloat(getXmlTag(xmlContent, "vISS")) || 0;

  // IBS e CBS (Estrutura alinhada com a Reforma Tributaria - Lei Complementar 214/2024)
  const ibsEstimate = 0.00;
  const cbsEstimate = 0.00;

  // Linha do tempo de eventos do documento
  const timeline: FiscalTimelineEvent[] = [
    {
      date: dhEmi || documentRecord?.createdAt.toISOString() || new Date().toISOString(),
      title: "Emissão do Documento",
      description: `Documento fiscal emitido sob a chave ${accessKey.slice(0, 20)}...`,
      badge: "emerald",
    },
    {
      date: documentRecord?.createdAt.toISOString() || new Date().toISOString(),
      title: isSummary ? "Recepção de Resumo (resNFe)" : "Recepção de XML Completo (procNFe)",
      description: `Capturado via conector no NSU ${documentRecord?.nsu || "—"}.`,
      badge: isSummary ? "amber" : "blue",
    },
  ];

  if (documentRecord?.manifestationStatus && documentRecord.manifestationStatus !== "PENDING" && documentRecord.manifestationStatus !== "NOT_APPLICABLE") {
    timeline.push({
      date: documentRecord.manifestedAt?.toISOString() || new Date().toISOString(),
      title: `Manifestação: ${documentRecord.manifestationStatus}`,
      description: "Registro de evento fiscal junto ao órgão competente.",
      badge: "violet",
    });
  }

  if (documentRecord?.lastDownloadedAt) {
    timeline.push({
      date: documentRecord.lastDownloadedAt.toISOString(),
      title: "Download Realizado",
      description: "Arquivo exportado para uso contábil ou fiscal.",
      badge: "violet",
    });
  }

  return {
    accessKey,
    kind,
    isSummary,
    number,
    series,
    issuedAt: dhEmi,
    issuer: {
      name: emitName,
      taxId: emitCnpj,
      stateRegistration: emitIE,
      cityUf: emitUf,
    },
    recipient: {
      name: destName,
      taxId: destCnpj,
      stateRegistration: destIE,
      cityUf: destUf,
    },
    items,
    totals: {
      productsTotal: totalProducts,
      servicesTotal: kind.startsWith("NFSE") ? grandTotal : 0,
      discountTotal: totalDiscount,
      freightTotal: totalFreight,
      grandTotal,
    },
    taxes: {
      icmsTotal,
      ipiTotal,
      pisTotal,
      cofinsTotal,
      issTotal,
      ibsEstimate,
      cbsEstimate,
    },
    timeline,
  };
}
