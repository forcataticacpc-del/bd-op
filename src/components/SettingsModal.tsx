import React, { useState } from 'react';
import {
  Settings,
  X,
  Shield,
  Lock,
  RotateCw,
  Download,
  Smartphone,
  FolderArchive,
  CheckCircle2,
  Users,
  LogOut,
  Edit2,
  Check,
  FileCode,
  Cloud,
  FileJson,
  Archive,
  Database,
  Sparkles,
  FolderGit2,
} from 'lucide-react';
import { ThemeMode } from '../utils/theme';
import { getAppCustomName, setAppCustomName } from '../utils/appName';
import { SuspectRecord } from '../types';
import {
  exportAllCardsConsolidatedJson,
  exportAllCardsIndividualZip,
} from '../utils/exportCards';

export type CardViewMode = 'grid' | 'grid-3' | 'list' | 'compact';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalRecords: number;
  suspects?: SuspectRecord[];
  isWeb?: boolean;
  viewMode?: CardViewMode;
  onChangeViewMode?: (mode: CardViewMode) => void;
  theme?: ThemeMode;
  onChangeTheme?: (theme: ThemeMode) => void;
  onOpenSheetsModal?: () => void;
  onOpenSecurityModal: () => void;
  onOpenCloudflareModal?: () => void;
  onOpenGitHubModal?: () => void;
  onOpenInstallModal?: () => void;
  onOpenOrcrimModal?: () => void;
  onOpenUserManagementModal?: () => void;
  onOpenSmartImportModal?: () => void;
  onLogout?: () => void;
  onRefreshAll: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  totalRecords,
  suspects = [],
  isWeb = false,
  onOpenSecurityModal,
  onOpenCloudflareModal,
  onOpenGitHubModal,
  onOpenInstallModal,
  onOpenUserManagementModal,
  onOpenSmartImportModal,
  onLogout,
  onRefreshAll,
  isRefreshing = false,
}) => {
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [isExportingCards, setIsExportingCards] = useState(false);
  const [cardsExportFeedback, setCardsExportFeedback] = useState<string | null>(null);

  // Edição do Nome Oficial do Aplicativo
  const [currentAppName, setCurrentAppName] = useState(getAppCustomName);
  const [isEditingAppName, setIsEditingAppName] = useState(false);
  const [appNameInput, setAppNameInput] = useState(currentAppName);
  const [savedNameSuccess, setSavedNameSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSaveAppName = () => {
    const updated = setAppCustomName(appNameInput);
    setCurrentAppName(updated);
    setIsEditingAppName(false);
    setSavedNameSuccess(true);
    setTimeout(() => setSavedNameSuccess(false), 2500);
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    setDownloadProgress('Iniciando transferência (6.37 MB)...');

    try {
      // 1. Tenta baixar via API Base64 garantida (evita interceptação de cookies/redirecionamento para __cookie_check de 10KB)
      const res = await fetch('/api/download-zip-base64');
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 100000) {
          setDownloadProgress(`Processando arquivo completo (${json.sizeMb || '6.37'} MB)...`);
          const binaryString = window.atob(json.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/zip' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'banco-de-dados-projeto-completo.zip';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          setDownloadProgress(`✅ ZIP Completo Salvo (${(blob.size / (1024 * 1024)).toFixed(2)} MB)!`);
          setTimeout(() => {
            setIsDownloadingZip(false);
            setDownloadProgress(null);
          }, 3500);
          return;
        }
      }

      // 2. Fallback caso a API base64 não responda: Fetch binário direto com validação de integridade
      setDownloadProgress('Baixando pacote binário direto...');
      const binRes = await fetch('/api/download-zip');
      const blob = await binRes.blob();

      // Se o tamanho for menor que 50KB ou for HTML, significa que foi desviado para a página de auth do Google
      if (blob.size < 50000 || blob.type.includes('html')) {
        throw new Error('Aviso: o navegador retornou uma página de redirecionamento em vez do arquivo ZIP.');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'banco-de-dados-projeto-completo.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setDownloadProgress(`✅ ZIP Salvo com Sucesso (${(blob.size / (1024 * 1024)).toFixed(2)} MB)!`);
      setTimeout(() => {
        setIsDownloadingZip(false);
        setDownloadProgress(null);
      }, 3500);
    } catch (err: any) {
      console.error('Erro no download:', err);
      setDownloadProgress(`Falha: ${err.message || 'Erro ao obter arquivo'}`);
      setTimeout(() => {
        setIsDownloadingZip(false);
        setDownloadProgress(null);
      }, 4000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="settings-modal"
        className="relative w-full max-w-lg my-auto bg-[#10141d] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header dos Ajustes */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800/90 bg-[#141822]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c69c59]/15 border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b]">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Ajustes e Configurações
              </h2>
              <span className="text-[10px] text-[#c69c59] block">
                BANCO DE DADOS
              </span>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-settings"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo dos Ajustes */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Nome Oficial do Sistema (Personalização Salva para o Futuro) */}
          <div className="p-3.5 rounded-xl bg-[#151923] border border-[#c69c59]/40 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#1b212f] border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b] flex-shrink-0">
                  <Shield className="w-4 h-4 text-[#c69c59]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#c69c59] block">
                    Nome Oficial do Sistema
                  </span>
                  <span className="text-sm font-extrabold text-white truncate block">
                    {currentAppName}
                  </span>
                </div>
              </div>

              {!isEditingAppName ? (
                <button
                  type="button"
                  id="btn-edit-app-name"
                  onClick={() => setIsEditingAppName(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252e42] text-neutral-300 hover:text-white border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0"
                  title="Alterar ou personalizar nome do aplicativo"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#e5c07b]" />
                  <span>Alterar</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsEditingAppName(false)}
                    className="px-2 py-1 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    id="btn-save-app-name"
                    onClick={handleSaveAppName}
                    className="px-2.5 py-1 rounded-lg bg-[#c69c59] text-neutral-950 font-bold text-xs flex items-center gap-1 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar</span>
                  </button>
                </div>
              )}
            </div>

            {isEditingAppName && (
              <div className="pt-1 space-y-1">
                <input
                  type="text"
                  value={appNameInput}
                  onChange={(e) => setAppNameInput(e.target.value)}
                  placeholder="Ex: Banco de Dados Operacional"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d1017] border border-[#c69c59]/50 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-neutral-400 block">
                  O nome padrão é <strong>Banco de Dados Operacional</strong>. As alterações são salvas localmente.
                </span>
              </div>
            )}

            {savedNameSuccess && (
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Nome atualizado com sucesso!</span>
              </div>
            )}
          </div>

          {/* Importador Inteligente */}
          {onOpenSmartImportModal && (
            <div className="space-y-1.5">
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/40 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/50 flex items-center justify-center text-cyan-400 flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Importador Inteligente
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Migração do Google Keep, textos e fotos por IA
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-settings-open-smart-import"
                  onClick={() => {
                    onClose();
                    onOpenSmartImportModal();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 border border-cyan-500/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Abrir</span>
                </button>
              </div>
              <p className="text-[11px] text-amber-400/90 font-mono px-2 flex items-center gap-1">
                <span>* em fase de teste</span>
              </p>
            </div>
          )}
          {onOpenInstallModal && (
            <div className="p-3.5 rounded-xl bg-[#151923] border border-neutral-800 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1c2230] border border-neutral-700 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Smartphone className="w-5 h-5 text-[#e5c07b]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Instalar Aplicativo
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Adicionar à tela inicial do celular ou PC
                  </span>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-open-install"
                onClick={() => {
                  onClose();
                  onOpenInstallModal();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252e42] text-[#e5c07b] border border-[#c69c59]/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[#c69c59]" />
                <span>Instalar</span>
              </button>
            </div>
          )}

          {/* Cloudflare D1 (Gerenciamento de Banco em Nuvem e Deploy) */}
          {onOpenCloudflareModal && (
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/50 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Cloud className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block flex items-center gap-1.5">
                    Cloudflare D1 & Nuvem
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                      SQL / R2
                    </span>
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Gerenciar banco D1, chave secreta, sincronização e Pages
                  </span>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-open-cloudflare"
                onClick={() => {
                  onClose();
                  onOpenCloudflareModal();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 shadow-sm active:scale-95"
              >
                <Cloud className="w-3.5 h-3.5 text-neutral-950" />
                <span>Gerenciar</span>
              </button>
            </div>
          )}

          {/* GitHub Auto-Deploy (Atualização Automática sem Mexer no Cloudflare) */}
          {onOpenGitHubModal && (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <FolderGit2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block flex items-center gap-1.5">
                    GitHub & Auto-Deploy
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      AUTOMÁTICO
                    </span>
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Publicar no GitHub para atualizar o Cloudflare sem mexer em ZIP
                  </span>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-open-github"
                onClick={() => {
                  onClose();
                  onOpenGitHubModal();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 shadow-sm active:scale-95"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Abrir</span>
              </button>
            </div>
          )}

          {/* 2. Quantidade de Abordados e Status do Banco */}
          <div className="p-3.5 rounded-xl bg-[#151923] border border-neutral-800 flex items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1b212f] border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b] flex-shrink-0">
                <Shield className="w-5 h-5 text-[#c69c59]" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">
                  Banco de Dados Operacional
                </span>
                <span className="text-base font-extrabold text-white">
                  {totalRecords} {totalRecords === 1 ? 'Abordado Cadastrado' : 'Abordados Cadastrados'}
                </span>
              </div>
            </div>

            {/* Opção Atualizar: mantida na versão web conforme solicitado */}
            {isWeb && (
              <button
                type="button"
                id="btn-settings-refresh"
                onClick={onRefreshAll}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252e42] text-[#e5c07b] border border-[#c69c59]/40 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex-shrink-0"
                title="Atualizar App e Banco de Dados"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
              </button>
            )}
          </div>

          {/* Exportar Cards para Outro Banco de Dados (Individual e Consolidado) */}
          <div className="p-3.5 rounded-xl bg-[#151923] border border-blue-500/30 space-y-2.5 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
                <Database className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block">
                  Exportar Cards para Outro Banco de Dados
                </span>
                <span className="text-[10px] text-neutral-400 block">
                  Exporte todos os {totalRecords} cards para migração ou integração em outro banco
                </span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Exportação completa com fotos, dados pessoais, endereços, artigos e vínculos formatados para importação em qualquer outro banco de dados (PostgreSQL, MongoDB, SQLite, Cloudflare, etc.).
            </p>

            {cardsExportFeedback && (
              <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-500/40 text-[11px] text-blue-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span>{cardsExportFeedback}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                id="btn-export-cards-zip"
                onClick={async () => {
                  if (suspects.length === 0) {
                    setCardsExportFeedback('Nenhum card cadastrado para exportar.');
                    return;
                  }
                  setIsExportingCards(true);
                  setCardsExportFeedback('Gerando pacote ZIP com cards individuais...');
                  try {
                    await exportAllCardsIndividualZip(suspects, (msg) => setCardsExportFeedback(msg));
                    setCardsExportFeedback(`✅ ${suspects.length} cards exportados individualmente em ZIP!`);
                  } catch (e: any) {
                    setCardsExportFeedback(`Erro: ${e.message}`);
                  } finally {
                    setIsExportingCards(false);
                    setTimeout(() => setCardsExportFeedback(null), 4000);
                  }
                }}
                disabled={isExportingCards || totalRecords === 0}
                className="py-2.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Gera um arquivo ZIP com 1 arquivo JSON individual para cada card"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isExportingCards ? 'Gerando ZIP...' : 'Baixar ZIP (Cards Individuais)'}</span>
              </button>

              <button
                type="button"
                id="btn-export-cards-json"
                onClick={() => {
                  if (suspects.length === 0) {
                    setCardsExportFeedback('Nenhum card cadastrado para exportar.');
                    return;
                  }
                  exportAllCardsConsolidatedJson(suspects);
                  setCardsExportFeedback(`✅ Arquivo JSON com ${suspects.length} cards baixado com sucesso!`);
                  setTimeout(() => setCardsExportFeedback(null), 3500);
                }}
                disabled={totalRecords === 0}
                className="py-2.5 px-2.5 rounded-lg bg-[#1c2230] hover:bg-[#252e42] text-blue-300 border border-blue-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Gera um único arquivo JSON contendo todos os cards juntos"
              >
                <FileJson className="w-3.5 h-3.5 text-blue-400" />
                <span>JSON Consolidado (Todos)</span>
              </button>
            </div>
          </div>

          {/* 3. Ações do Sistema: Senha Master, Gestão de Usuários e Sair da Conta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              id="btn-settings-security"
              onClick={() => {
                onClose();
                onOpenSecurityModal();
              }}
              className="p-3.5 rounded-xl bg-[#151923] hover:bg-[#1b212f] border border-[#c69c59]/30 hover:border-[#c69c59] text-left transition-all group cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1f2636] flex items-center justify-center text-[#c69c59]">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white text-xs block group-hover:text-[#e5c07b]">
                    Senha Master
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Proteção de exclusão
                  </span>
                </div>
              </div>
            </button>

            {onOpenUserManagementModal && (
              <button
                type="button"
                id="btn-settings-users"
                onClick={() => {
                  onClose();
                  onOpenUserManagementModal();
                }}
                className="p-3.5 rounded-xl bg-[#121927] hover:bg-[#182337] border border-blue-500/40 hover:border-blue-400 text-left transition-all group cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block group-hover:text-blue-300">
                      Gestão de Usuários
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Operadores e logs
                    </span>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Botão Sair da Conta nos Ajustes */}
          {onLogout && (
            <div className="p-3 rounded-xl bg-red-950/20 border border-red-900/40 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-950/50 border border-red-800/60 flex items-center justify-center text-red-400 flex-shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-red-200 uppercase tracking-wide block">
                    Sair da Conta Conectada
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Desconectar para logar em outro usuário
                  </span>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-logout"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-white font-bold text-xs flex items-center gap-1.5 border border-red-500/50 transition-all cursor-pointer shadow-sm active:scale-95 flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          )}

          {/* 4. Pacote de Download do Projeto Completo (src, componentes, package.json) */}
          <div className="p-3.5 rounded-xl bg-[#151923] border border-[#c69c59]/40 space-y-2.5 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1f2636] border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b] flex-shrink-0">
                <FolderArchive className="w-4 h-4 text-[#c69c59]" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block">
                  Código Fonte Completo do Projeto
                </span>
                <span className="text-[10px] text-neutral-400 block">
                  Baixe o app com todos os arquivos prontos para rodar
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0d1017] border border-neutral-800 text-[11px] text-neutral-300 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[#c69c59] font-mono pb-1 border-b border-neutral-800/80">
                <span>PACOTE OFICIAL COMPLETO</span>
                <span className="bg-[#c69c59]/20 px-1.5 py-0.5 rounded text-white font-bold">6.37 MB • 78 Arquivos</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span><strong>src/</strong> com todos os componentes, telas, modais e lógica</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span><strong>package.json</strong> com dependências, scripts e configurações</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span><strong>server.ts, index.html, vite.config.ts</strong> e banco local</span>
              </div>
            </div>

            {/* Status e Progresso de Download */}
            {downloadProgress && (
              <div className="p-2 rounded-lg bg-[#1a2233] border border-[#c69c59]/40 text-[11px] text-[#e5c07b] flex items-center gap-2 animate-pulse">
                <Download className="w-3.5 h-3.5 text-[#c69c59] flex-shrink-0" />
                <span className="font-semibold">{downloadProgress}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                id="btn-settings-download-full-zip"
                onClick={handleDownloadZip}
                disabled={isDownloadingZip}
                className="flex-1 py-2.5 px-3 rounded-lg bg-[#c69c59] hover:bg-[#d6aa64] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
              >
                <Download className={`w-3.5 h-3.5 ${isDownloadingZip ? 'animate-bounce' : ''}`} />
                <span>{isDownloadingZip ? 'Transferindo...' : 'Baixar ZIP Completo (6.37 MB)'}</span>
              </button>

              <a
                href="/codigos_completos_app.html"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-lg bg-[#1c2230] hover:bg-[#252e42] text-[#e5c07b] border border-[#c69c59]/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer no-underline"
                title="Visualizar todos os códigos em uma página HTML interativa"
              >
                <FileCode className="w-3.5 h-3.5 text-[#c69c59]" />
                <span>Ver Códigos</span>
              </a>
            </div>
          </div>
        </div>

        {/* Rodapé dos Ajustes com botão de Download ZIP */}
        <div className="px-5 py-3 border-t border-neutral-800/90 bg-[#141822] flex items-center justify-between text-neutral-400 text-[11px] gap-3">
          <span className="truncate hidden sm:inline">Sistema Tático Operacional</span>

          <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
            {/* Botão Ver Códigos Completos em HTML */}
            <a
              href="/codigos_completos_app.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252e42] text-[#e5c07b] border border-[#c69c59]/40 hover:border-[#c69c59] text-xs font-semibold transition-all active:scale-95 cursor-pointer no-underline"
              title="Abrir arquivo HTML com todos os códigos completos do app"
            >
              <FileCode className="w-3.5 h-3.5 text-[#c69c59]" />
              <span>Códigos HTML</span>
            </a>

            {/* Botão de Download ZIP do projeto */}
            <button
              type="button"
              id="btn-settings-download-zip"
              onClick={handleDownloadZip}
              disabled={isDownloadingZip}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252e42] text-[#e5c07b] border border-[#c69c59]/40 hover:border-[#c69c59] text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Baixar arquivo ZIP completo do código fonte do projeto (6.37 MB)"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingZip ? 'animate-bounce' : ''}`} />
              <span>{isDownloadingZip ? 'Transferindo...' : 'ZIP Completo (6.37 MB)'}</span>
            </button>

            {/* Botão Fechar */}
            <button
              type="button"
              id="btn-settings-done"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
