import { OrcrimRecord, OrcrimMembro, OrcrimMembroFuncao, OrcrimEndereco, OrcrimPericulosidade, OrcrimStatus, SuspectRecord } from '../types';
import {
  saveOrcrimToRealtimeCloud,
  deleteOrcrimFromRealtimeCloud,
  subscribeToCloudOrcrims,
} from './firebaseSync';

const ORCRIM_STORAGE_KEY = 'bdo_orcrim_records_v1';
const LEGACY_ORCRIM_STORAGE_KEY = 'ft_orcrim_records_v1';

// Inicia escuta em tempo real para ORCRIMs na nuvem
if (typeof window !== 'undefined') {
  try {
    subscribeToCloudOrcrims((cloudOrcrims) => {
      if (Array.isArray(cloudOrcrims) && cloudOrcrims.length > 0) {
        saveAllOrcrims(cloudOrcrims);
      }
    });
  } catch (err) {
    console.warn('[OrcrimStorage] Escuta em tempo real suspensa:', err);
  }
}

// Dados iniciais de inteligência para prontidão imediata do sistema
const INITIAL_ORCRIMS: OrcrimRecord[] = [
  {
    id: 'orcrim-cv-01',
    nome: 'COMANDO VERMELHO',
    sigla: 'CV',
    origem: 'Rio de Janeiro / RJ - Expansão Nacional',
    dataSurgimento: '1979',
    coresSimbolos: 'Vermelho / Branco | Letras CV, CVRL, Trem Bala',
    territorios: ['Aglomerado da Serra', 'Cabana do Pai Tomás', 'Vila Cafezal', 'Morro das Pedras'],
    atividadesCriminosas: ['Tráfico de Drogas', 'Tráfico Internacional de Armas', 'Homicídios', 'Roubo de Carga'],
    periculosidade: 'EXTREMA',
    status: 'ATIVA',
    liderPrincipal: 'MARCINHO VP / TIO PATINHAS',
    membros: [],
    enderecos: [
      {
        id: 'end-cv-1',
        logradouro: 'RUA DAS FLORES, 100',
        bairro: 'SANTA TEREZA',
        tipo: 'PONTO_DE_TRAFICO',
        coordenadas: { lat: -19.9142, lng: -43.9189 },
        observacoes: 'Boca do meio, intenso fluxo de usuários e olheiros nas esquinas.',
        cadastradoEm: new Date().toISOString(),
      },
      {
        id: 'end-cv-2',
        logradouro: 'RUA PRINCIPAL, 50',
        bairro: 'CENTRO',
        tipo: 'SEDE',
        coordenadas: { lat: -19.9191, lng: -43.9386 },
        observacoes: 'Ponto de reunião de lideranças e armazenamento contábil.',
        cadastradoEm: new Date().toISOString(),
      },
      {
        id: 'end-cv-3',
        logradouro: 'AV. BRASIL, 320',
        bairro: 'SÃO GABRIEL',
        tipo: 'ESCONDERIJO',
        coordenadas: { lat: -19.8643, lng: -43.9218 },
        observacoes: 'Possível esconderijo de foragidos da facção.',
        cadastradoEm: new Date().toISOString(),
      },
      {
        id: 'end-cv-4',
        logradouro: 'RUA A, 75',
        bairro: 'NOVA VISTA',
        tipo: 'PONTO_DE_APOIO',
        coordenadas: { lat: -19.8972, lng: -43.8967 },
        observacoes: 'Ponto de apoio para abastecimento e troca de plantão.',
        cadastradoEm: new Date().toISOString(),
      },
    ],
    observacoes: 'Facção hegemônica com forte atuação no tráfico interestadual e fornecimento de armamento pesado.',
    dataCriacao: new Date().toISOString(),
    dataAtualizacao: new Date().toISOString(),
  },
  {
    id: 'orcrim-pcc-02',
    nome: 'PRIMEIRO COMANDO DA CAPITAL',
    sigla: 'PCC',
    origem: 'São Paulo / SP - Presídio Taubaté',
    dataSurgimento: '1993',
    coresSimbolos: 'Preto / Branco | Yin-Yang, 1533, Paz Justiça Liberdade',
    territorios: ['Vila Pinho', 'Bairro Glória', 'Vila Ideal', 'Barreiro'],
    atividadesCriminosas: ['Mega-assaltos a Bancos', 'Tráfico Transnacional', 'Lavagem de Dinheiro', 'Tribunal do Crime'],
    periculosidade: 'EXTREMA',
    status: 'ATIVA',
    liderPrincipal: 'MARCOLA / SINTONIA GERAL',
    membros: [],
    observacoes: 'Estrutura corporativa e altamente disciplinada. Possui divisão entre Geral da Rua e Geral do Sistema.',
    dataCriacao: new Date().toISOString(),
    dataAtualizacao: new Date().toISOString(),
  },
  {
    id: 'orcrim-tcp-03',
    nome: 'TERCEIRO COMANDO PURO',
    sigla: 'TCP',
    origem: 'Rio de Janeiro / RJ',
    dataSurgimento: '2002',
    coresSimbolos: 'Verde / Branco | 3 Listras, Estrela de Davi',
    territorios: ['Vila Antena', 'Pedreira Prado Lopes (parcial)'],
    atividadesCriminosas: ['Tráfico de Drogas', 'Extorsão', 'Contrabando'],
    periculosidade: 'ALTA',
    status: 'EM_CONFLITO',
    liderPrincipal: 'TH DA MARÉ / LACOSTA',
    membros: [],
    observacoes: 'Rivalidade histórica e conflitos violentos contra o CV por controle de pontos de venda.',
    dataCriacao: new Date().toISOString(),
    dataAtualizacao: new Date().toISOString(),
  },
];

const INIT_FLAG = 'bdo_orcrim_initialized_v2';

/**
 * Retorna todas as organizações criminosas armazenadas.
 */
export async function getAllOrcrims(): Promise<OrcrimRecord[]> {
  try {
    let raw = localStorage.getItem(ORCRIM_STORAGE_KEY);
    
    // Se a chave principal já tem conteúdo salvo (inclusive array vazio [])
    if (raw !== null) {
      const parsed: OrcrimRecord[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    // Se já foi inicializado antes e o storage foi esvaziado pelo usuário, respeita o estado vazio
    const wasInitialized = 
      localStorage.getItem(INIT_FLAG) === 'true' || 
      localStorage.getItem('bdo_orcrim_initialized_v1') === 'true';

    if (wasInitialized) {
      return [];
    }

    // Tenta migrar da chave legada se existir
    const legacyRaw = localStorage.getItem(LEGACY_ORCRIM_STORAGE_KEY);
    if (legacyRaw) {
      const parsedLegacy: OrcrimRecord[] = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy)) {
        saveAllOrcrims(parsedLegacy);
        return parsedLegacy;
      }
    }
  } catch (err) {
    console.error('Erro ao ler ORCRIMs do storage:', err);
  }

  // Inicializa com dados táticos pré-cadastrados apenas na primeira execução do app
  saveAllOrcrims(INITIAL_ORCRIMS);
  return INITIAL_ORCRIMS;
}

/**
 * Salva a lista completa no storage local e sincroniza eventos.
 */
export function saveAllOrcrims(orcrims: OrcrimRecord[]): void {
  try {
    const serialized = JSON.stringify(orcrims);
    localStorage.setItem(ORCRIM_STORAGE_KEY, serialized);
    localStorage.setItem(LEGACY_ORCRIM_STORAGE_KEY, serialized);
    localStorage.setItem(INIT_FLAG, 'true');
    localStorage.setItem('bdo_orcrim_initialized_v1', 'true');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('orcrim_updated', { detail: orcrims }));
    }
  } catch (err) {
    console.error('Erro ao salvar ORCRIMs:', err);
  }
}

/**
 * Salva ou atualiza uma ORCRIM individual.
 */
export async function saveOrcrim(orcrim: OrcrimRecord): Promise<void> {
  const current = await getAllOrcrims();
  const index = current.findIndex((item) => item.id === orcrim.id);
  let savedItem: OrcrimRecord;

  if (index >= 0) {
    savedItem = { ...orcrim, dataAtualizacao: new Date().toISOString() };
    current[index] = savedItem;
  } else {
    savedItem = {
      ...orcrim,
      dataCriacao: orcrim.dataCriacao || new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
    };
    current.unshift(savedItem);
  }

  saveAllOrcrims(current);
  // Sincroniza em tempo real com a nuvem
  saveOrcrimToRealtimeCloud(savedItem).catch((e) => console.warn('Falha sync nuvem orcrim:', e));
}

/**
 * Exclui uma ORCRIM pelo ID, sigla ou nome de forma definitiva.
 */
export async function deleteOrcrim(id: string): Promise<OrcrimRecord[]> {
  const current = await getAllOrcrims();
  const clean = String(id || '').trim().toLowerCase();

  const target = current.find(
    (item) =>
      item.id === id ||
      String(item.id || '').trim().toLowerCase() === clean ||
      String(item.sigla || '').trim().toLowerCase() === clean ||
      String(item.nome || '').trim().toLowerCase() === clean
  );

  const targetSigla = target?.sigla?.trim().toLowerCase();
  const targetNome = target?.nome?.trim().toLowerCase();

  const filtered = current.filter((item) => {
    if (item.id === id) return false;
    if (String(item.id || '').trim().toLowerCase() === clean) return false;
    if (target && item.id === target.id) return false;
    if (targetSigla && item.sigla && item.sigla.trim().toLowerCase() === targetSigla) return false;
    if (targetNome && item.nome && item.nome.trim().toLowerCase() === targetNome) return false;
    return true;
  });

  saveAllOrcrims(filtered);
  // Exclui da nuvem em tempo real
  const cloudIdToDelete = target ? target.id : id;
  deleteOrcrimFromRealtimeCloud(cloudIdToDelete).catch((e) => console.warn('Falha delete nuvem orcrim:', e));

  return filtered;
}

/**
 * Exclui todas as facções registradas.
 */
export async function clearAllOrcrims(): Promise<OrcrimRecord[]> {
  saveAllOrcrims([]);
  return [];
}

/**
 * Restaura as facções padrão do sistema.
 */
export async function resetOrcrimsToDefaults(): Promise<OrcrimRecord[]> {
  saveAllOrcrims(INITIAL_ORCRIMS);
  return INITIAL_ORCRIMS;
}

/**
 * Verifica duplicidade por nome ou sigla.
 */
export async function checkOrcrimDuplicate(
  nome: string,
  sigla: string,
  excludeId?: string
): Promise<OrcrimRecord | null> {
  const current = await getAllOrcrims();
  const normNome = nome.trim().toLowerCase();
  const normSigla = sigla.trim().toLowerCase();

  for (const item of current) {
    if (excludeId && item.id === excludeId) continue;

    const itemNome = (item.nome || '').trim().toLowerCase();
    const itemSigla = (item.sigla || '').trim().toLowerCase();

    if (
      (normNome && itemNome === normNome) ||
      (normSigla && itemSigla === normSigla)
    ) {
      return item;
    }
  }

  return null;
}

/**
 * Vincula um abordado do sistema a uma ORCRIM com função hierárquica.
 */
export async function linkSuspectToOrcrim(
  orcrimId: string,
  suspect: SuspectRecord,
  funcao: OrcrimMembroFuncao,
  funcaoPersonalizada?: string,
  observacoes?: string
): Promise<OrcrimRecord | null> {
  const current = await getAllOrcrims();
  const orcrimIndex = current.findIndex((o) => o.id === orcrimId);

  if (orcrimIndex === -1) return null;

  const orcrim = current[orcrimIndex];
  const membros = orcrim.membros || [];

  // Remove vínculo anterior se já existia na mesma facção
  const filteredMembros = membros.filter((m) => m.suspectId !== suspect.id);

  const novoMembro: OrcrimMembro = {
    id: `vinculo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    suspectId: suspect.id,
    nome: suspect.nome,
    alcunha: suspect.alcunha,
    rg: suspect.rg,
    cpf: suspect.cpf,
    foto: (suspect.fotos && suspect.fotos[0]) || undefined,
    funcao,
    funcaoPersonalizada,
    dataVinculo: new Date().toISOString(),
    observacoes,
    status: suspect.marcador === 'PRESO' ? 'PRESO' : suspect.marcador === 'MORTO' ? 'FALECIDO' : 'ATIVO',
  };

  filteredMembros.push(novoMembro);
  orcrim.membros = filteredMembros;
  orcrim.dataAtualizacao = new Date().toISOString();

  current[orcrimIndex] = orcrim;
  saveAllOrcrims(current);

  return orcrim;
}

/**
 * Remove o vínculo de um abordado com a ORCRIM.
 */
export async function unlinkSuspectFromOrcrim(
  orcrimId: string,
  membroId: string
): Promise<OrcrimRecord | null> {
  const current = await getAllOrcrims();
  const orcrimIndex = current.findIndex((o) => o.id === orcrimId);

  if (orcrimIndex === -1) return null;

  const orcrim = current[orcrimIndex];
  orcrim.membros = (orcrim.membros || []).filter((m) => m.id !== membroId);
  orcrim.dataAtualizacao = new Date().toISOString();

  current[orcrimIndex] = orcrim;
  saveAllOrcrims(current);

  return orcrim;
}

/**
 * Adiciona um ponto de endereço / boca de fumo / sede / esconderijo à ORCRIM.
 */
export async function addEnderecoToOrcrim(
  orcrimId: string,
  endereco: Omit<OrcrimEndereco, 'id' | 'cadastradoEm'>
): Promise<OrcrimRecord | null> {
  const current = await getAllOrcrims();
  const orcrimIndex = current.findIndex((o) => o.id === orcrimId);

  if (orcrimIndex === -1) return null;

  const orcrim = current[orcrimIndex];
  const enderecos = orcrim.enderecos || [];

  const novoEndereco: OrcrimEndereco = {
    ...endereco,
    id: `end-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    cadastradoEm: new Date().toISOString(),
  };

  enderecos.unshift(novoEndereco);
  orcrim.enderecos = enderecos;
  orcrim.dataAtualizacao = new Date().toISOString();

  current[orcrimIndex] = orcrim;
  saveAllOrcrims(current);

  return orcrim;
}

/**
 * Remove um endereço da ORCRIM.
 */
export async function removeEnderecoFromOrcrim(
  orcrimId: string,
  enderecoId: string
): Promise<OrcrimRecord | null> {
  const current = await getAllOrcrims();
  const orcrimIndex = current.findIndex((o) => o.id === orcrimId);

  if (orcrimIndex === -1) return null;

  const orcrim = current[orcrimIndex];
  orcrim.enderecos = (orcrim.enderecos || []).filter((e) => e.id !== enderecoId);
  orcrim.dataAtualizacao = new Date().toISOString();

  current[orcrimIndex] = orcrim;
  saveAllOrcrims(current);

  return orcrim;
}

/**
 * Tradução amigável dos cargos hierárquicos no organograma.
 */
export function getFuncaoLabel(funcao: OrcrimMembroFuncao, custom?: string): string {
  if (custom && custom.trim()) return custom.trim();
  switch (funcao) {
    case 'LIDER_GERAL':
      return 'Líder Geral / Cúpula';
    case 'SUB_LIDER':
      return 'Sub-Líder / Frente Geral';
    case 'DISCIPLINA':
      return 'Disciplina / Sintonia';
    case 'GERENTE_FRENTE':
      return 'Gerente de Ponto / Frente';
    case 'OPERACIONAL_SOLDADO':
      return 'Operacional / Soldado';
    case 'ARMEIRO_LOGISTICA':
      return 'Armeiro / Logística';
    case 'CONTATO_APOIO':
      return 'Apoio / Olheiro / Contato';
    default:
      return 'Integrante';
  }
}
