// Base completa dos Bairros Oficiais e Tradicionais de Belo Horizonte - MG
// Utilizado para comparativo estatístico operacional e filtro de abordados

export const BAIRROS_BELO_HORIZONTE: string[] = [
  'AARÃO REIS',
  'ALÍPIO DE MELO',
  'ALTO DOS PINHEIROS',
  'ALTO VERA CRUZ',
  'ANCHIETA',
  'APARECIDA',
  'ARAGUAIA',
  'BAIRRO DAS INDÚSTRIAS',
  'BANDEIRANTES',
  'BARREIRO',
  'BARREIRO DE BAIXO',
  'BARREIRO DE CIMA',
  'BARROCA',
  'BARRO PRETO',
  'BELVEDERE',
  'BETÂNIA',
  'BOA VIAGEM',
  'BOA VISTA',
  'BONFIM',
  'BURITIS',
  'CABANA DO PAI TOMÁS',
  'CACHOEIRINHA',
  'CAIÇARA',
  'CALAFATE',
  'CAMARGOS',
  'CAMPPO ALEGRE',
  'CANDELÁRIA',
  'CARDOSO',
  'CARLOS PRATES',
  'CARMO',
  'CASTELO',
  'CENTRO',
  'CÉU AZUL',
  'CIDADE JARDIM',
  'CIDADE NOVA',
  'COIMBRA',
  'COLÉGIO BATISTA',
  'CONCÓRDIA',
  'CONJUNTO CALAFATE',
  'CONJUNTO ESPERANÇA',
  'CONJUNTO JARDIM FELICIDADE',
  'CONJUNTO SANTA MARIA',
  'COQUEIROS',
  'CORAÇÃO DE JESUS',
  'CORAÇÃO EUCARÍSTICO',
  'CRUZEIRO',
  'DIAMANTE',
  'DONA CLARA',
  'ENGENHO NOGUEIRA',
  'ESPLANADA',
  'ESTORIL',
  'ESTRELA DALVA',
  'FLÁVIO MARQUES LISBOA',
  'FLORESTA',
  'FUNCIONÁRIOS',
  'GAMELEIRA',
  'GLÓRIA',
  'GRAJAÚ',
  'GUARANI',
  'GUTIERREZ',
  'HAVAI',
  'HELIÓPOLIS',
  'HORTO',
  'IPIRANGA',
  'ITAPOÃ',
  'JAQUELINE',
  'JARAGUÁ',
  'JARDIM AMÉRICA',
  'JARDIM ATLÂNTICO',
  'JARDIM DOS COMERCIÁRIOS',
  'JARDIM FILADÉLFIA',
  'JARDIM GUANABARA',
  'JARDIM LEBLON',
  'JARDIM MONTANHÊS',
  'JARDIM SÃO JOSÉ',
  'JATOBÁ',
  'JOÃO PINHEIRO',
  'JULIANA',
  'LAGOA',
  'LAGOINHA',
  'LETÍCIA',
  'LINDÉIA',
  'LOURDES',
  'MADRE GERTRUDES',
  'MANACÁS',
  'MANGABEIRAS',
  'MANTIQUEIRA',
  'MARAJÓ',
  'MARÇAL',
  'MARIA GORETTI',
  'MARIA HELENA',
  'MARIANO DE ABREU',
  'MILIONÁRIOS',
  'MINAS BRASIL',
  'MINAS CAIXA',
  'MONSENHOR MESSIAS',
  'NAZARÉ',
  'NOVA CACHOEIRINHA',
  'NOVA CINTRA',
  'NOVA ESPERANÇA',
  'NOVA FLORESTA',
  'NOVA GAMELEIRA',
  'NOVA GRANADA',
  'NOVA SUÍÇA',
  'NOVO AARÃO REIS',
  'NOVO GLÓRIA',
  'OESTE',
  'OLHOS D\'ÁGUA',
  'OURO PRETO',
  'PADRE EUSTÁQUIO',
  'PALMARES',
  'PALMEIRAS',
  'PAQUETÁ',
  'PARAÍSO',
  'PAQUETÁ',
  'PEDREIRA PRADO LOPES',
  'PILAR',
  'PINDORAMA',
  'PIRATININGA',
  'PLANALTO',
  'POMPEIA',
  'PONGELUPE',
  'PRADO',
  'PRIMEIRO DE MAIO',
  'PROVIDÊNCIA',
  'RENASCENÇA',
  'RIBEIRO DE ABREU',
  'RIO BRANCO',
  'SAGRADA FAMÍLIA',
  'SALGADO FILHO',
  'SANTA AMÉLIA',
  'SANTA BRANCA',
  'SANTA CRUZ',
  'SANTA EFIGÊNIA',
  'SANTA HELENA',
  'SANTA INÊS',
  'SANTA LÚCIA',
  'SANTA MÔNICA',
  'SANTA ROSA',
  'SANTA TEREZA',
  'SANTO AGOSTINHO',
  'SANTO ANDRÉ',
  'SANTO ANTÔNIO',
  'SÃO BENEDITO',
  'SÃO BENTO',
  'SÃO BERNARDO',
  'SÃO CRISTÓVÃO',
  'SÃO FRANCISCO',
  'SÃO GABRIEL',
  'SÃO GERALDO',
  'SÃO JOÃO BATISTA',
  'SÃO JORGE',
  'SÃO JOSÉ',
  'SÃO LUCAS',
  'SÃO LUIZ',
  'SÃO PAULO',
  'SÃO PEDRO',
  'SÃO SALVADOR',
  'SÃO TOMAZ',
  'SAUDADE',
  'SAVASSI',
  'SERRA',
  'SERRA DO CURRAL',
  'SERRA VERDE',
  'SERRANO',
  'SILVEIRA',
  'SION',
  'TAQUARIL',
  'TIROL',
  'TUPI',
  'UNIÃO',
  'VALE DO JATOBÁ',
  'VENDA NOVA',
  'VERA CRUZ',
  'VILA CLÓRIS',
  'VILA DA PAZ',
  'VILA FORMOSA',
  'VILA NOSSA SENHORA DE FÁTIMA',
  'VILA PARIS',
  'VISTA ALEGRE',
  'XODÓ-MARIZE',
];

// Normaliza texto para comparações robustas (sem acentos e pontuação)
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export interface BairroCount {
  bairro: string;
  total: number;
}

/**
 * Faz a correspondência dos endereços dos abordados com os bairros de BH.
 * Retorna contagem de abordados para cada bairro, ordenados primeiro pelos bairros
 * com maior número de abordados cadastrados.
 */
export function countSuspectsByBairro(suspects: { endereco?: string }[]): {
  bairrosComAbordados: BairroCount[];
  todosBairros: BairroCount[];
  totalAbordadosComBairro: number;
} {
  const countsMap = new Map<string, number>();

  // Inicializa com todos os bairros com 0
  BAIRROS_BELO_HORIZONTE.forEach((b) => {
    countsMap.set(b, 0);
  });

  // Analisa cada abordado
  let totalComBairro = 0;

  suspects.forEach((s) => {
    const end = normalizeText(s.endereco || '');
    if (!end) return;

    let matchedBairro: string | null = null;

    // Busca bairro no endereço
    for (const b of BAIRROS_BELO_HORIZONTE) {
      const bNorm = normalizeText(b);
      // Regex que testa se o bairro está como palavra isolada ou precedido por '-' / ','
      const regex = new RegExp(`(^|[-/,\\s])${bNorm}([-/,\\s]|$)`, 'i');
      if (regex.test(end) || end.includes(bNorm)) {
        matchedBairro = b;
        break;
      }
    }

    if (matchedBairro) {
      countsMap.set(matchedBairro, (countsMap.get(matchedBairro) || 0) + 1);
      totalComBairro++;
    }
  });

  const todosBairros: BairroCount[] = [];
  const bairrosComAbordados: BairroCount[] = [];

  BAIRROS_BELO_HORIZONTE.forEach((b) => {
    const total = countsMap.get(b) || 0;
    const item = { bairro: b, total };
    todosBairros.push(item);
    if (total > 0) {
      bairrosComAbordados.push(item);
    }
  });

  // Ordena os com abordados do maior para o menor
  bairrosComAbordados.sort((a, b) => b.total - a.total || a.bairro.localeCompare(b.bairro));

  // Ordena todos: primeiro os que têm > 0 decrescente, depois alfabético
  todosBairros.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.bairro.localeCompare(b.bairro);
  });

  return {
    bairrosComAbordados,
    todosBairros,
    totalAbordadosComBairro: totalComBairro,
  };
}
