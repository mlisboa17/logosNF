/**
 * CNPJ Formatter & Validator
 * Utilities para formatação e validação de CNPJ no cliente e servidor
 */

/**
 * Remove caracteres não numéricos de uma string CNPJ
 */
export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/**
 * Formata CNPJ com máscara: XX.XXX.XXX/XXXX-XX
 */
export function formatCnpj(cnpj: string): string {
  const clean = cleanCnpj(cnpj);
  if (clean.length !== 14) return clean;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
}

/**
 * Valida CNPJ (cálculo de dígitos verificadores)
 * @param cnpj CNPJ com ou sem formatação
 * @returns true se CNPJ é válido
 */
export function isValidCnpj(cnpj: string): boolean {
  const clean = cleanCnpj(cnpj);

  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false; // 11111111111111, 00000000000000, etc

  let sum = 0;
  let remainder = 0;

  // Validar primeiro dígito verificador
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i]) * (5 - (i % 8));
  }
  remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(clean[12]) !== digit1) return false;

  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean[i]) * (6 - (i % 8));
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  return parseInt(clean[13]) === digit2;
}

/**
 * Máscara progressiva para input de CNPJ (para uso em onChange)
 * Mantém o formato XX.XXX.XXX/XXXX-XX conforme o usuário digita
 */
export function maskCnpj(input: string): string {
  const clean = cleanCnpj(input);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  if (clean.length <= 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  if (clean.length <= 12) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8)}`;
  }
  return formatCnpj(clean);
}

/**
 * Validação com feedback estruturado para UI
 */
export function validateCnpjInput(cnpj: string): {
  isValid: boolean;
  formatted: string;
  error?: string;
} {
  const clean = cleanCnpj(cnpj);

  if (!clean) {
    return { isValid: false, formatted: "", error: "CNPJ é obrigatório" };
  }

  if (clean.length < 14) {
    return { isValid: false, formatted: maskCnpj(cnpj), error: `CNPJ incompleto (${clean.length}/14)` };
  }

  if (clean.length > 14) {
    return { isValid: false, formatted: formatCnpj(clean.slice(0, 14)), error: "CNPJ muito longo" };
  }

  if (!isValidCnpj(clean)) {
    return { isValid: false, formatted: formatCnpj(clean), error: "CNPJ inválido (dígitos verificadores)" };
  }

  return { isValid: true, formatted: formatCnpj(clean) };
}
