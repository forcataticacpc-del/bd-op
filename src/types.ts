export type SuspectMarcador = 'PRESO' | 'MORTO' | 'ALVO_PRIORITARIO' | 'FORAGIDO' | 'NENHUM';

export interface VinculoPessoaRecord {
  id: string;
  nome: string;
  grauParentesco: string; // Mãe, Pai, Irmão, Primo, Tio, Esposa, etc.
  rg?: string;
  cpf?: string;
  endereco?: string;
  observacoes?: string;
  dataCriacao?: string;
}

export interface SuspectRecord {
  id: string;
  nome: string;
  mae: string;
  dataNasc: string; // LINK / NASC
  rg: string;
  cpf: string;
  endereco: string;
  enderecos?: string[];
  codigo?: string;
  alcunha: string;
  artigo: string;
  artigos?: string[];
  marcador?: SuspectMarcador | string; // 'PRESO' | 'MORTO' | 'ALVO_PRIORITARIO' | 'NENHUM'
  localAbordagem?: string;
  horaAbordagem?: string; // HORA DA ABORDAGEM (ex: "14:35")
  localAbordagemCoords?: {
    lat: number;
    lng: number;
  };
  coordenadas?: string; // Formato "-19.916681,-43.934493" para gravação na planilha e buscas
  bpm?: string; // Batalhão Policial Militar (ex: 1º BPM, 5º BPM, etc.)
  observacoes: string;
  fotos: string[]; // URLs or base64 data strings
  vinculosPessoas?: VinculoPessoaRecord[]; // Vínculos familiares e contatos para fuga
  dataCriacao: string;
  dataAtualizacao?: string;
  dataAlteracaoFoto?: string;
  alterado?: string; // Coluna de registro de alteração de foto / atualização
  autorCriacaoLogin?: string;
  autorCriacaoNome?: string;
  autorAlteracaoLogin?: string;
  autorAlteracaoNome?: string;
}

export interface AbordagemRecord {
  id: string;
  suspectId: string;
  suspectNome: string;
  suspectAlcunha?: string;
  suspectRg?: string;
  suspectCpf?: string;
  suspectFoto?: string;
  data: string; // Ex: '10/10/2026'
  hora: string; // Ex: '15:40'
  endereco: string;
  bairro?: string;
  coordenadas?: string;
  bpm?: string;
  viatura?: string;
  natureza?: string;
  observacoes?: string;
  foto?: string; // Foto opcional tirada durante esta abordagem específica
  outrosAbordados?: Array<{
    suspectId?: string;
    nome: string;
    alcunha?: string;
    rg?: string;
  }>;
  criadoEm: string;
}

export type OrcrimPericulosidade = 'EXTREMA' | 'ALTA' | 'MEDIA' | 'BAIXA' | string;
export type OrcrimStatus = 'ATIVA' | 'EM_CONFLITO' | 'DESARTICULADA' | 'MONITORADA';

export type OrcrimMembroFuncao =
  | 'LIDER_GERAL'
  | 'SUB_LIDER'
  | 'DISCIPLINA'
  | 'GERENTE_FRENTE'
  | 'OPERACIONAL_SOLDADO'
  | 'ARMEIRO_LOGISTICA'
  | 'CONTATO_APOIO'
  | 'OUTRO';

export interface OrcrimMembro {
  id: string;
  suspectId: string;
  nome: string;
  alcunha?: string;
  rg?: string;
  cpf?: string;
  foto?: string;
  funcao: OrcrimMembroFuncao;
  funcaoPersonalizada?: string;
  dataVinculo: string;
  observacoes?: string;
  status: 'ATIVO' | 'PRESO' | 'FALECIDO' | 'DESVINCULADO';
  posicaoX?: number; // Posição customizada no organograma arrastável
  posicaoY?: number;
}

export interface OrcrimEndereco {
  id: string;
  logradouro: string; // Ex: Rua das Flores, 100
  bairro?: string; // Ex: Santa Tereza
  tipo: 'PONTO_DE_TRAFICO' | 'SEDE' | 'ESCONDERIJO' | 'PONTO_DE_APOIO' | 'DEPOSITO_DE_ARMAS' | 'OUTRO' | string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
  observacoes?: string;
  cadastradoEm?: string;
}

export interface OrcrimRecord {
  id: string;
  nome: string;
  sigla: string;
  fotoSimbolo?: string; // Símbolo / brasão da facção opcional
  origem?: string;
  dataSurgimento?: string;
  coresSimbolos?: string;
  territorios?: string[];
  atividadesCriminosas?: string[];
  periculosidade: OrcrimPericulosidade;
  status: OrcrimStatus;
  liderPrincipal?: string;
  membros: OrcrimMembro[];
  enderecos?: OrcrimEndereco[];
  observacoes?: string;
  dataCriacao: string;
  dataAtualizacao?: string;
}

export interface UserPermissions {
  cadastrarAbordagem: boolean;
  editarAbordagem: boolean;
  excluirAbordagem: boolean;
  visualizarDadosSigilosos: boolean;
  moduloOrcrimVisualizar: boolean;
  moduloOrcrimCadastrar: boolean;
  moduloOrcrimOrganograma: boolean;
  exportarRelatorios: boolean;
  gerenciarUsuarios: boolean;
}

export interface AppUserProfile {
  login: string;
  nome: string;
  email?: string;
  postoGraduacao?: string; // Soldado, Cabo, Sargento, Tenente, etc.
  batalhaoUnidade?: string; // 1º BPM, BOPE, ROTAM, etc.
  perfil: 'MASTER' | 'ADMIN' | 'OPERADOR_TATICO';
  status: 'ATIVO' | 'BLOQUEADO' | 'PENDENTE' | 'PRIMEIRO_ACESSO';
  mustChangePassword: boolean;
  senhaTemporaria?: string;
  permissoes: UserPermissions;
  criadoEm: string;
  ultimoAcesso?: string;
}

export interface SyncConfig {
  webhookUrl: string;
  autoSync: boolean;
  lastSync?: string;
}

