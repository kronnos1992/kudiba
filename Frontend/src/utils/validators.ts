/**
 * Utilitários e Regex de Validação Fiscal e Documental (Angola)
 * Regulamentação AGT / BNA / DNIC
 */

export const REGEX_COMPANY_NIF = /^\d{10}$/;
export const REGEX_ANGOLAN_BI = /^\d{9}[A-Z]{2}\d{3}$/;
export const REGEX_FINAL_CONSUMER = /^999999999$/;
export const REGEX_FOREIGN_TAX_ID = /^[A-Z0-9.\-]{3,30}$/i;
export const REGEX_ANGOLAN_IBAN = /^AO06\d{21}$/;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida o NIF de Pessoa Coletiva (Empresa) em Angola.
 * Deve conter exatamente 10 dígitos numéricos (geralmente iniciado por 50 ou 54).
 */
export function validateCompanyNif(nif: string): ValidationResult {
  const cleaned = nif.trim();
  if (!cleaned) {
    return { isValid: false, error: 'O NIF de pessoa coletiva é obrigatório.' };
  }
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, error: 'O NIF de empresa deve conter apenas números.' };
  }
  if (cleaned.length !== 10) {
    return {
      isValid: false,
      error: `O NIF de empresa deve ter exatamente 10 dígitos (atual: ${cleaned.length}).`,
    };
  }
  if (cleaned === '9999999999' || cleaned === '0000000000') {
    return { isValid: false, error: 'O NIF indicado não é válido para pessoa coletiva.' };
  }
  return { isValid: true };
}

/**
 * Valida o Bilhete de Identidade (BI) / NIF de Pessoa Singular angolano.
 * Formato oficial: 9 dígitos + 2 letras + 3 dígitos (ex: 000123456LA012, total 14 caracteres).
 */
export function validateAngolanBI(bi: string): ValidationResult {
  const cleaned = bi.trim().toUpperCase();
  if (!cleaned) {
    return { isValid: false, error: 'O número do Bilhete de Identidade (BI) é obrigatório.' };
  }
  if (cleaned.length !== 14) {
    return {
      isValid: false,
      error: `O BI deve ter exatamente 14 caracteres (9 dígitos + 2 letras maiúsculas + 3 dígitos). Atual: ${cleaned.length}.`,
    };
  }
  if (!REGEX_ANGOLAN_BI.test(cleaned)) {
    return {
      isValid: false,
      error: 'Formato de BI inválido. Exemplo correto: 000123456LA012.',
    };
  }
  return { isValid: true };
}

/**
 * Valida o identificador de Consumidor Final.
 * Padrão fiscal canónico da AGT: 999999999 (9 dígitos).
 */
export function validateFinalConsumer(nif: string): ValidationResult {
  const cleaned = nif.trim();
  if (cleaned !== '999999999') {
    return { isValid: false, error: "O NIF de Consumidor Final deve ser exatamente '999999999'." };
  }
  return { isValid: true };
}

/**
 * Valida NIF estrangeiro (mínimo 3 caracteres alfanuméricos).
 */
export function validateForeignTaxId(taxId: string): ValidationResult {
  const cleaned = taxId.trim().toUpperCase();
  if (cleaned.length < 3 || cleaned.length > 30) {
    return { isValid: false, error: 'NIF estrangeiro deve ter entre 3 e 30 caracteres.' };
  }
  if (!REGEX_FOREIGN_TAX_ID.test(cleaned)) {
    return { isValid: false, error: 'NIF estrangeiro contém caracteres inválidos.' };
  }
  return { isValid: true };
}

/**
 * Validador unificado de acordo com o tipo selecionado no formulário.
 */
export function validateTaxId(
  taxId: string,
  kind: 'LEGAL_ENTITY' | 'NATURAL_PERSON_BI' | 'FINAL_CONSUMER' | 'FOREIGN' | string
): ValidationResult {
  switch (kind) {
    case 'LEGAL_ENTITY':
      return validateCompanyNif(taxId);
    case 'NATURAL_PERSON_BI':
      return validateAngolanBI(taxId);
    case 'FINAL_CONSUMER':
      return validateFinalConsumer(taxId);
    case 'FOREIGN':
      return validateForeignTaxId(taxId);
    default:
      if (!taxId.trim()) return { isValid: false, error: 'Identificador fiscal obrigatório.' };
      return { isValid: true };
  }
}

/**
 * Valida o NIF de cliente para emissão de faturas:
 * - 999999999: Consumidor Final (canónico AGT)
 * - 10 dígitos: Pessoa Coletiva / Empresa
 * - 14 caracteres: Bilhete de Identidade Angolano (9 dígitos + 2 letras + 3 dígitos)
 * - 3 a 30 caracteres alfanuméricos: NIF Estrangeiro
 */
export function validateInvoiceCustomerNif(nif: string): ValidationResult {
  const cleaned = nif.trim().toUpperCase();
  if (!cleaned) {
    return { isValid: false, error: 'O NIF do cliente é obrigatório.' };
  }
  if (cleaned === '999999999') {
    return { isValid: true };
  }
  if (/^\d{10}$/.test(cleaned)) {
    return { isValid: true };
  }
  if (REGEX_ANGOLAN_BI.test(cleaned)) {
    return { isValid: true };
  }
  if (REGEX_FOREIGN_TAX_ID.test(cleaned) && cleaned.length >= 3) {
    return { isValid: true };
  }
  if (/^\d+$/.test(cleaned) && cleaned.length !== 10) {
    return {
      isValid: false,
      error: `NIF numérico inválido. Deve ter 10 dígitos (empresa) ou 999999999 (consumidor final). Atual: ${cleaned.length} dígitos.`,
    };
  }
  if (cleaned.length === 14) {
    return {
      isValid: false,
      error: 'Formato de BI incorreto. Deve conter 9 dígitos + 2 letras + 3 dígitos (ex: 000123456LA012).',
    };
  }
  return {
    isValid: false,
    error: 'NIF inválido. Utilize 10 dígitos (empresa), 14 caracteres (BI) ou 999999999.',
  };
}

/**
 * Valida o IBAN angolano segundo a norma do Banco Nacional de Angola (BNA).
 * Começa por AO06 seguido de 21 dígitos numéricos (total 25 caracteres).
 */
export function validateAngolanIBAN(iban: string): ValidationResult {
  const cleaned = iban.replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return { isValid: true }; // Opcional se vazio
  if (!cleaned.startsWith('AO06')) {
    return { isValid: false, error: "O IBAN angolano deve começar com 'AO06'." };
  }
  if (cleaned.length !== 25) {
    return {
      isValid: false,
      error: `O IBAN angolano deve conter 25 caracteres (AO06 + 21 dígitos). Atual: ${cleaned.length}.`,
    };
  }
  if (!REGEX_ANGOLAN_IBAN.test(cleaned)) {
    return { isValid: false, error: 'O IBAN angolano deve conter apenas dígitos após AO06.' };
  }
  return { isValid: true };
}

/**
 * Formata um IBAN angolano em blocos de 4 dígitos para melhor legibilidade.
 * Ex: AO06 0040 0000 1234 5678 9012 3
 */
export function formatAngolanIBAN(raw: string): string {
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  const chunks = cleaned.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : cleaned;
}
