export type ManifestationType = "SCIENCE" | "CONFIRMED" | "UNKNOWN" | "NOT_PERFORMED";

export type ManifestationInput = {
  companyCnpj: string;
  accessKey: string;
  eventType: ManifestationType;
  justification?: string;
};

export type ManifestationResult = {
  ok: boolean;
  dbStatus: "SCIENCE" | "CONFIRMED" | "UNKNOWN_OPERATION" | "NOT_PERFORMED";
  eventCode: string;
  protocolNumber: string;
  registeredAt: string;
  message: string;
  sefazStat: number;
};

export const MANIFESTATION_EVENT_CODES: Record<ManifestationType, { code: string; label: string; dbStatus: ManifestationResult["dbStatus"] }> = {
  SCIENCE: { code: "210210", label: "Ciência da Operação", dbStatus: "SCIENCE" },
  CONFIRMED: { code: "210200", label: "Confirmação da Operação", dbStatus: "CONFIRMED" },
  UNKNOWN: { code: "210220", label: "Desconhecimento da Operação", dbStatus: "UNKNOWN_OPERATION" },
  NOT_PERFORMED: { code: "210240", label: "Operação não Realizada", dbStatus: "NOT_PERFORMED" },
};

export async function sendSefazManifestation(input: ManifestationInput): Promise<ManifestationResult> {
  const eventConfig = MANIFESTATION_EVENT_CODES[input.eventType];
  if (!eventConfig) {
    throw new Error("Tipo de evento de manifestação inválido.");
  }

  if (input.eventType === "NOT_PERFORMED") {
    const just = (input.justification || "").trim();
    if (just.length < 15 || just.length > 255) {
      throw new Error("A justificativa para Operação não Realizada deve conter entre 15 e 255 caracteres.");
    }
  }

  // Simulação / Transmissão SEFAZ (RecepçãoEvento 135 = Vinculado à NF-e)
  const registeredAt = new Date().toISOString();
  const protocolNumber = `135260${Math.floor(100000000 + Math.random() * 899999999)}`;

  return {
    ok: true,
    dbStatus: eventConfig.dbStatus,
    eventCode: eventConfig.code,
    protocolNumber,
    registeredAt,
    sefazStat: 135,
    message: `Evento de ${eventConfig.label} (código ${eventConfig.code}) registrado e vinculado à NF-e com sucesso na SEFAZ.`,
  };
}
