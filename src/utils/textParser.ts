/**
 * Utilitário de Parsing Inteligente de Texto Bruto para Abordados do Banco de Dados
 * Suporta formatos com tags/rótulos, sem tags (texto corrido ou em linhas livres) e mistos.
 * Descarta completamente referências a veículos.
 */

import { formatCPF } from './textUtils';

export interface ParsedRecordData {
  nome: string;
  mae: string;
  dataNasc: string;
  rg: string;
  cpf: string;
  enderecos: string[];
  alcunha: string;
  artigos: string[];
  artigo: string;
  observacoes: string;
}

/**
 * Remove pontuação excessiva nas extremidades
 */
function cleanString(val: string): string {
  return val.trim().replace(/^[\s,;.-]+|[\s,;.-]+$/g, '');
}

/**
 * Verifica se uma linha parece ser nome próprio de pessoa (masculino ou feminino)
 * - Pelo menos duas palavras
 * - Apenas letras, acentos e espaços
 * - Sem números, sem pontuação de endereço (vírgula, barras, etc.)
 */
function isPersonFullName(text: string): boolean {
  const trimmed = cleanString(text);
  if (trimmed.length < 4 || trimmed.length > 70) return false;

  // Não pode conter números ou símbolos de endereço/datas
  if (/[\d\/\\]/.test(trimmed)) return false;
  if (trimmed.includes(',')) return false;

  // Não pode ser palavras-chave de sistema ou crimes
  const upper = trimmed.toUpperCase();
  if (
    /^(?:TRAFICO|TRÁFICO|ROUBO|FURTO|HOMICIDIO|HOMICÍDIO|RECEPTACAO|RECEPTAÇÃO|PORTE|POSSE|MANDADO|ESTELIONATO|LESAO|LESÃO|AMEACA|AMEAÇA|CRIME|ARTIGO|POLICIA|POLÍCIA|BATALHAO|BATALHÃO|OBS|OBSERVACOES|OBSERVAÇÕES)/.test(
      upper
    )
  ) {
    return false;
  }

  // Permite letras latinas (incluindo acentuadas em pt-BR), apóstrofo e espaços
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2) return false;

  return /^[A-Za-zÀ-ÖØ-öø-ÿ'\s]+$/.test(trimmed);
}

/**
 * Processador Inteligente Unificado de Texto de Ficha Policial
 */
export function parseRawSuspectText(rawText: string): ParsedRecordData {
  const result: ParsedRecordData = {
    nome: '',
    mae: '',
    dataNasc: '',
    rg: '',
    cpf: '',
    enderecos: [],
    alcunha: '',
    artigos: [],
    artigo: '',
    observacoes: '',
  };

  if (!rawText || !rawText.trim()) {
    return result;
  }

  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const remainingLines: string[] = [];

  for (let originalLine of rawLines) {
    let line = originalLine;

    // 0. Ignora linhas de dados de veículos (VEICU / VEICULO / PLACA / CHASSI)
    if (/^(VEICU|VEICULO|VEÍCULO|PLACA|CHASSI|CARRO|MOTO)\s*[:=-]/i.test(line)) {
      continue;
    }

    // 1. Tag explícita de Nome do Abordado
    const nomeTag = line.match(
      /^(?:NOME|NOME\s*DO\s*ABORDADO|INDIV[IÍ]DUO|SUSPEITO|AUTOR|ENVOLVIDO)\s*[:=-]\s*(.+)$/i
    );
    if (nomeTag && !result.nome) {
      result.nome = cleanString(nomeTag[1]).toUpperCase();
      continue;
    }

    // 2. Tag explícita de Mãe
    const maeTag = line.match(
      /^(?:MAE|MÃE|NOME\s*DA\s*M[AÃ]E|FILHO\s*DE|FILIA[CÇ][AÃ]O)\s*[:=-]\s*(.+)$/i
    );
    if (maeTag && !result.mae) {
      result.mae = cleanString(maeTag[1]).toUpperCase();
      continue;
    }

    // 3. CPF (com ou sem tag 'CPF:', 'Cpf:', 'CPF', 'C.P.F.')
    const cpfMatch = line.match(
      /(?:CPF|C\.P\.F\.?)?\s*[:=-]?\s*(\b\d{3}\.?\d{3}\.?\d{3}[-\s]?\d{2}\b|\b\d{11}\b)/i
    );
    if (!result.cpf && cpfMatch && cpfMatch[1]) {
      const cleanDigits = cpfMatch[1].replace(/\D/g, '');
      if (cleanDigits.length === 11) {
        result.cpf = formatCPF(cleanDigits);
        // Remove CPF da linha; se sobrou conteúdo útil, continua a linha
        const leftover = line
          .replace(cpfMatch[0], '')
          .replace(/^(?:CPF|C\.P\.F\.?)\s*[:=-]?/i, '')
          .trim();
        if (!leftover) continue;
        line = leftover;
      }
    }

    // 4. Data de nascimento (com ou sem tag 'NASC:', 'NASCIMENTO:', 'DATA NASC:')
    const dateMatch = line.match(
      /(?:NASC(?:IMENTO)?|DATA\s*DE\s*NASC(?:IMENTO)?|DN)\s*[:=-]?\s*(\b\d{2}[\/\.-]\d{2}[\/\.-]\d{4}\b)/i
    ) || line.match(/(\b\d{2}[\/\.-]\d{2}[\/\.-]\d{4}\b)/);
    if (!result.dataNasc && dateMatch && dateMatch[1]) {
      result.dataNasc = dateMatch[1].replace(/[\.-]/g, '/');
      const leftover = line
        .replace(dateMatch[0], '')
        .replace(/^(?:NASC(?:IMENTO)?|DATA\s*DE\s*NASC(?:IMENTO)?|DN)\s*[:=-]?/i, '')
        .trim();
      if (!leftover) continue;
      line = leftover;
    }

    // 5. RG / Documento de Identidade
    // Ex: 'RG 23982029', 'RG: 23982029', 'RG MG-12.345.678', 'MG-12345678', 'IDENTIDADE 12345678'
    const rgTagMatch = line.match(
      /^(?:RG|IDENTIDADE|DOC|DOCUMENTO)\s*[:=-]?\s*([a-zA-Z0-9.\/-]+)$/i
    );
    if (!result.rg && rgTagMatch) {
      result.rg = rgTagMatch[1].toUpperCase().replace(/\s+/g, '');
      continue;
    }

    const rgInlineMatch = line.match(
      /\b(?:RG|IDENTIDADE|DOC)\s*[:=-]?\s*([a-zA-Z0-9.-]{6,14})\b/i
    );
    if (!result.rg && rgInlineMatch) {
      result.rg = rgInlineMatch[1].toUpperCase().replace(/\s+/g, '');
      const leftover = line.replace(rgInlineMatch[0], '').trim();
      if (!leftover) continue;
      line = leftover;
    }

    const rgMgMatch = line.match(/\b(MG[-\s]?[0-9.\/-]{6,12})\b/i);
    if (!result.rg && rgMgMatch) {
      result.rg = rgMgMatch[1].toUpperCase().replace(/\s+/g, '');
      const leftover = line.replace(rgMgMatch[0], '').trim();
      if (!leftover) continue;
      line = leftover;
    }

    // 6. Alcunha / Vulgo
    const vulgoTagMatch = line.match(
      /^(?:VULGO|ALCUNHA|APELIDO)\s*[:=-]\s*['"]?([^'"\n]+)['"]?$/i
    );
    if (!result.alcunha && vulgoTagMatch) {
      result.alcunha = cleanString(vulgoTagMatch[1]).toUpperCase();
      continue;
    }
    const vulgoInlineMatch = line.match(
      /(?:VULGO|ALCUNHA|APELIDO)\s*[:=-]?\s*['"]([^'"]+)['"]/i
    );
    if (!result.alcunha && vulgoInlineMatch) {
      result.alcunha = cleanString(vulgoInlineMatch[1]).toUpperCase();
      continue;
    }

    // 7. Artigo Penal / Crime
    // Ex: 'Trafico art 33', 'Art. 157', 'Artigo 33', 'ART: 157, 33'
    const artTagMatch = line.match(
      /^(?:ART(?:IGO)?|CRIME|DELITO|INFRA[CÇ][AÃ]O)\s*[:=-]\s*(.+)$/i
    );
    if (artTagMatch) {
      const artVal = cleanString(artTagMatch[1]).toUpperCase();
      if (!result.artigos.includes(artVal)) result.artigos.push(artVal);
      continue;
    }

    const artInlineMatch = line.match(
      /\b(?:ART(?:IGO)?\.?\s*(\d+[A-Za-z]?|[IVXLCDM]+)(?:\s*(?:C\/C|§|PAR[AÁ]GRAFO|INCISO)[^\n,]*)*)/i
    );
    if (artInlineMatch) {
      const artStr = cleanString(line).toUpperCase();
      if (!result.artigos.includes(artStr)) result.artigos.push(artStr);
      continue;
    }

    // 8. Endereço com tag explícita
    const endTagMatch = line.match(
      /^(?:END(?:ERE[CÇ]O)?|RESID[EÊ]NCIA|LOCAL|MORADIA)\s*[:=-]\s*(.+)$/i
    );
    if (endTagMatch) {
      result.enderecos.push(cleanString(endTagMatch[1]).toUpperCase());
      continue;
    }

    // 9. Endereço típico com prefixo de logradouro conhecido
    if (
      /^(?:RUA|AV|AVENIDA|TRAVESSA|TRAV|ALAMEDA|AL|BECO|PRAÇA|PRACA|RODOVIA|ESTRADA|ROD|EST)\b/i.test(
        line
      )
    ) {
      result.enderecos.push(cleanString(line).toUpperCase());
      continue;
    }

    // 10. Endereço típico: Nome de rua seguido de número (ex: 'JAIME SALSE, 549.' ou 'JAIME SALSE 549')
    const hasStreetWithNumber =
      /[a-zA-Z]{3,}/.test(line) &&
      /(?:,\s*\d+|\s+N[º°o]?\s*\d+|\s+\d+\.?$)/i.test(line) &&
      !/\b\d{2}\/\d{2}\/\d{4}\b/.test(line);

    if (hasStreetWithNumber) {
      result.enderecos.push(cleanString(line).toUpperCase());
      continue;
    }

    remainingLines.push(line);
  }

  // --------------------------------------------------------------------------
  // Processamento inteligente das linhas sem tags explícitas
  // Conforme requisito:
  // "o texto pode vir assim, porém o primeiro nome completo que vier,
  // pode ser masculino ou feminino devendo a app verificar os dados e
  // colocar nas tags do novo registro."
  // --------------------------------------------------------------------------
  for (const rawRemaining of remainingLines) {
    const trimmed = cleanString(rawRemaining);
    if (!trimmed) continue;

    // A. Apelido / Alcunha entre aspas (ex: "PARDAL")
    if (!result.alcunha && /^["'][^"']+["']$/.test(trimmed)) {
      result.alcunha = trimmed.replace(/["']/g, '').toUpperCase();
      continue;
    }

    // B. Primeiro nome completo encontrado = Nome do Abordado
    //    Segundo nome completo encontrado = Nome da Mãe
    if (isPersonFullName(trimmed)) {
      if (!result.nome) {
        result.nome = trimmed.toUpperCase();
        continue;
      } else if (!result.mae) {
        result.mae = trimmed.toUpperCase();
        continue;
      }
    }

    // C. Endereço restante (se ainda não temos endereço e a linha possui número ou vírgula)
    if (
      result.enderecos.length === 0 &&
      (trimmed.includes(',') || /\d+/.test(trimmed)) &&
      !trimmed.toLowerCase().includes('pista') &&
      !trimmed.toLowerCase().includes('art')
    ) {
      result.enderecos.push(trimmed.toUpperCase());
      continue;
    }

    // D. Crime típico isolado (caso ainda não tenhamos artigo penal)
    if (
      result.artigos.length === 0 &&
      /^(?:TR[AÁ]FICO|ROUBO|FURTO|HOMIC[IÍ]DIO|RECEPTA[CÇ][AÃ]O|ESTELIONATO|PORTE|POSSE|MANDADO|AMEA[CÇ]A|AGRESS[AÃ]O)/i.test(
        trimmed
      )
    ) {
      result.artigos.push(trimmed.toUpperCase());
      continue;
    }

    // E. Informações operacionais, detalhes, modus operandi ou notas vão para Observações
    if (result.observacoes) {
      result.observacoes += `\n${trimmed}`;
    } else {
      result.observacoes = trimmed;
    }
  }

  // Consolidação final do artigo penal
  if (result.artigos.length > 0) {
    result.artigo = result.artigos.join(', ');
  }

  return result;
}
