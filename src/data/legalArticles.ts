export interface LegalArticle {
  code: string; // Ex: 'Art. 157'
  legislation: string; // Ex: 'Código Penal' ou 'Lei 11.343/06'
  label: string; // Ex: 'Art. 157 do CP - Roubo'
  name: string; // Ex: 'Roubo'
  shortFormatted: string; // Ex: '(157 - Roubo)'
  category: 'CP' | 'DROGAS' | 'ARMAS' | 'CTB' | 'ESPECIAIS' | 'CONTRAVENCOES';
  keywords: string[]; // Termos de busca populares
}

export const POPULAR_POLICE_ARTICLES: LegalArticle[] = [
  {
    code: 'Art. 157 do CP',
    legislation: 'Código Penal',
    label: 'Art. 157 do CP - Roubo',
    name: 'Roubo',
    shortFormatted: '(157 - Roubo)',
    category: 'CP',
    keywords: ['157', 'roubo', 'assalto', 'arma', 'subtracao', 'violencia', 'cp'],
  },
  {
    code: 'Art. 33 da Lei 11.343/06',
    legislation: 'Lei de Drogas',
    label: 'Art. 33 da Lei 11.343/06 - Tráfico de Drogas',
    name: 'Tráfico de Drogas',
    shortFormatted: '(33 - Tráfico)',
    category: 'DROGAS',
    keywords: ['33', 'trafico', 'drogas', 'entorpecente', 'lei de drogas', 'boca', 'maconha', 'cocaina', 'crack'],
  },
  {
    code: 'Art. 155 do CP',
    legislation: 'Código Penal',
    label: 'Art. 155 do CP - Furto',
    name: 'Furto',
    shortFormatted: '(155 - Furto)',
    category: 'CP',
    keywords: ['155', 'furto', 'subtracao', 'arrombamento', 'cp'],
  },
  {
    code: 'Art. 121 do CP',
    legislation: 'Código Penal',
    label: 'Art. 121 do CP - Homicídio',
    name: 'Homicídio',
    shortFormatted: '(121 - Homicidio)',
    category: 'CP',
    keywords: ['121', 'homicidio', 'assassinato', 'morte', 'feminicidio', 'cp'],
  },
  {
    code: 'Art. 129 do CP',
    legislation: 'Código Penal',
    label: 'Art. 129 do CP - Lesão Corporal',
    name: 'Lesão Corporal',
    shortFormatted: '(129 - Lesão corporal)',
    category: 'CP',
    keywords: ['129', 'lesao corporal', 'agressao', 'briga', 'cp'],
  },
  {
    code: 'Art. 16 da Lei 10.826/03',
    legislation: 'Estatuto do Desarmamento',
    label: 'Art. 16 da Lei 10.826/03 - Porte de Arma Restrita/Raspada',
    name: 'Porte Ilegal de Arma de Uso Restrito / Numeração Raspada',
    shortFormatted: '(16 - Porte de Arma Restrita)',
    category: 'ARMAS',
    keywords: ['16', 'porte', 'arma', 'raspada', 'restrito', 'desarmamento', 'revolver', 'pistola', 'fuzil'],
  },
  {
    code: 'Art. 14 da Lei 10.826/03',
    legislation: 'Estatuto do Desarmamento',
    label: 'Art. 14 da Lei 10.826/03 - Porte Ilegal de Arma Permitida',
    name: 'Porte Ilegal de Arma de Uso Permitido',
    shortFormatted: '(14 - Porte de Arma Permitida)',
    category: 'ARMAS',
    keywords: ['14', 'porte', 'arma', 'permitido', 'desarmamento'],
  },
  {
    code: 'Art. 306 do CTB',
    legislation: 'Código de Trânsito Brasileiro',
    label: 'Art. 306 do CTB - Embriaguez ao Volante',
    name: 'Embriaguez ao Volante / Condução sob Álcool',
    shortFormatted: '(306 - Embriaguez ao Volante)',
    category: 'CTB',
    keywords: ['306', 'ctb', 'transito', 'embriaguez', 'alcool', 'volante', 'bafometro', 'beber'],
  },
  {
    code: 'Art. 180 do CP',
    legislation: 'Código Penal',
    label: 'Art. 180 do CP - Receptação',
    name: 'Receptação',
    shortFormatted: '(180 - Receptação)',
    category: 'CP',
    keywords: ['180', 'receptacao', 'produto de furto', 'desmanche', 'cp'],
  },
  {
    code: 'Art. 288 do CP',
    legislation: 'Código Penal',
    label: 'Art. 288 do CP - Associação Criminosa',
    name: 'Associação Criminosa (Quadrilha)',
    shortFormatted: '(288 - Associação Criminosa)',
    category: 'CP',
    keywords: ['288', 'associacao', 'quadrilha', 'bando', 'cp'],
  },
  {
    code: 'Art. 35 da Lei 11.343/06',
    legislation: 'Lei de Drogas',
    label: 'Art. 35 da Lei 11.343/06 - Associação para o Tráfico',
    name: 'Associação para o Tráfico de Drogas',
    shortFormatted: '(35 - Associação ao Tráfico)',
    category: 'DROGAS',
    keywords: ['35', 'associacao', 'trafico', 'drogas', 'faccao'],
  },
];

export const LEGAL_ARTICLES_CATALOG: LegalArticle[] = [
  ...POPULAR_POLICE_ARTICLES,
  {
    code: 'Art. 121, § 2º do CP',
    legislation: 'Código Penal',
    label: 'Art. 121, § 2º do CP - Homicídio Qualificado / Feminicídio',
    name: 'Homicídio Qualificado / Feminicídio',
    shortFormatted: '(121 - Homicidio)',
    category: 'CP',
    keywords: ['121', 'feminicidio', 'homicidio qualificado', 'matar', 'cp'],
  },
  {
    code: 'Art. 129, § 13º do CP',
    legislation: 'Código Penal',
    label: 'Art. 129, § 13º do CP - Violência Doméstica',
    name: 'Lesão Corporal em Contexto de Violência Doméstica',
    shortFormatted: '(129 - Lesão corporal)',
    category: 'CP',
    keywords: ['129', 'violencia domestica', 'agressao', 'mulher', 'maria da penha'],
  },
  {
    code: 'Art. 147 do CP',
    legislation: 'Código Penal',
    label: 'Art. 147 do CP - Ameaça',
    name: 'Ameaça',
    shortFormatted: '(147 - Ameaça)',
    category: 'CP',
    keywords: ['147', 'ameaca', 'ameacar', 'cp'],
  },
  {
    code: 'Art. 148 do CP',
    legislation: 'Código Penal',
    label: 'Art. 148 do CP - Sequestro e Cárcere Privado',
    name: 'Sequestro e Cárcere Privado',
    shortFormatted: '(148 - Sequestro)',
    category: 'CP',
    keywords: ['148', 'sequestro', 'carcere privado', 'retencao', 'cp'],
  },
  {
    code: 'Art. 155, § 4º do CP',
    legislation: 'Código Penal',
    label: 'Art. 155, § 4º do CP - Furto Qualificado',
    name: 'Furto Qualificado',
    shortFormatted: '(155 - Furto)',
    category: 'CP',
    keywords: ['155', 'furto qualificado', 'arrombamento', 'chave falsa', 'cp'],
  },
  {
    code: 'Art. 157, § 2º do CP',
    legislation: 'Código Penal',
    label: 'Art. 157, § 2º do CP - Roubo Majorado',
    name: 'Roubo Majorado',
    shortFormatted: '(157 - Roubo)',
    category: 'CP',
    keywords: ['157', 'roubo majorado', 'assalto', 'comparsa', 'cp'],
  },
  {
    code: 'Art. 157, § 2º-A do CP',
    legislation: 'Código Penal',
    label: 'Art. 157, § 2º-A do CP - Roubo com Emprego de Arma de Fogo',
    name: 'Roubo com Emprego de Arma de Fogo',
    shortFormatted: '(157 - Roubo)',
    category: 'CP',
    keywords: ['157', 'arma de fogo', 'assalto armado', 'roubo armado', 'cp'],
  },
  {
    code: 'Art. 157, § 3º do CP',
    legislation: 'Código Penal',
    label: 'Art. 157, § 3º do CP - Latrocínio',
    name: 'Latrocínio (Roubo Seguido de Morte)',
    shortFormatted: '(157 - Latrocínio)',
    category: 'CP',
    keywords: ['157', 'latrocinio', 'morte', 'roubo', 'assalto fatal', 'cp'],
  },
  {
    code: 'Art. 158 do CP',
    legislation: 'Código Penal',
    label: 'Art. 158 do CP - Extorsão',
    name: 'Extorsão',
    shortFormatted: '(158 - Extorsão)',
    category: 'CP',
    keywords: ['158', 'extorsao', 'chantagem', 'coacao', 'cp'],
  },
  {
    code: 'Art. 163 do CP',
    legislation: 'Código Penal',
    label: 'Art. 163 do CP - Dano ao Patrimônio',
    name: 'Dano ao Patrimônio',
    shortFormatted: '(163 - Dano)',
    category: 'CP',
    keywords: ['163', 'dano', 'vandalismo', 'quebrar', 'destruicao', 'cp'],
  },
  {
    code: 'Art. 168 do CP',
    legislation: 'Código Penal',
    label: 'Art. 168 do CP - Apropriação Indébita',
    name: 'Apropriação Indébita',
    shortFormatted: '(168 - Apropriação Indébita)',
    category: 'CP',
    keywords: ['168', 'apropriacao indebita', 'reter', 'cp'],
  },
  {
    code: 'Art. 171 do CP',
    legislation: 'Código Penal',
    label: 'Art. 171 do CP - Estelionato / Golpe',
    name: 'Estelionato / Golpe',
    shortFormatted: '(171 - Estelionato)',
    category: 'CP',
    keywords: ['171', 'estelionato', 'golpe', 'fraude', 'pix', 'cartao', 'cp'],
  },
  {
    code: 'Art. 213 do CP',
    legislation: 'Código Penal',
    label: 'Art. 213 do CP - Estupro',
    name: 'Estupro',
    shortFormatted: '(213 - Estupro)',
    category: 'CP',
    keywords: ['213', 'estupro', 'violencia sexual', 'cp'],
  },
  {
    code: 'Art. 217-A do CP',
    legislation: 'Código Penal',
    label: 'Art. 217-A do CP - Estupro de Vulnerável',
    name: 'Estupro de Vulnerável',
    shortFormatted: '(217-A - Estupro de Vulnerável)',
    category: 'CP',
    keywords: ['217', 'vulneravel', 'menor', 'crianca', 'abuso', 'cp'],
  },
  {
    code: 'Art. 311 do CP',
    legislation: 'Código Penal',
    label: 'Art. 311 do CP - Adulteração de Sinal Veicular',
    name: 'Adulteração de Sinal Identificador de Veículo',
    shortFormatted: '(311 - Adulteração Veicular)',
    category: 'CP',
    keywords: ['311', 'placa clonada', 'chassi', 'adulteracao', 'veiculo', 'moto', 'carro', 'cp'],
  },
  {
    code: 'Art. 329 do CP',
    legislation: 'Código Penal',
    label: 'Art. 329 do CP - Resistência',
    name: 'Resistência à Prisão',
    shortFormatted: '(329 - Resistência)',
    category: 'CP',
    keywords: ['329', 'resistencia', 'agressao policial', 'fuga com violencia', 'cp'],
  },
  {
    code: 'Art. 330 do CP',
    legislation: 'Código Penal',
    label: 'Art. 330 do CP - Desobediência',
    name: 'Desobediência',
    shortFormatted: '(330 - Desobediência)',
    category: 'CP',
    keywords: ['330', 'desobediencia', 'parada', 'ordem legal', 'cp'],
  },
  {
    code: 'Art. 331 do CP',
    legislation: 'Código Penal',
    label: 'Art. 331 do CP - Desacato',
    name: 'Desacato a Funcionário Público',
    shortFormatted: '(331 - Desacato)',
    category: 'CP',
    keywords: ['331', 'desacato', 'ofensa', 'guarnicao', 'cp'],
  },
  {
    code: 'Art. 333 do CP',
    legislation: 'Código Penal',
    label: 'Art. 333 do CP - Corrupção Ativa',
    name: 'Corrupção Ativa',
    shortFormatted: '(333 - Corrupção Ativa)',
    category: 'CP',
    keywords: ['333', 'corrupcao ativa', 'suborno', 'propina', 'cp'],
  },
  {
    code: 'Art. 304 do CP',
    legislation: 'Código Penal',
    label: 'Art. 304 do CP - Uso de Documento Falso',
    name: 'Uso de Documento Falso',
    shortFormatted: '(304 - Documento Falso)',
    category: 'CP',
    keywords: ['304', 'documento falso', 'rg falso', 'cnh falsa', 'cp'],
  },
  {
    code: 'Art. 28 da Lei 11.343/06',
    legislation: 'Lei de Drogas',
    label: 'Art. 28 da Lei 11.343/06 - Posse de Droga para Consumo',
    name: 'Posse de Drogas para Consumo Pessoal',
    shortFormatted: '(28 - Posse de Drogas)',
    category: 'DROGAS',
    keywords: ['28', 'consumo', 'usuario', 'posse', 'entorpecente', 'droga'],
  },
  {
    code: 'Art. 34 da Lei 11.343/06',
    legislation: 'Lei de Drogas',
    label: 'Art. 34 da Lei 11.343/06 - Petrechos para Tráfico',
    name: 'Petrechos para Tráfico',
    shortFormatted: '(34 - Petrechos para Tráfico)',
    category: 'DROGAS',
    keywords: ['34', 'petrechos', 'balanca', 'prensa', 'maquinario', 'laboratorio', 'droga'],
  },
  {
    code: 'Art. 37 da Lei 11.343/06',
    legislation: 'Lei de Drogas',
    label: 'Art. 37 da Lei 11.343/06 - Fogueteiro / Olheiro',
    name: 'Informante do Tráfico (Olheiro)',
    shortFormatted: '(37 - Informante do Tráfico)',
    category: 'DROGAS',
    keywords: ['37', 'olheiro', 'fogueteiro', 'campana', 'informante', 'radio', 'drogas'],
  },
  {
    code: 'Art. 12 da Lei 10.826/03',
    legislation: 'Estatuto do Desarmamento',
    label: 'Art. 12 da Lei 10.826/03 - Posse Irregular de Arma Permitida',
    name: 'Posse Irregular de Arma de Fogo',
    shortFormatted: '(12 - Posse Irregular de Arma)',
    category: 'ARMAS',
    keywords: ['12', 'posse', 'arma', 'residencia', 'desarmamento'],
  },
  {
    code: 'Art. 15 da Lei 10.826/03',
    legislation: 'Estatuto do Desarmamento',
    label: 'Art. 15 da Lei 10.826/03 - Disparo de Arma de Fogo',
    name: 'Disparo de Arma de Fogo em Via Pública',
    shortFormatted: '(15 - Disparo de Arma)',
    category: 'ARMAS',
    keywords: ['15', 'disparo', 'tiro', 'via publica', 'desarmamento'],
  },
  {
    code: 'Art. 17 da Lei 10.826/03',
    legislation: 'Estatuto do Desarmamento',
    label: 'Art. 17 da Lei 10.826/03 - Comércio Ilegal de Arma de Fogo',
    name: 'Comércio Ilegal de Arma de Fogo',
    shortFormatted: '(17 - Comércio de Armas)',
    category: 'ARMAS',
    keywords: ['17', 'comercio', 'venda', 'arma', 'trafico de armas', 'desarmamento'],
  },
  {
    code: 'Art. 307 do CTB',
    legislation: 'Código de Trânsito Brasileiro',
    label: 'Art. 307 do CTB - Violação de Suspensão do Direito de Dirigir',
    name: 'Violação da Suspensão de Dirigir',
    shortFormatted: '(307 - Violação de Suspensão CNH)',
    category: 'CTB',
    keywords: ['307', 'ctb', 'suspensao', 'cnh cassada', 'proibicao', 'transito'],
  },
  {
    code: 'Art. 308 do CTB',
    legislation: 'Código de Trânsito Brasileiro',
    label: 'Art. 308 do CTB - Racha / Direção Perigosa',
    name: 'Racha / Direção Perigosa',
    shortFormatted: '(308 - Racha / Direção Perigosa)',
    category: 'CTB',
    keywords: ['308', 'ctb', 'racha', 'pega', 'manobra perigosa', 'grau', 'cavalinho de pau'],
  },
  {
    code: 'Art. 309 do CTB',
    legislation: 'Código de Trânsito Brasileiro',
    label: 'Art. 309 do CTB - Dirigir Sem CNH Gerando Perigo',
    name: 'Dirigir Sem CNH Gerando Perigo',
    shortFormatted: '(309 - Direção sem Habilitação)',
    category: 'CTB',
    keywords: ['309', 'ctb', 'sem cnh', 'sem habilitacao', 'perigo de dano', 'inabilitado'],
  },
  {
    code: 'Art. 310 do CTB',
    legislation: 'Código de Trânsito Brasileiro',
    label: 'Art. 310 do CTB - Entregar Direção a Inabilitado',
    name: 'Entregar Direção a Pessoa Não Habilitada',
    shortFormatted: '(310 - Entregar Direção a Inabilitado)',
    category: 'CTB',
    keywords: ['310', 'ctb', 'entregar veiculo', 'inabilitado', 'emprestar moto'],
  },
  {
    code: 'Art. 24-A da Lei 11.340/06',
    legislation: 'Lei Maria da Penha',
    label: 'Art. 24-A da Lei 11.340/06 - Descumprimento de Medida Protetiva',
    name: 'Descumprimento de Medida Protetiva',
    shortFormatted: '(24-A - Medida Protetiva)',
    category: 'ESPECIAIS',
    keywords: ['24-a', '24a', 'maria da penha', 'medida protetiva', 'descumprimento', 'mulher'],
  },
  {
    code: 'Art. 2º da Lei 12.850/13',
    legislation: 'Organizações Criminosas',
    label: 'Art. 2º da Lei 12.850/13 - Organização Criminosa (Facção)',
    name: 'Organização Criminosa (Facção)',
    shortFormatted: '(2 - Organização Criminosa)',
    category: 'ESPECIAIS',
    keywords: ['2', 'lei 12850', 'faccao', 'pcc', 'cv', 'comando', 'organizacao criminosa'],
  },
  {
    code: 'Art. 244-B do ECA',
    legislation: 'Estatuto da Criança e do Adolescente',
    label: 'Art. 244-B do ECA - Corrupção de Menores',
    name: 'Corrupção de Menores',
    shortFormatted: '(244-B - Corrupção de Menores)',
    category: 'ESPECIAIS',
    keywords: ['244-b', '244b', 'eca', 'corrupcao de menores', 'adolescente', 'menor'],
  },
  {
    code: 'Art. 19 da LCP',
    legislation: 'Lei das Contravenções Penais',
    label: 'Art. 19 da LCP - Porte de Arma Branca',
    name: 'Porte de Arma Branca',
    shortFormatted: '(19 - Porte de Arma Branca)',
    category: 'CONTRAVENCOES',
    keywords: ['19', 'lcp', 'arma branca', 'faca', 'facao', 'punhal', 'contravencao'],
  },
  {
    code: 'Art. 42 da LCP',
    legislation: 'Lei das Contravenções Penais',
    label: 'Art. 42 da LCP - Perturbação do Sossego',
    name: 'Perturbação do Sossego',
    shortFormatted: '(42 - Perturbação do Sossego)',
    category: 'CONTRAVENCOES',
    keywords: ['42', 'lcp', 'perturbacao', 'sossego', 'som alto', 'barulho'],
  },
];

/**
 * Retorna a formatação padronizada e curta exata: (Número - Nome do Crime)
 * Exemplos exigidos: (121 - Homicidio), (129 - Lesão corporal), (33 - Tráfico), (157 - Roubo)
 */
export function getShortArticleFormat(article: LegalArticle): string {
  if (article.shortFormatted) {
    return article.shortFormatted;
  }
  const match = article.code.match(/Art\.?\s*([0-9]+[a-zA-Z-]*)/i);
  const num = match ? match[1] : 'Art';
  const cleanName = article.name.split('/')[0].split('(')[0].trim();
  return `(${num} - ${cleanName})`;
}

/**
 * Remove acentos e caracteres diacríticos para busca insensível a acentos
 */
export function normalizeSearchTerm(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Decomprime ou divide string de múltiplos artigos em um array de até 30 crimes
 * Suporta formatos como:
 * - "(157 - Roubo), (33 - Tráfico)"
 * - "(157 - Roubo) / (33 - Tráfico)"
 * - "157 - Roubo, 33 - Tráfico"
 */
export function parseArticlesString(raw?: string | string[]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  const str = String(raw).trim();
  if (!str) return [];

  // Se o texto tiver parênteses fechados ex: (157 - Roubo), (33 - Tráfico)
  const bracketMatches = str.match(/\([^)]+\)/g);
  if (bracketMatches && bracketMatches.length > 0) {
    return bracketMatches
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  // Divisão por vírgula, barra ou ponto e vírgula
  return str
    .split(/\s*,\s*|\s*\/\s*|\s*;\s*|\s*\|\s*/)
    .map((item) => {
      const clean = item.trim();
      if (!clean) return '';
      if (clean.startsWith('(') && clean.endsWith(')')) return clean;
      return `(${clean})`;
    })
    .filter(Boolean)
    .slice(0, 30);
}

/**
 * Formata um artigo digitado livremente para o padrão (Número - Nome)
 */
export function formatCustomArticle(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed;
  }
  return `(${trimmed})`;
}

/**
 * Filtra a lista de artigos legais a partir de qualquer termo (número do artigo, nome do crime, lei, ou palavra-chave)
 */
export function filterLegalArticles(query: string): LegalArticle[] {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) return POPULAR_POLICE_ARTICLES;

  // Busca por tokens/palavras separadas
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return LEGAL_ARTICLES_CATALOG.filter((item) => {
    const haystacks = [
      normalizeSearchTerm(item.code),
      normalizeSearchTerm(item.label),
      normalizeSearchTerm(item.name),
      normalizeSearchTerm(item.legislation),
      ...item.keywords.map(normalizeSearchTerm),
    ];

    // Todos os tokens devem ser encontrados em ao menos um dos campos
    return tokens.every((token) =>
      haystacks.some((field) => field.includes(token))
    );
  }).slice(0, 15);
}
