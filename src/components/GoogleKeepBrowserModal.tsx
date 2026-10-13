import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  StickyNote,
  Camera,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Download,
  Image as ImageIcon,
  Upload,
  LogOut,
  RefreshCw,
  Bell,
  UserPlus,
  Palette,
  MoreVertical,
  Undo,
  Redo,
  ClipboardPaste,
  FileText,
  Info,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { googleSignIn, getAccessToken, logoutGoogle } from '../utils/googleAuth';
import { User } from 'firebase/auth';
import { parseKeepFiles, ParsedKeepNote } from '../utils/keepParser';

export interface KeepCardItem {
  id: string;
  title: string;
  content: string;
  labels?: string[];
  color?: string; // Cor de fundo do Google Keep (#202124 padrão dark)
  updatedAt: string;
  photoUrl?: string; // Foto real do indivíduo/abordado anexada ao card
  isPinned?: boolean;
}

const STORAGE_KEY = 'tatico_keep_cards_v4';
const LEGACY_STORAGE_KEY = 'tatico_keep_cards_v3';

// Identificadores de notas fictícias para remoção
const MOCK_NOTE_IDS = new Set([
  'note-rafael-lopes',
  'note-carlos-eduardo',
  'note-marcos-vinicius',
  'keep-card-1',
  'keep-card-2',
  'keep-card-3',
]);

// Cores temáticas do Google Keep (Dark Theme)
export const KEEP_COLORS = [
  { name: 'Padrão Escuro', value: '#202124', border: '#5f6368' },
  { name: 'Coral / Vermelho', value: '#5c2b29', border: '#773533' },
  { name: 'Laranja / Âmbar', value: '#614a19', border: '#806222' },
  { name: 'Areia / Dourado', value: '#3c3f24', border: '#5b5f36' },
  { name: 'Verde Tático', value: '#243428', border: '#354d3b' },
  { name: 'Azul Petróleo', value: '#2d424b', border: '#3e5c68' },
  { name: 'Azul Escuro', value: '#1e3a5f', border: '#2d5386' },
  { name: 'Roxo Tático', value: '#42275e', border: '#5c3783' },
];

interface GoogleKeepBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPrintToAi: (file: File) => void;
  onDirectExtract?: (content: string, photoUrl?: string) => void;
}

export const GoogleKeepBrowserModal: React.FC<GoogleKeepBrowserModalProps> = ({
  isOpen,
  onClose,
  onSendPrintToAi,
  onDirectExtract,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  // Inicializa notas reais do usuário - removendo notas falsas
  const [notes, setNotes] = useState<KeepCardItem[]>(() => {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      }
      if (raw) {
        const parsed: KeepCardItem[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Filtra estritamente removendo os cards fictícios
          const realOnly = parsed.filter((n) => !MOCK_NOTE_IDS.has(n.id));
          return realOnly;
        }
      }
    } catch {
      // fallback vazio
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<KeepCardItem | null>(null);
  const [isCapturingPrint, setIsCapturingPrint] = useState(false);
  const [isExtractingDirect, setIsExtractingDirect] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modal para colar texto
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedContent, setPastedContent] = useState('');

  // Modal de confirmação de exclusão de card
  const [cardToDelete, setCardToDelete] = useState<KeepCardItem | null>(null);

  // Edição rápida de campos no card aberto
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | undefined>(undefined);

  const keepCardCaptureRef = useRef<HTMLDivElement>(null);
  const photoUploadInputRef = useRef<HTMLInputElement>(null);
  const keepFilesInputRef = useRef<HTMLInputElement>(null);

  // Auto-tenta obter token existente se logado
  useEffect(() => {
    if (!isOpen) return;

    const checkToken = async () => {
      const activeToken = await getAccessToken();
      if (activeToken) {
        setToken(activeToken);
        tryFetchKeepApi(activeToken);
      }
    };
    checkToken();
  }, [isOpen]);

  // Persiste no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.warn('Falha ao salvar notas do Keep localmente', err);
    }
  }, [notes]);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3800);
  };

  // Tenta buscar notas via API oficial do Google Keep
  const tryFetchKeepApi = async (accessToken: string) => {
    try {
      const res = await fetch('https://keep.googleapis.com/v1/notes', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.notes && Array.isArray(data.notes) && data.notes.length > 0) {
          const imported: KeepCardItem[] = data.notes.map((n: any, idx: number) => ({
            id: n.name || `keep-api-${Date.now()}-${idx}`,
            title: n.title || 'Nota do Keep',
            content: n.body?.text?.text || '',
            updatedAt: n.updateTime || new Date().toISOString(),
            color: '#202124',
            labels: ['Sincronizado Google Keep'],
          }));

          setNotes((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnly = imported.filter((item) => !existingIds.has(item.id));
            return [...newOnly, ...prev];
          });
          showNotice(`${imported.length} notas sincronizadas do Google Keep!`);
          setApiNotice(null);
          return;
        }
      } else {
        // 403 / 401 é o comportamento padrão do Google para contas pessoais @gmail.com
        setApiNotice(
          'O Google restringe o acesso direto da API do Keep a contas corporativas (Google Workspace). Para importar suas anotações pessoais do Keep, utilize os botões de "Importar Arquivos do Keep" ou "Colar Anotações" abaixo.'
        );
      }
    } catch {
      // Ignora erro silenciosamente e instrui os botões alternativos
      setApiNotice(
        'Contas pessoais do Google (@gmail.com) não autorizam leitura remota do Keep via API. Utilize abaixo a importação direta de arquivos do Keep (HTML/JSON/Takeout) ou cole as anotações.'
      );
    }
  };

  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    setApiNotice(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        showNotice(`Conectado como ${result.user.displayName || result.user.email || 'Usuário Google'}`);
        await tryFetchKeepApi(result.accessToken);
      }
    } catch (err: any) {
      console.error('Falha de autenticação Google:', err);
      setAuthError(err.message || 'Erro ao conectar conta Google. Permita a janela pop-up.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setApiNotice(null);
    showNotice('Desconectado do Google.');
  };

  // Importação de Arquivos do Keep (HTML, JSON, TXT do Takeout)
  const handleKeepFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    showNotice(`Processando ${files.length} arquivo(s) do Google Keep...`);
    try {
      const parsedNotes = await parseKeepFiles(files);
      if (parsedNotes.length > 0) {
        setNotes((prev) => [...parsedNotes, ...prev]);
        showNotice(`${parsedNotes.length} card(s) do Google Keep importado(s) com sucesso!`);
      } else {
        showNotice('Nenhuma anotação pôde ser extraída dos arquivos selecionados.');
      }
    } catch (err: any) {
      console.error('Erro ao importar arquivos do Keep:', err);
      showNotice('Erro ao ler arquivos do Keep: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  // Salvar nota colada manualmente
  const handleSavePastedNote = () => {
    if (!pastedContent.trim()) {
      showNotice('Cole o texto da anotação para criar o card.');
      return;
    }

    const newNote: KeepCardItem = {
      id: `keep-pasted-${Date.now()}`,
      title: pastedTitle.trim() || 'Anotação do Google Keep',
      content: pastedContent.trim(),
      updatedAt: new Date().toISOString(),
      color: '#202124',
      labels: ['Keep Colado'],
    };

    setNotes((prev) => [newNote, ...prev]);
    setIsPasteModalOpen(false);
    setPastedTitle('');
    setPastedContent('');
    showNotice('Card criado a partir da anotação com sucesso!');
  };

  const handleOpenNote = (note: KeepCardItem) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditPhotoUrl(note.photoUrl);
    setIsEditing(false);
  };

  const handleCloseFullCard = () => {
    setSelectedNote(null);
    setIsEditing(false);
  };

  const handleCreateNewNote = () => {
    const newNote: KeepCardItem = {
      id: `note-${Date.now()}`,
      title: 'Título da Nota',
      content: `NOME: \nALCUNHA: \nRG: \nCPF: \nMÃE: \nARTIGO: \nENDEREÇO: \nOBS: `,
      color: '#202124',
      updatedAt: new Date().toISOString(),
      labels: ['Novo Registro'],
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNote(newNote);
    setEditTitle(newNote.title);
    setEditContent(newNote.content);
    setEditPhotoUrl(undefined);
    setIsEditing(true);
  };

  const handleConfirmDeleteCard = () => {
    if (!cardToDelete) return;
    const targetId = cardToDelete.id;
    setNotes((prev) => prev.filter((n) => n.id !== targetId));
    if (selectedNote?.id === targetId) {
      setSelectedNote(null);
    }
    setCardToDelete(null);
    showNotice('Card excluído com sucesso.');
  };

  const handleClearAllCards = () => {
    if (notes.length === 0) return;
    setNotes([]);
    setSelectedNote(null);
    localStorage.removeItem(STORAGE_KEY);
    showNotice('Todos os cards foram removidos.');
  };

  const handleSaveCardEdits = () => {
    if (!selectedNote) return;
    const updated: KeepCardItem = {
      ...selectedNote,
      title: editTitle.trim() || 'Título',
      content: editContent.trim(),
      photoUrl: editPhotoUrl,
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setSelectedNote(updated);
    setIsEditing(false);
    showNotice('Card salvo com sucesso!');
  };

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setEditPhotoUrl(dataUrl);
      if (selectedNote) {
        const updated = { ...selectedNote, photoUrl: dataUrl };
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setSelectedNote(updated);
      }
      showNotice('Foto adicionada ao card!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Captura do Print do Card para IA
  const handleCapturePrintAndSendToAi = async () => {
    if (!keepCardCaptureRef.current || !selectedNote) return;

    setIsCapturingPrint(true);
    setNotification('Capturando print em alta definição do card...');

    try {
      const canvas = await html2canvas(keepCardCaptureRef.current, {
        scale: 2.2,
        backgroundColor: '#202124',
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error('Falha ao renderizar print do card.');
          }

          const safeTitle = (selectedNote.title || 'keep_card')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .toLowerCase();
          const fileName = `keep_print_${safeTitle}_${Date.now()}.png`;
          const file = new window.File([blob], fileName, { type: 'image/png' });

          setIsCapturingPrint(false);
          setNotification('Print capturado! Enviando para leitura por IA...');

          setTimeout(() => {
            onClose();
            onSendPrintToAi(file);
          }, 350);
        },
        'image/png',
        0.95
      );
    } catch (err: any) {
      console.error('Erro ao printar o card do Keep:', err);
      setIsCapturingPrint(false);
      setNotification('Erro ao gerar print do card: ' + (err.message || 'Tente novamente'));
    }
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.labels?.some((l) => l.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      >
        <div
          id="google-keep-browser-modal"
          className="relative w-full max-w-3xl bg-[#0f131c] border border-[#c69c59]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[780px] animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800 bg-[#141822]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
                <StickyNote className="w-4 h-4 fill-amber-400/20" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <span>GOOGLE KEEP • IMPORTADOR DE CARDS</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950/80 text-amber-300 border border-amber-500/40 font-mono">
                    {notes.length} CARDS
                  </span>
                </h2>
                <span className="text-[10px] text-[#c69c59] font-mono block">
                  Visualize, importe notas e extraia fotos e fichas com Inteligência Artificial
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {token && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800/80 transition-colors cursor-pointer"
                  title="Desconectar conta Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                id="btn-close-keep-dialog"
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Aviso Obrigatório: Em Fase de Testes */}
          <div className="px-4 py-2 bg-amber-950/50 border-b border-amber-500/50 text-amber-200 text-xs flex items-center gap-2 shadow-inner">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="leading-snug">
              <strong className="text-amber-300 font-bold uppercase tracking-wider text-[11px] mr-1">
                * Em fase de testes:
              </strong>
              Não garantimos o resultado, pois teremos que fazer vários testes ainda.
            </span>
          </div>

          {/* Notificação Temporária */}
          {notification && (
            <div className="px-4 py-2 bg-[#1b2230] border-b border-[#c69c59]/40 text-[#e5c07b] text-xs font-mono flex items-center gap-2 animate-fadeIn">
              {isCapturingPrint ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="truncate">{notification}</span>
            </div>
          )}

          {/* Aviso sobre a política da API do Google Keep se aplicável */}
          {apiNotice && (
            <div className="px-4 py-2.5 bg-amber-950/40 border-b border-amber-500/40 text-amber-200 text-[11px] flex items-start gap-2.5 leading-relaxed">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{apiNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setApiNotice(null)}
                className="text-amber-400 hover:text-white text-xs font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Barra de Ações de Importação Direta */}
          <div className="p-3 border-b border-neutral-800 bg-[#121622] flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por nome, RG, artigo ou termo..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0b0e14] border border-neutral-700/80 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-[#c69c59]"
              />
            </div>

            {/* Inputs de Arquivos Ocultos */}
            <input
              type="file"
              ref={keepFilesInputRef}
              onChange={handleKeepFilesSelected}
              accept=".html,.htm,.json,.txt,image/*"
              multiple
              className="hidden"
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Botão Importar Arquivo do Keep */}
              <button
                type="button"
                onClick={() => keepFilesInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#182030] hover:bg-[#222c42] text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Importar arquivos do Google Takeout (HTML, JSON, TXT ou imagens do Keep)"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Importar Arquivos</span>
              </button>

              {/* Botão Colar Anotações */}
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#182030] hover:bg-[#222c42] text-[#e5c07b] border border-[#c69c59]/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Colar texto de notas copiadas do Google Keep"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Colar Texto</span>
              </button>

              {/* Botão Nova Nota */}
              <button
                type="button"
                onClick={handleCreateNewNote}
                className="px-3 py-1.5 rounded-lg bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Card</span>
              </button>

              {/* Conectar Google se não logado */}
              {!token && (
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isLoadingAuth}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Conectar com conta Google"
                >
                  {isLoadingAuth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StickyNote className="w-3.5 h-3.5 text-amber-400" />}
                  <span>Login Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Lista dos Cards do Keep */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60 p-2">
            {filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <StickyNote className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Nenhum Card Cadastrado no Momento
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Você pode importar seus cards reais do Google Keep utilizando a exportação do <strong>Google Takeout (arquivos HTML/JSON)</strong>, colando o texto de anotações ou carregando prints das notas com fotos.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => keepFilesInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs uppercase flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Importar Arquivos do Keep</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#182030] hover:bg-[#222c42] text-amber-300 border border-amber-500/40 font-bold text-xs uppercase flex items-center gap-2 cursor-pointer"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>Colar Texto de Anotações</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateNewNote}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Card Manual</span>
                  </button>
                </div>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleOpenNote(note)}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#151c29] transition-colors cursor-pointer group rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {note.photoUrl ? (
                      <div className="w-11 h-11 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-900 flex-shrink-0 shadow-sm group-hover:border-[#c69c59] transition-colors">
                        <img
                          src={note.photoUrl}
                          alt={note.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#18202f] border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                        <StickyNote className="w-5 h-5 fill-amber-400/20" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white group-hover:text-[#e5c07b] truncate transition-colors flex items-center gap-2">
                        <span>{note.title || 'Sem título'}</span>
                        {note.photoUrl && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
                            Com Foto
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate max-w-lg font-mono">
                        {note.content.split('\n')[0] || 'Sem dados adicionais'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setCardToDelete(note)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Excluir este card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenNote(note)}
                      className="px-3 py-1 rounded-lg bg-[#182030] hover:bg-[#222c42] text-[#e5c07b] border border-[#c69c59]/40 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
                    >
                      Abrir →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé */}
          <div className="px-4 py-3 border-t border-neutral-800 bg-[#121622] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {notes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllCards}
                  className="text-[11px] text-rose-400/80 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  Limpar todos os cards
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DO CARD ABERTO EM TELA CHEIA */}
      {selectedNote && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fadeIn"
          onClick={handleCloseFullCard}
        >
          <div
            id="keep-full-card-modal-container"
            className="relative w-full max-w-lg bg-[#202124] border border-[#3c4043] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra de Ação Superior */}
            <div className="px-4 py-2.5 bg-[#17191d] border-b border-[#3c4043] flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                <span>Card Aberto • Google Keep</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-print-keep-card-action"
                  onClick={handleCapturePrintAndSendToAi}
                  disabled={isCapturingPrint}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-neutral-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Capturar print completo e extrair via IA para cadastrar novo abordado"
                >
                  {isCapturingPrint ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-neutral-950" />
                      <span>Extrair para Ficha por IA</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCloseFullCard}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Container Alvo do Print */}
            <div
              ref={keepCardCaptureRef}
              id="google-keep-exact-capture-target"
              className="flex-1 overflow-y-auto bg-[#202124] text-white flex flex-col"
            >
              {/* Foto anexada */}
              {selectedNote.photoUrl ? (
                <div className="relative w-full bg-black/90 max-h-[380px] overflow-hidden flex items-center justify-center group">
                  <img
                    src={selectedNote.photoUrl}
                    alt={selectedNote.title}
                    className="w-full max-h-[380px] object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditPhotoUrl(undefined);
                      const updated = { ...selectedNote, photoUrl: undefined };
                      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
                      setSelectedNote(updated);
                    }}
                    className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 text-neutral-300 hover:text-red-400 transition-colors cursor-pointer"
                    title="Remover foto do card"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="p-3 border-b border-[#3c4043] flex items-center justify-between bg-[#1a1b1e]">
                  <span className="text-xs text-neutral-400 font-mono">Sem foto anexada</span>
                  <input
                    type="file"
                    ref={photoUploadInputRef}
                    onChange={handleUploadPhoto}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => photoUploadInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Anexar Foto ao Card</span>
                  </button>
                </div>
              )}

              {/* Texto do card */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título"
                      className="w-full bg-transparent border-b border-[#5f6368] text-white text-base font-bold pb-1 focus:outline-none focus:border-amber-400"
                    />

                    <textarea
                      rows={10}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Criar uma nota..."
                      className="w-full bg-transparent text-neutral-200 text-sm font-mono leading-relaxed resize-none focus:outline-none"
                    />

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1 rounded-lg bg-neutral-800 text-xs text-neutral-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCardEdits}
                        className="px-3 py-1 rounded-lg bg-amber-500 text-neutral-950 font-bold text-xs"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setIsEditing(true)} className="cursor-text space-y-2">
                    <h3 className="text-base font-bold text-white">
                      {selectedNote.title || 'Título'}
                    </h3>

                    <div className="text-neutral-200 text-xs sm:text-sm font-mono whitespace-pre-wrap leading-relaxed">
                      {selectedNote.content}
                    </div>
                  </div>
                )}

                <div className="pt-4 text-right">
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Editada: {new Date(selectedNote.updatedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Barra inferior */}
              <div className="px-4 py-2.5 border-t border-[#3c4043]/60 flex items-center justify-between text-neutral-400">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => photoUploadInputRef.current?.click()}
                    className="hover:text-white transition-colors"
                    title="Adicionar imagem"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="hover:text-white transition-colors"
                    title="Editar texto"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCloseFullCard}
                  className="px-4 py-1.5 rounded-lg text-white hover:bg-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA COLAR TEXTO DE ANOTAÇÕES */}
      {isPasteModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsPasteModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#141824] border border-amber-500/50 rounded-2xl p-5 shadow-2xl space-y-4 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Colar Anotação do Google Keep
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-bold mb-1">Título da Nota (Opcional):</label>
                <input
                  type="text"
                  value={pastedTitle}
                  onChange={(e) => setPastedTitle(e.target.value)}
                  placeholder="Ex: Suspeito Tráfico - Vulgo Dudu"
                  className="w-full px-3 py-2 rounded-xl bg-[#0d1017] border border-neutral-700 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">Conteúdo da Anotação:</label>
                <textarea
                  rows={8}
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder="Cole aqui o texto copiado do Google Keep com nome, alcunha, RG, mãe, histórico, etc."
                  className="w-full px-3 py-2 rounded-xl bg-[#0d1017] border border-neutral-700 text-white font-mono outline-none focus:border-amber-400 resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePastedNote}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-md"
              >
                Adicionar aos Cards
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CARD (IN-APP) */}
      {cardToDelete && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn"
          onClick={() => setCardToDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-[#141824] border border-rose-500/60 rounded-2xl p-5 shadow-2xl space-y-4 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-300">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Excluir Card?
              </h3>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Deseja realmente remover o card <strong className="text-white">&quot;{cardToDelete.title}&quot;</strong> do importador?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCardToDelete(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCard}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
