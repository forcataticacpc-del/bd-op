import { SuspectRecord } from '../types';

/**
 * Remove acentos, diacríticos e normaliza caixa para comparações insensíveis a acentos
 * Exemplos:
 * "JOÃO" -> "joao"
 * "Conceição" -> "conceicao"
 * "Tráfico" -> "trafico"
 * "Homicídio" -> "homicidio"
 */
export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Normaliza números para comparação direta de documentos (RG, CPF)
 * Remove pontos, traços, barras e espaços
 */
export function normalizeDigits(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\D/g, '');
}

/**
 * Formata estritamente o CPF no padrão oficial 000.000.000-00
 * Suporta entrada com ou sem pontuação e formatação progressiva
 */
export function formatCPF(str: string | null | undefined): string {
  if (!str) return '';
  const digits = str.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  if (digits.length > 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length > 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  return digits;
}

/**
 * Verifica se um registro de abordado bate com o termo de pesquisa
 * Realiza comparação 100% insensível a acentos, maiúsculas/minúsculas e pontuação
 * Suporta busca por múltiplos termos/palavras em qualquer ordem (ex: "joao 157" ou "mateus silva")
 */
export function matchesSuspect(suspect: SuspectRecord, searchQuery: string): boolean {
  const queryNormalized = normalizeText(searchQuery);
  if (!queryNormalized) return true;

  const queryTokens = queryNormalized.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return true;

  const queryDigits = normalizeDigits(searchQuery);

  // Prepara todos os campos normalizados do abordado
  const nomeNorm = normalizeText(suspect.nome);
  const maeNorm = normalizeText(suspect.mae);
  const paiNorm = normalizeText((suspect as any).pai);
  const alcunhaNorm = normalizeText(suspect.alcunha);
  const artigoNorm = normalizeText(
    `${suspect.artigo || ''} ${(suspect.artigos || []).join(' ')}`
  );
  const enderecoNorm = normalizeText(
    Array.isArray(suspect.enderecos) && suspect.enderecos.length > 0
      ? suspect.enderecos.join(' ')
      : `${suspect.endereco || ''} ${(suspect as any).bairro || ''}`
  );
  const localNorm = normalizeText(suspect.localAbordagem);
  const coordsNorm = normalizeText(
    suspect.coordenadas ||
      (suspect.localAbordagemCoords
        ? `${suspect.localAbordagemCoords.lat}, ${suspect.localAbordagemCoords.lng}`
        : '')
  );
  const obsNorm = normalizeText(suspect.observacoes);
  const rgNorm = normalizeText(suspect.rg);
  const cpfNorm = normalizeText(suspect.cpf);

  const rgDigits = normalizeDigits(suspect.rg);
  const cpfDigits = normalizeDigits(suspect.cpf);

  // Cada palavra digitada pelo operador deve bater em ao menos um dos campos
  return queryTokens.every((token) => {
    const tokenDigits = normalizeDigits(token);

    // Se o token for numérico com 3 ou mais dígitos, checa nos números de RG/CPF
    if (tokenDigits.length >= 3) {
      if (rgDigits.includes(tokenDigits) || cpfDigits.includes(tokenDigits)) {
        return true;
      }
    }

    return (
      nomeNorm.includes(token) ||
      maeNorm.includes(token) ||
      paiNorm.includes(token) ||
      alcunhaNorm.includes(token) ||
      artigoNorm.includes(token) ||
      enderecoNorm.includes(token) ||
      localNorm.includes(token) ||
      coordsNorm.includes(token) ||
      obsNorm.includes(token) ||
      rgNorm.includes(token) ||
      cpfNorm.includes(token)
    );
  });
}

/**
 * Calcula a idade a partir de uma string de data (DD/MM/AAAA ou ISO)
 */
export function calculateAge(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  let birthDate: Date | null = null;
  const brMatch = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    const year = parseInt(brMatch[3], 10);
    birthDate = new Date(year, month, day);
  } else {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      birthDate = parsed;
    }
  }

  if (!birthDate || isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 0 || age > 130) return null;
  return `${age} ${age === 1 ? 'ano' : 'anos'}`;
}
