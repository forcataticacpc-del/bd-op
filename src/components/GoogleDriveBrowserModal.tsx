import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  FileText,
  FileSpreadsheet,
  FileCheck,
  File,
  Image as ImageIcon,
  Loader2,
  Folder,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  LogOut,
  FolderOpen,
} from 'lucide-react';
import { googleSignIn, getAccessToken, logoutGoogle } from '../utils/googleAuth';
import { User } from 'firebase/auth';

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  iconLink?: string;
}

interface GoogleDriveBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
}

export const GoogleDriveBrowserModal: React.FC<GoogleDriveBrowserModalProps> = ({
  isOpen,
  onClose,
  onFilesSelected,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [items, setItems] = useState<DriveItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [folderHistory, setFolderHistory] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'Meu Drive' },
  ]);
  const currentFolder = folderHistory[folderHistory.length - 1];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Auto-tenta obter token existente se logado
  useEffect(() => {
    if (!isOpen) return;

    const checkToken = async () => {
      const activeToken = await getAccessToken();
      if (activeToken) {
        setToken(activeToken);
        loadFolderFiles('root', activeToken);
      }
    };
    checkToken();
  }, [isOpen]);

  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await loadFolderFiles(currentFolder.id, result.accessToken);
      }
    } catch (err: any) {
      console.error('Falha de autenticação Google Drive:', err);
      setAuthError(err.message || 'Erro ao conectar com Google Drive. Permita a janela pop-up.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setItems([]);
    setSelectedItemIds(new Set());
  };

  const loadFolderFiles = async (folderId: string, activeToken?: string, query?: string) => {
    const useToken = activeToken || token;
    if (!useToken) return;

    setIsLoadingFiles(true);
    setAuthError(null);

    try {
      let q = `'${folderId}' in parents and trashed = false`;
      if (query && query.trim()) {
        q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;
      }

      const fields = 'files(id, name, mimeType, size, modifiedTime, thumbnailLink, iconLink)';
      const orderBy = 'folder,modifiedTime desc';
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&fields=${encodeURIComponent(fields)}&orderBy=${encodeURIComponent(
        orderBy
      )}&pageSize=80&supportsAllDrives=true&includeItemsFromAllDrives=true`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${useToken}`,
        },
      });

      if (response.status === 401) {
        // Token expirado, solicita novo login
        setToken(null);
        throw new Error('Sessão do Google Drive expirada. Faça login novamente.');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Erro ${response.status} ao listar Google Drive.`);
      }

      const data = await response.json();
      setItems(data.files || []);
    } catch (err: any) {
      console.error('Erro ao buscar arquivos no Google Drive:', err);
      setAuthError(err.message || 'Falha ao listar arquivos no Google Drive.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleNavigateFolder = (folderId: string, folderName: string) => {
    setFolderHistory((prev) => [...prev, { id: folderId, name: folderName }]);
    setSearchQuery('');
    setSelectedItemIds(new Set());
    loadFolderFiles(folderId);
  };

  const handleNavigateBack = (targetIndex: number) => {
    if (targetIndex >= folderHistory.length - 1) return;
    const newHistory = folderHistory.slice(0, targetIndex + 1);
    setFolderHistory(newHistory);
    setSearchQuery('');
    setSelectedItemIds(new Set());
    loadFolderFiles(newHistory[newHistory.length - 1].id);
  };

  const toggleSelect = (item: DriveItem) => {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      handleNavigateFolder(item.id, item.name);
      return;
    }

    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const selectAllCurrentFiles = () => {
    const fileItems = items.filter((it) => it.mimeType !== 'application/vnd.google-apps.folder');
    if (selectedItemIds.size === fileItems.length && fileItems.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(fileItems.map((f) => f.id)));
    }
  };

  // Baixa os arquivos selecionados do Drive e converte em File[] para o pipeline de IA
  const handleConfirmImport = async () => {
    if (!token || selectedItemIds.size === 0) return;

    setIsDownloading(true);
    setDownloadStatus('Iniciando transferência direta do Google Drive...');

    const selectedList = items.filter((it) => selectedItemIds.has(it.id));
    const convertedFiles: File[] = [];

    try {
      for (let i = 0; i < selectedList.length; i++) {
        const item = selectedList[i];
        setDownloadStatus(`Baixando (${i + 1}/${selectedList.length}): ${item.name}...`);

        let downloadUrl = `https://www.googleapis.com/drive/v3/files/${item.id}?alt=media&supportsAllDrives=true`;
        let effectiveMime = item.mimeType;

        // Se for Google Docs, Sheets ou Slides, faz export
        if (item.mimeType === 'application/vnd.google-apps.spreadsheet') {
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${item.id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
          effectiveMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (item.mimeType === 'application/vnd.google-apps.document') {
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${item.id}/export?mimeType=application/pdf`;
          effectiveMime = 'application/pdf';
        }

        const resp = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!resp.ok) {
          throw new Error(`Falha ao descarregar ${item.name} (${resp.status})`);
        }

        const blob = await resp.blob();
        let fileName = item.name;
        if (item.mimeType === 'application/vnd.google-apps.spreadsheet' && !fileName.endsWith('.xlsx')) {
          fileName += '.xlsx';
        } else if (item.mimeType === 'application/vnd.google-apps.document' && !fileName.endsWith('.pdf')) {
          fileName += '.pdf';
        }

        const file = new window.File([blob], fileName, { type: effectiveMime || blob.type });
        convertedFiles.push(file);
      }

      setDownloadStatus(`Transferência concluída com sucesso! Processando na IA...`);
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadStatus(null);
        onClose();
        onFilesSelected(convertedFiles);
      }, 500);
    } catch (err: any) {
      console.error('Erro na transferência dos arquivos:', err);
      setAuthError(err.message || 'Erro ao carregar arquivos do Google Drive.');
      setIsDownloading(false);
      setDownloadStatus(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="w-5 h-5 text-[#e5c07b] flex-shrink-0 fill-[#c69c59]/20" />;
    }
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-sky-400 flex-shrink-0" />;
    }
    if (
      mimeType.includes('sheet') ||
      mimeType.includes('excel') ||
      mimeType === 'application/vnd.google-apps.spreadsheet'
    ) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileCheck className="w-5 h-5 text-rose-400 flex-shrink-0" />;
    }
    if (
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      mimeType === 'application/vnd.google-apps.document'
    ) {
      return <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />;
    }
    return <File className="w-5 h-5 text-neutral-400 flex-shrink-0" />;
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '';
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return '';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="google-drive-browser-modal"
        className="relative w-full max-w-2xl bg-[#0f131c] border border-[#c69c59]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[750px] animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header da Caixa de Diálogo */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800 bg-[#141822]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c69c59]/20 border border-[#c69c59]/50 flex items-center justify-center text-[#e5c07b]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <span>Google Drive</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono">
                  Caixa de Diálogo
                </span>
              </h2>
              <span className="text-[10px] text-[#c69c59] font-mono block">
                Selecione documentos, planilhas, PDFs e fotos direto do Drive
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token && (
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800/80 transition-colors cursor-pointer"
                title="Desconectar do Google Drive"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              id="btn-close-drive-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Estado 1: Usuário Não Conectado */}
        {!token ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#171d2b] border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b] shadow-lg">
              <FolderOpen className="w-8 h-8 text-[#c69c59]" />
            </div>

            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                Solicitar Acesso ao Google Drive
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Conecte sua conta Google para navegar pelas suas pastas, pesquisar e carregar documentos e imagens diretamente sem sair do aplicativo.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center gap-2 max-w-md text-left">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Botão Oficial Sign in with Google */}
            <button
              type="button"
              id="btn-drive-sign-in"
              onClick={handleSignIn}
              disabled={isLoadingAuth}
              className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoadingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-700" />
                  <span>Conectando com o Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Conectar com Google Drive</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Estado 2: Conectado - Navegador de Arquivos do Drive */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Barra de Pesquisa e Navegação de Pastas (Breadcrumb) */}
            <div className="p-3 border-b border-neutral-800/90 bg-[#121622] space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadFolderFiles(currentFolder.id, undefined, searchQuery);
                      }
                    }}
                    placeholder="Pesquisar arquivos e pastas no Drive (pressione Enter)..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0b0e14] border border-neutral-700/80 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-[#c69c59]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => loadFolderFiles(currentFolder.id, undefined, searchQuery)}
                  disabled={isLoadingFiles}
                  className="px-3 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252e42] border border-[#c69c59]/40 text-[#e5c07b] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Atualizar pasta atual"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Buscar</span>
                </button>
              </div>

              {/* Breadcrumbs de Navegação */}
              <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 overflow-x-auto whitespace-nowrap py-0.5">
                {folderHistory.map((f, idx) => (
                  <React.Fragment key={f.id}>
                    {idx > 0 && <span className="text-neutral-600">/</span>}
                    <button
                      type="button"
                      onClick={() => handleNavigateBack(idx)}
                      className={`hover:text-[#e5c07b] transition-colors cursor-pointer ${
                        idx === folderHistory.length - 1 ? 'text-white font-bold' : 'text-neutral-400'
                      }`}
                    >
                      {f.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Aviso de Erro se houver */}
            {authError && (
              <div className="p-2.5 mx-3 mt-2 rounded-lg bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center justify-between">
                <span>{authError}</span>
                <button
                  type="button"
                  onClick={() => handleSignIn()}
                  className="text-xs font-bold text-red-300 underline ml-2 cursor-pointer"
                >
                  Reconectar
                </button>
              </div>
            )}

            {/* Lista de Arquivos e Pastas */}
            <div className="flex-1 overflow-y-auto p-3 divide-y divide-neutral-800/60">
              {isLoadingFiles ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-400 space-y-2">
                  <Loader2 className="w-7 h-7 text-[#c69c59] animate-spin" />
                  <span className="text-xs font-mono">Carregando conteúdos do Google Drive...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-500 space-y-1.5">
                  <Folder className="w-8 h-8 text-neutral-600" />
                  <span className="text-xs font-semibold text-neutral-300">Esta pasta está vazia</span>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Nenhum documento ou imagem compatível encontrado
                  </span>
                </div>
              ) : (
                items.map((item) => {
                  const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                  const isSelected = selectedItemIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelect(item)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-lg transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-[#1e2738] border border-[#c69c59]/60 shadow-sm'
                          : 'hover:bg-[#151a25]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {!isFolder ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-[#c69c59] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        ) : (
                          <div className="w-4" />
                        )}

                        {getFileIcon(item.mimeType)}

                        <div className="min-w-0 flex-1">
                          <span
                            className={`text-xs font-medium block truncate ${
                              isSelected
                                ? 'text-[#e5c07b] font-bold'
                                : 'text-neutral-200 group-hover:text-white'
                            }`}
                          >
                            {item.name}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono block">
                            {isFolder
                              ? 'Pasta'
                              : `${formatFileSize(item.size)} ${
                                  item.modifiedTime
                                    ? `• ${new Date(item.modifiedTime).toLocaleDateString('pt-BR')}`
                                    : ''
                                }`}
                          </span>
                        </div>
                      </div>

                      {isFolder && (
                        <span className="text-[10px] font-mono text-[#c69c59] group-hover:translate-x-1 transition-transform">
                          Abrir →
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé da Caixa de Diálogo com Seleção e Ação de Importar */}
            <div className="p-3 border-t border-neutral-800 bg-[#141822] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllCurrentFiles}
                  className="text-[11px] text-[#e5c07b] hover:underline font-mono cursor-pointer"
                >
                  {selectedItemIds.size > 0 ? 'Limpar Seleção' : 'Selecionar Arquivos'}
                </button>
                {selectedItemIds.size > 0 && (
                  <span className="text-[11px] text-neutral-400 font-mono">
                    ({selectedItemIds.size} selecionado{selectedItemIds.size > 1 ? 's' : ''})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  id="btn-drive-import-confirm"
                  onClick={handleConfirmImport}
                  disabled={selectedItemIds.size === 0 || isDownloading}
                  className="px-4 py-1.5 rounded-lg bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Importar ({selectedItemIds.size})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status flutuante de download se estiver baixando */}
            {downloadStatus && (
              <div className="px-4 py-2 bg-[#0c1017] border-t border-[#c69c59]/50 flex items-center gap-2 text-xs text-[#e5c07b] animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span className="truncate">{downloadStatus}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
