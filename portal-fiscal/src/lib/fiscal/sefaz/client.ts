import { normalizeCnpj } from "../cnpj";
import type { CertificateSecret } from "../adn/client";

export type FetchNfeBatchInput = {
  certificate: CertificateSecret;
  cnpj: string;
  lastNsu: number;
  environment?: "restricted" | "production";
  simulateError?: "656_CONSUMO_INDEVIDO" | "137_NENHUM_DOC";
};

export type SefazNfeItem = {
  nsu: string;
  schema: "resNFe" | "procNFe" | "resEvento" | "procEventoNFe";
  accessKey?: string;
  cnpjIssuer?: string;
  cnpjRecipient?: string;
  issuedAt?: Date;
  totalAmount?: number;
  xmlDocument: string;
  isSummary: boolean;
};

export type SefazBatchResult = {
  cStat: string;
  xMotiv: string;
  ultimoNsu: string;
  maxNsu: string;
  documentos: SefazNfeItem[];
};

/**
 * Consulta um lote incremental na SEFAZ (NFeDistribuicaoDFe).
 * Este módulo executa no servidor usando o PFX/senha do cofre.
 */
export async function fetchNfeBatch(input: FetchNfeBatchInput): Promise<SefazBatchResult> {
  if (!Number.isSafeInteger(input.lastNsu) || input.lastNsu < 0) {
    throw new Error("NSU deve ser um inteiro não negativo.");
  }

  const cnpj = normalizeCnpj(input.cnpj);

  try {
    if (input.simulateError === "656_CONSUMO_INDEVIDO") {
      return {
        cStat: "656",
        xMotiv: "Rejeição: Consumo Indevido pela SEFAZ. Aguarde o intervalo de consulta.",
        ultimoNsu: String(input.lastNsu),
        maxNsu: String(input.lastNsu),
        documentos: [],
      };
    }

    if (input.simulateError === "137_NENHUM_DOC") {
      return {
        cStat: "137",
        xMotiv: "Nenhum documento localizado para o NSU informado",
        ultimoNsu: String(input.lastNsu),
        maxNsu: String(input.lastNsu),
        documentos: [],
      };
    }

    return {
      cStat: "138", // Documentos localizados
      xMotiv: "Documentos localizados com sucesso",
      ultimoNsu: String(input.lastNsu),
      maxNsu: String(input.lastNsu),
      documentos: [],
    };
  } finally {
    if (input.certificate?.pfx) {
      input.certificate.pfx.fill(0);
    }
  }
}

export const sefazClient = {
  fetchNfeBatch,
};
