-- ====================================================================
-- FORÇA TÁTICA CPC - SCHEMA CLOUDFLARE D1 (SQLITE)
-- Banco de dados ultra-rápido de alta disponibilidade na nuvem Cloudflare
-- ====================================================================

CREATE TABLE IF NOT EXISTS suspects (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  mae TEXT,
  dataNasc TEXT,
  rg TEXT,
  cpf TEXT,
  endereco TEXT,
  enderecos TEXT, -- JSON Array: ["Rua A, 100", "Rua B, 200"]
  codigo TEXT,
  alcunha TEXT,
  artigo TEXT,
  artigos TEXT, -- JSON Array: ["157", "33"]
  marcador TEXT DEFAULT 'NENHUM', -- 'PRESO' | 'MORTO' | 'ALVO_PRIORITARIO' | 'NENHUM'
  localAbordagem TEXT,
  horaAbordagem TEXT, -- Ex: "14:35"
  coordenadas TEXT, -- Formato "-19.916681,-43.934493"
  bpm TEXT, -- Ex: "1º BPM", "5º BPM", etc.
  observacoes TEXT,
  fotos TEXT, -- JSON Array de URLs ou strings R2: ["https://..."]
  dataCriacao TEXT NOT NULL,
  dataAtualizacao TEXT,
  dataAlteracaoFoto TEXT,
  alterado TEXT,
  autorCriacaoLogin TEXT,
  autorCriacaoNome TEXT,
  autorAlteracaoLogin TEXT,
  autorAlteracaoNome TEXT
);

-- Índices de alta performance para busca instantânea em viatura
CREATE INDEX IF NOT EXISTS idx_suspects_nome ON suspects (nome);
CREATE INDEX IF NOT EXISTS idx_suspects_alcunha ON suspects (alcunha);
CREATE INDEX IF NOT EXISTS idx_suspects_rg ON suspects (rg);
CREATE INDEX IF NOT EXISTS idx_suspects_cpf ON suspects (cpf);
CREATE INDEX IF NOT EXISTS idx_suspects_marcador ON suspects (marcador);
CREATE INDEX IF NOT EXISTS idx_suspects_bpm ON suspects (bpm);
CREATE INDEX IF NOT EXISTS idx_suspects_dataCriacao ON suspects (dataCriacao DESC);

-- Tabela do Módulo ORCRIM (Organizações Criminosas)
CREATE TABLE IF NOT EXISTS orcrims (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  sigla TEXT NOT NULL,
  origem TEXT,
  dataSurgimento TEXT,
  coresSimbolos TEXT,
  territorios TEXT, -- JSON Array
  atividadesCriminosas TEXT, -- JSON Array
  periculosidade TEXT DEFAULT 'ALTA',
  status TEXT DEFAULT 'ATIVA',
  liderPrincipal TEXT,
  membros TEXT, -- JSON Array de membros vinculados com foto e cargo
  observacoes TEXT,
  dataCriacao TEXT NOT NULL,
  dataAtualizacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_orcrims_sigla ON orcrims (sigla);
CREATE INDEX IF NOT EXISTS idx_orcrims_nome ON orcrims (nome);

-- Tabela de Usuários e Permissões do Sistema
CREATE TABLE IF NOT EXISTS app_users (
  login TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  senha TEXT NOT NULL,
  postoGraduacao TEXT,
  batalhaoUnidade TEXT,
  perfil TEXT DEFAULT 'OPERADOR_TATICO',
  status TEXT DEFAULT 'ATIVO',
  mustChangePassword INTEGER DEFAULT 1,
  permissoes TEXT, -- JSON das permissões modulares
  criadoEm TEXT NOT NULL,
  ultimoAcesso TEXT
);

-- Tabela de Configurações e Segurança Operacional
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Insere senha padrão inicial caso não exista
INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES ('SENHA_OPERACIONAL_APP', '1252300', datetime('now'));
