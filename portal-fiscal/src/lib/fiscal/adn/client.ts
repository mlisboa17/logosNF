import { Ambiente, NfseClient, type NsuQueryResult } from "open-nfse";
import { normalizeCnpj } from "../cnpj";

export type CertificateSecret = {
  pfx: Buffer;
  password: string;
};

export type FetchNfseBatchInput = {
  certificate: CertificateSecret;
  cnpj: string;
  lastNsu: number;
  environment?: "restricted" | "production";
};

/**
 * Consulta um lote incremental no ADN. Este módulo só pode ser chamado no servidor.
 * O chamador deve obter certificate a partir do cofre e descartá-lo após a chamada.
 */
export async function fetchNfseBatch(input: FetchNfseBatchInput): Promise<NsuQueryResult> {
  if (!Number.isSafeInteger(input.lastNsu) || input.lastNsu < 0) {
    throw new Error("NSU deve ser um inteiro não negativo.");
  }

  const client = new NfseClient({
    ambiente: input.environment === "production" ? Ambiente.Producao : Ambiente.ProducaoRestrita,
    certificado: input.certificate,
    timeoutMs: 30_000,
  });

  try {
    return await client.fetchByNsu({
      ultimoNsu: input.lastNsu,
      cnpjConsulta: normalizeCnpj(input.cnpj),
      lote: true,
    });
  } finally {
    await client.close();
    input.certificate.pfx.fill(0);
  }
}

export const adnClient = {
  fetchNfseBatch,
};

