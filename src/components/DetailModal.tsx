import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Trash2,
  Copy,
  Check,
  MapPin,
  ExternalLink,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  CreditCard,
  Tag,
  FileText,
  Share2,
  Skull,
  Lock,
  Crosshair,
  UserCheck,
  Clock,
  Car,
  Users,
  Plus,
  ShieldAlert,
  Network,
  AlertTriangle,
  ScanLine,
  FileJson,
} from 'lucide-react';
import { SuspectRecord, AbordagemRecord, OrcrimRecord, VinculoPessoaRecord } from '../types';
import { formatPhotoUrl, extractSuspectPhotos } from '../utils/googleSheetsApi';
import { parseArticlesString } from '../data/legalArticles';
import { getMotherName, getBirthDate, getCleanAddress, formatDateBr } from './SuspectCard';
import { shareSuspectWithAllPhotos, stripEmojis } from '../utils/shareUtils';
import { getAbordagensBySuspectId, deleteAbordagem } from '../utils/abordagensStorage';
import { getAllOrcrims, unlinkSuspectFromOrcrim } from '../utils/orcrimStorage';
import { saveSuspect } from '../utils/storage';
import { saveSuspectToRealtimeCloud } from '../utils/firebaseSync';
import { saveSuspectToCloudflare, getActiveBackendProvider } from '../utils/cloudflareApi';
import { exportSingleCardJson } from '../utils/exportCards';
import { NovaAbordagemModal } from './NovaAbordagemModal';
import { VinculoPessoaModal } from './VinculoPessoaModal';
import { VinculoPessoaDetailModal } from './VinculoPessoaDetailModal';

interface DetailModalProps {
  suspect: SuspectRecord | null;
  onClose: () => void;
  onEdit: (suspect: SuspectRecord) => void;
  onDeleteRequest: (suspect: SuspectRecord) => void;
  onOpenFacialMatch?: (suspect: SuspectRecord) => void;
  allSuspects?: SuspectRecord[];
  onRequestNovoCadastro?: (nomeInicial: string) => void;
  onUpdate?: (updatedSuspect: SuspectRecord) => void;
}

export type DetailTab = 'dados' | 'vinculos' | 'abordagens';

export const DetailModal: React.FC<DetailModalProps> = ({
  suspect,
  onClose,
  onEdit,
  onDeleteRequest,
  onOpenFacialMatch,
  allSuspects = [],
  onRequestNovoCadastro,
  onUpdate,
}) => {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Abas do Card: Dados, Vínculos, Abordagens
  const [activeTab, setActiveTab] = useState<DetailTab>('dados');

  // Modal para registrar nova abordagem
  const [isNovaAbordagemOpen, setIsNovaAbordagemOpen] = useState(false);

  // Lista de abordagens do abordado
  const [suspectAbordagens, setSuspectAbordagens] = useState<AbordagemRecord[]>([]);

  // Facções / Vínculos em que este abordado está cadastrado
  const [faccoesVinculadas, setFaccoesVinculadas] = useState<Array<{ orcrim: OrcrimRecord; funcao?: string; membroId?: string }>>([]);
  const [vinculoOrcrimToDelete, setVinculoOrcrimToDelete] = useState<{
    orcrimId: string;
    membroId: string;
    orcrimNome: string;
  } | null>(null);

  // Vínculos de Pessoas (Familiares, Comparsas e Relações de Fuga)
  const [vinculosPessoas, setVinculosPessoas] = useState<VinculoPessoaRecord[]>(() => suspect?.vinculosPessoas || []);
  const [isAddVinculoPessoaOpen, setIsAddVinculoPessoaOpen] = useState(false);
  const [editingVinculoPessoa, setEditingVinculoPessoa] = useState<VinculoPessoaRecord | null>(null);
  const [selectedVinculoPessoaDetail, setSelectedVinculoPessoaDetail] = useState<VinculoPessoaRecord | null>(null);

  // Extrai as fotos reais recebidas da API ou armazenadas no registro
  const photos = extractSuspectPhotos(suspect);
  const currentPhotoRaw = photos[activePhotoIdx] || photos[0] || '';
  const currentPhoto = formatPhotoUrl(currentPhotoRaw);

  useEffect(() => {
    setActivePhotoIdx(0);
    setImageError(false);
    setActiveSrc(currentPhoto);
    setActiveTab('dados');
    setVinculosPessoas(suspect?.vinculosPessoas || []);

    if (suspect) {
      loadSuspectAbordagens();
      loadSuspectVinculos();
    }
  }, [suspect?.id]);

  const handleSaveVinculoPessoa = async (vinculo: VinculoPessoaRecord) => {
    if (!suspect) return;
    const current = [...(vinculosPessoas || [])];
    const idx = current.findIndex((v) => v.id === vinculo.id);
    if (idx >= 0) {
      current[idx] = vinculo;
    } else {
      current.unshift(vinculo);
    }
    setVinculosPessoas(current);
    const updatedSuspect: SuspectRecord = {
      ...suspect,
      vinculosPessoas: current,
    };
    await saveSuspect(updatedSuspect);
    setIsAddVinculoPessoaOpen(false);
    setEditingVinculoPessoa(null);
  };

  const handleDeleteVinculoPessoa = async (id: string) => {
    if (!suspect) return;
    if (confirm('Confirma a remoção deste vínculo de pessoa?')) {
      const updated = vinculosPessoas.filter((v) => v.id !== id);
      setVinculosPessoas(updated);
      const updatedSuspect: SuspectRecord = {
        ...suspect,
        vinculosPessoas: updated,
      };
      await saveSuspect(updatedSuspect);
      setSelectedVinculoPessoaDetail(null);
    }
  };

  const [abordagemToDeleteId, setAbordagemToDeleteId] = useState<string | null>(null);

  const handleDeleteAbordagem = (abordagemId: string) => {
    setAbordagemToDeleteId(abordagemId);
  };

  const handleConfirmDeleteAbordagem = async () => {
    if (!abordagemToDeleteId) return;
    const abordagemId = abordagemToDeleteId;
    deleteAbordagem(abordagemId);
    setSuspectAbordagens((prev) => prev.filter((a) => a.id !== abordagemId));

    if (suspect) {
      const updatedSuspect: SuspectRecord = {
        ...suspect,
        localAbordagem: '',
        horaAbordagem: '',
        localAbordagemCoords: undefined,
      };
      if (onUpdate) onUpdate(updatedSuspect);
      await saveSuspect(updatedSuspect);
      saveSuspectToRealtimeCloud(updatedSuspect).catch(() => {});
      if (getActiveBackendProvider() === 'cloudflare') {
        saveSuspectToCloudflare(updatedSuspect).catch(() => {});
      }
    }
    setAbordagemToDeleteId(null);
    window.dispatchEvent(new CustomEvent('abordagens_updated'));
  };

  const handleDeleteVinculoOrcrim = (orcrimId: string, membroId: string, orcrimNome: string) => {
    setVinculoOrcrimToDelete({ orcrimId, membroId, orcrimNome });
  };

  const handleConfirmDeleteVinculoOrcrim = async () => {
    if (!vinculoOrcrimToDelete) return;
    try {
      await unlinkSuspectFromOrcrim(vinculoOrcrimToDelete.orcrimId, vinculoOrcrimToDelete.membroId);
      await loadSuspectVinculos();
    } catch (e) {
      console.warn('Erro ao desvincular facção:', e);
    } finally {
      setVinculoOrcrimToDelete(null);
    }
  };

  const loadSuspectAbordagens = () => {
    if (!suspect) return;
    let list = getAbordagensBySuspectId(suspect.id, suspect.nome);
    if (list.length === 0 && (suspect.localAbordagem || suspect.horaAbordagem)) {
      list = [
        {
          id: `ab-auto-${suspect.id}`,
          suspectId: suspect.id,
          suspectNome: suspect.nome,
          suspectAlcunha: suspect.alcunha || undefined,
          suspectRg: suspect.rg || undefined,
          suspectCpf: suspect.cpf || undefined,
          suspectFoto: suspect.fotos && suspect.fotos[0] ? suspect.fotos[0] : undefined,
          data: suspect.dataCriacao ? new Date(suspect.dataCriacao).toLocaleDateString('pt-BR') : '10/10/2026',
          hora: suspect.horaAbordagem || '15:30',
          endereco: suspect.localAbordagem || suspect.endereco || 'Endereço registrado no banco',
          coordenadas: suspect.coordenadas || undefined,
          viatura: suspect.bpm ? `Equipe ${suspect.bpm}` : 'VP Operacional',
          natureza: 'Abordagem Policial e Identificação',
          observacoes: suspect.observacoes || undefined,
          criadoEm: suspect.dataCriacao || new Date().toISOString(),
        },
      ];
    }
    setSuspectAbordagens(list);
  };

  const loadSuspectVinculos = async () => {
    if (!suspect) return;
    try {
      const orcrims = await getAllOrcrims();
      const vinculadas: Array<{ orcrim: OrcrimRecord; funcao?: string; membroId?: string }> = [];

      orcrims.forEach((orc) => {
        const membro = orc.membros?.find(
          (m) =>
            m.suspectId === suspect.id ||
            m.nome.trim().toUpperCase() === suspect.nome.trim().toUpperCase()
        );
        if (membro) {
          const funcaoName = membro.funcaoPersonalizada || membro.funcao.replace('_', ' ');
          vinculadas.push({ orcrim: orc, funcao: funcaoName, membroId: membro.id });
        }
      });

      setFaccoesVinculadas(vinculadas);
    } catch (e) {
      console.warn('Erro ao carregar vínculos de orcrim:', e);
    }
  };

  const handleSelectPhoto = (index: number) => {
    setImageError(false);
    setActivePhotoIdx(index);
    setActiveSrc(formatPhotoUrl(photos[index]));
  };

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (photos.length <= 1) return;
    setImageError(false);
    const prev = activePhotoIdx > 0 ? activePhotoIdx - 1 : photos.length - 1;
    setActivePhotoIdx(prev);
    setActiveSrc(formatPhotoUrl(photos[prev]));
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (photos.length <= 1) return;
    setImageError(false);
    const next = activePhotoIdx < photos.length - 1 ? activePhotoIdx + 1 : 0;
    setActivePhotoIdx(next);
    setActiveSrc(formatPhotoUrl(photos[next]));
  };

  // Touch swipe para passar fotos no celular
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || photos.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNextPhoto();
      } else {
        handlePrevPhoto();
      }
    }
    setTouchStartX(null);
  };

  // Keyboard navigation for full-screen zoom and modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoomOpen) {
          setIsZoomOpen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen, activePhotoIdx, photos.length]);

  if (!suspect) return null;

  const copyToClipboard = (text: string | undefined, fieldName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Compartilhamento com envio de foto e dados da ficha
  const handleShare = async () => {
    if (!suspect || isSharing) return;
    setIsSharing(true);
    try {
      const res = await shareSuspectWithAllPhotos(suspect);
      if (res.success) {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Erro durante o compartilhamento:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const getCoords = (): { lat: number; lng: number } | null => {
    if (suspect.localAbordagemCoords?.lat && suspect.localAbordagemCoords?.lng) {
      return suspect.localAbordagemCoords;
    }
    if (suspect.coordenadas && suspect.coordenadas.includes(',')) {
      const parts = suspect.coordenadas.split(',');
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    return null;
  };

  const getGoogleMapsUrl = () => {
    const coords = getCoords();
    if (coords) {
      return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
    }
    if (suspect.localAbordagem) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        suspect.localAbordagem
      )}`;
    }
    return null;
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fadeIn"
        onClick={onClose}
      >
        <div
          id="detail-modal-container"
          className="relative w-full max-w-xl my-auto bg-[#0a0d14] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header: Compartilhar no topo junto a Ficha do Abordado e ações */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800/80 bg-[#0d111a]">
            {/* Left: Título discreto e Marcador */}
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#c69c59] shadow-[0_0_8px_rgba(198,156,89,0.6)]" />
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider font-mono">
                Ficha do Abordado
              </span>
              {suspect.marcador && suspect.marcador !== 'NENHUM' && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase border tracking-wider shadow-sm ${
                    suspect.marcador === 'MORTO'
                      ? 'bg-red-950/90 border-red-500/80 text-red-200'
                      : suspect.marcador === 'PRESO'
                      ? 'bg-slate-500/95 border-slate-300 text-slate-100 font-extrabold'
                      : suspect.marcador === 'FORAGIDO'
                      ? 'bg-yellow-400 border-yellow-300 text-neutral-950 font-black'
                      : 'bg-[#5e351f]/95 border-[#9c552e] text-[#fadcce] font-extrabold'
                  }`}
                >
                  {suspect.marcador === 'MORTO' && <Skull className="w-3 h-3 text-red-400" />}
                  {suspect.marcador === 'PRESO' && <Lock className="w-3 h-3 text-slate-100" />}
                  {suspect.marcador === 'FORAGIDO' && <AlertTriangle className="w-3 h-3 text-neutral-950" />}
                  {(suspect.marcador === 'ALVO_PRIORITARIO' || suspect.marcador === 'ALVO PRIORITARIO') && (
                    <Crosshair className="w-3 h-3 text-[#f09a6c]" />
                  )}
                  <span>{suspect.marcador.replace('_', ' ')}</span>
                </span>
              )}
            </div>

            {/* Right: Compartilhar no topo, Editar, Delete e Fechar */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Botão Compartilhar no TOPO conforme solicitado */}
              <button
                type="button"
                id="btn-share-top-detail"
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0e2a1d] hover:bg-[#133827] border border-emerald-600/70 text-emerald-300 hover:text-white font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                title="Compartilhar Ficha"
              >
                {isSharing ? (
                  <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                ) : shareSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="hidden sm:inline">Compartilhar</span>
              </button>

              {/* Exportar Card Individual em JSON */}
              <button
                type="button"
                id="btn-export-single-card"
                onClick={() => exportSingleCardJson(suspect)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#162033] hover:bg-[#1f2d47] border border-blue-500/40 text-blue-300 font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Exportar dados completos deste card em JSON para importar em outro banco de dados"
              >
                <FileJson className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Exportar Card</span>
              </button>

              {/* Editar */}
              <button
                type="button"
                id="btn-edit-detail"
                onClick={() => onEdit(suspect)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#c69c59] hover:bg-[#d8ae68] text-neutral-950 font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                title="Editar Informações"
              >
                <Edit3 className="w-3.5 h-3.5 text-neutral-950" />
                <span className="hidden sm:inline">Editar</span>
              </button>

              {/* Delete / Lixeira */}
              <button
                type="button"
                id="btn-delete-detail"
                onClick={() => onDeleteRequest(suspect)}
                className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-400 hover:text-red-300 transition-all cursor-pointer active:scale-95"
                title="Excluir Registro"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                id="btn-close-detail-modal"
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-all cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* FOTO DO ABORDADO: SEMPRE APARECE (mesmo alternando entre Dados, Vínculos ou Abordagens) */}
            <div
              className="relative aspect-[4/3] sm:aspect-[16/11] w-full rounded-xl overflow-hidden bg-black border border-neutral-800 shadow-inner flex items-center justify-center group/photo select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {(activeSrc || currentPhoto) && !imageError ? (
                <>
                  <img
                    src={activeSrc || currentPhoto}
                    alt={suspect.nome}
                    className="w-full h-full object-contain max-h-[420px]"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      const current = activeSrc || currentPhoto;
                      if (current.includes('lh3.googleusercontent.com/d/')) {
                        const match = current.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        if (match && match[1]) {
                          setActiveSrc(`https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`);
                          return;
                        }
                      } else if (current.includes('drive.google.com/thumbnail?id=')) {
                        const match = current.match(/id=([a-zA-Z0-9_-]+)/);
                        if (match && match[1]) {
                          setActiveSrc(`https://lh3.googleusercontent.com/d/${match[1]}`);
                          return;
                        }
                      }
                      setImageError(true);
                    }}
                  />

                  {/* Photo Counter Pill */}
                  {photos.length > 1 && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-neutral-700 text-white text-[11px] font-mono font-medium shadow-md pointer-events-none">
                      Foto {activePhotoIdx + 1} de {photos.length}
                    </div>
                  )}

                  {/* Previous & Next Navigation Arrows on Main Photo */}
                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevPhoto}
                        aria-label="Foto anterior"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-85 hover:opacity-100 active:scale-90 cursor-pointer shadow-xl z-10"
                      >
                        <ChevronLeft className="w-6 h-6 text-white" />
                      </button>

                      <button
                        type="button"
                        onClick={handleNextPhoto}
                        aria-label="Próxima foto"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-85 hover:opacity-100 active:scale-90 cursor-pointer shadow-xl z-10"
                      >
                        <ChevronRight className="w-6 h-6 text-white" />
                      </button>

                      {/* Pontos discretos indicadores da foto */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 z-10">
                        {photos.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectPhoto(idx)}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${
                              idx === activePhotoIdx
                                ? 'w-5 bg-[#e5c07b]'
                                : 'w-1.5 bg-white/40 hover:bg-white/70'
                            }`}
                            aria-label={`Foto ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Scan Facial 1:1 e Ampliar Buttons */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10">
                    {onOpenFacialMatch && (
                      <button
                        type="button"
                        id="btn-facial-match-detail"
                        onClick={() => onOpenFacialMatch(suspect)}
                        className="px-2.5 sm:px-3 py-1 rounded-full bg-black/80 hover:bg-[#1f2637] text-[#e5c07b] text-xs font-bold border border-[#c69c59]/60 flex items-center gap-1.5 backdrop-blur-sm shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
                        title="Confrontar fisionomia do abordado in loco com esta foto (1:1)"
                      >
                        <ScanLine className="w-3.5 h-3.5 text-[#c69c59]" />
                        <span>Scan Facial</span>
                      </button>
                    )}

                    <button
                      type="button"
                      id="btn-zoom-photo"
                      onClick={() => setIsZoomOpen(true)}
                      className="px-3 py-1 rounded-full bg-black/80 hover:bg-black text-white text-xs font-medium border border-neutral-700/80 flex items-center gap-1.5 backdrop-blur-sm shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
                      title="Ampliar Foto"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-[#e5c07b]" />
                      <span>Ampliar</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#141923] to-[#0c0f16] text-neutral-500 p-8 select-none">
                  <div className="w-24 h-24 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mb-3 shadow-inner">
                    <User className="w-12 h-12 text-neutral-400" />
                  </div>
                  <span className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase">
                    Sem Foto Cadastrada
                  </span>
                  <span className="text-[10px] text-neutral-600 font-mono mt-1 tracking-wider uppercase">
                    Banco de Dados
                  </span>
                </div>
              )}
            </div>

            {/* Miniaturas das Fotos abaixo da Foto Principal (conforme Imagem 2 do usuário) */}
            {photos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none no-scrollbar pt-0.5">
                {photos.map((p, idx) => {
                  const src = formatPhotoUrl(p);
                  const isSelected = idx === activePhotoIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPhoto(idx)}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 transition-all cursor-pointer bg-black ${
                        isSelected
                          ? 'ring-2 ring-amber-400 border-2 border-amber-400 scale-102 shadow-lg shadow-amber-500/20'
                          : 'border border-neutral-700/80 hover:border-neutral-500 opacity-75 hover:opacity-100'
                      }`}
                      title={`Foto ${idx + 1}`}
                    >
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* ABAS: DADOS, VÍNCULOS, ABORDAGENS (Substituindo o antigo Copiar Tudo e Compartilhar) */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#121622] rounded-xl border border-neutral-800">
              {/* Aba 1: Dados */}
              <button
                type="button"
                id="tab-btn-dados"
                onClick={() => setActiveTab('dados')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'dados'
                    ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 shadow-md font-extrabold'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dados</span>
              </button>

              {/* Aba 2: Vínculos */}
              <button
                type="button"
                id="tab-btn-vinculos"
                onClick={() => setActiveTab('vinculos')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'vinculos'
                    ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 shadow-md font-extrabold'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Vínculos</span>
                {faccoesVinculadas.length > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                      activeTab === 'vinculos'
                        ? 'bg-neutral-950 text-[#e5c07b]'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {faccoesVinculadas.length}
                  </span>
                )}
              </button>

              {/* Aba 3: Abordagens */}
              <button
                type="button"
                id="tab-btn-abordagens"
                onClick={() => setActiveTab('abordagens')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'abordagens'
                    ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 shadow-md font-extrabold'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Abordagens</span>
                {suspectAbordagens.length > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                      activeTab === 'abordagens'
                        ? 'bg-neutral-950 text-[#e5c07b]'
                        : 'bg-blue-950 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {suspectAbordagens.length}
                  </span>
                )}
              </button>
            </div>

            {/* CONTEÚDO DA ABA 1: DADOS CADASTRAIS (Ficha Operacional padrão) */}
            {activeTab === 'dados' && (
              <div className="rounded-2xl bg-[#0c1017] border border-neutral-800/90 p-4 sm:p-5 space-y-2.5 text-xs text-neutral-300 animate-fadeIn">
                {/* NOME */}
                <div className="group/row flex items-start justify-between gap-2 py-0.5 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <User className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <div className="leading-snug break-words">
                      <span className="text-neutral-400 font-bold uppercase tracking-wide">
                        NOME:{' '}
                      </span>
                      <span className="text-white font-extrabold text-sm uppercase tracking-wide">
                        {suspect.nome || 'NÃO INFORMADO'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => copyToClipboard(suspect.nome, 'nome', e)}
                    className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                    title="Copiar Nome"
                  >
                    {copiedField === 'nome' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 opacity-40 group-hover/row:opacity-100 hover:opacity-100" />
                    )}
                  </button>
                </div>

                {/* MAE */}
                <div className="group/row flex items-start justify-between gap-2 py-0.5 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <User className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <div className="leading-snug break-words">
                      <span className="text-neutral-400 font-bold uppercase tracking-wide">
                        MAE:{' '}
                      </span>
                      <span className="text-white font-extrabold uppercase">
                        {getMotherName(suspect) || 'NÃO INFORMADA'}
                      </span>
                    </div>
                  </div>
                  {getMotherName(suspect) && (
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(getMotherName(suspect), 'mae', e)}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                      title="Copiar Nome da Mãe"
                    >
                      {copiedField === 'mae' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-40 group-hover/row:opacity-100 hover:opacity-100" />
                      )}
                    </button>
                  )}
                </div>

                {/* NASC (Data de Nascimento) */}
                <div className="group/row flex items-start justify-between gap-2 py-0.5 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Calendar className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <div className="leading-snug break-words">
                      <span className="text-neutral-400 font-bold uppercase tracking-wide">
                        NASC:{' '}
                      </span>
                      <span className="text-white font-extrabold font-mono">
                        {getBirthDate(suspect) || 'NÃO INFORMADO'}
                      </span>
                    </div>
                  </div>
                  {getBirthDate(suspect) && (
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(getBirthDate(suspect), 'dataNasc', e)}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                      title="Copiar Data de Nascimento"
                    >
                      {copiedField === 'dataNasc' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-40 group-hover/row:opacity-100 hover:opacity-100" />
                      )}
                    </button>
                  )}
                </div>

                {/* RG */}
                {suspect.rg && (
                  <div className="group/row flex items-center justify-between gap-2 py-0.5 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CreditCard className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <div>
                        <span className="text-neutral-400 font-bold uppercase tracking-wide">
                          RG:{' '}
                        </span>
                        <span className="text-white font-extrabold font-mono">
                          {suspect.rg}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(suspect.rg, 'rg', e)}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                      title="Copiar RG"
                    >
                      {copiedField === 'rg' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-40 group-hover/row:opacity-100 hover:opacity-100" />
                      )}
                    </button>
                  </div>
                )}

                {/* CPF */}
                {suspect.cpf && (
                  <div className="group/row flex items-center justify-between gap-2 py-0.5 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CreditCard className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <div>
                        <span className="text-neutral-400 font-bold uppercase tracking-wide">
                          CPF:{' '}
                        </span>
                        <span className="text-white font-extrabold font-mono">
                          {suspect.cpf}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(suspect.cpf, 'cpf', e)}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                      title="Copiar CPF"
                    >
                      {copiedField === 'cpf' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-40 group-hover/row:opacity-100 hover:opacity-100" />
                      )}
                    </button>
                  </div>
                )}

                {/* END (Endereço Residencial) */}
                <div className="group/row flex items-start justify-between gap-2 py-0.5 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <div className="leading-snug break-words">
                      <span className="text-neutral-400 font-bold uppercase tracking-wide">
                        END:{' '}
                      </span>
                      <span className="text-white font-extrabold uppercase">
                        {getCleanAddress(suspect) || 'Endereço não informado'}
                      </span>
                    </div>
                  </div>
                  {getCleanAddress(suspect) && (
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(getCleanAddress(suspect), 'endereco', e)}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                      title="Copiar Endereço"
                    >
                      {copiedField === 'endereco' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-40 group-hover/row:opacity-100 hover:opacity-100" />
                      )}
                    </button>
                  )}
                </div>

                {/* ALCUNHA */}
                {suspect.alcunha && (
                  <div className="group/row flex items-center justify-between gap-2 py-0.5 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Tag className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <div>
                        <span className="text-neutral-400 font-bold uppercase tracking-wide">
                          ALCUNHA:{' '}
                        </span>
                        <span className="text-[#e5c07b] font-extrabold uppercase tracking-wide">
                          {suspect.alcunha}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(suspect.alcunha, 'alcunha', e)}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                      title="Copiar Alcunha"
                    >
                      {copiedField === 'alcunha' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-40 group-hover/row:opacity-100 hover:opacity-100" />
                      )}
                    </button>
                  </div>
                )}

                {/* ART / CRIMES */}
                {suspect.artigo && (() => {
                  const articleList = suspect.artigos && suspect.artigos.length > 0
                    ? suspect.artigos
                    : parseArticlesString(suspect.artigo);

                  return (
                    <div className="group/row flex flex-col gap-1.5 py-1 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#c69c59] flex-shrink-0" />
                          <span className="text-neutral-400 font-bold uppercase tracking-wide text-xs">
                            ARTIGO / CRIMES {articleList.length > 1 && `(${articleList.length})`}:
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => copyToClipboard(suspect.artigo, 'artigo', e)}
                          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                          title="Copiar Todos os Artigos"
                        >
                          {copiedField === 'artigo' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 opacity-50 group-hover/row:opacity-100 hover:opacity-100" />
                          )}
                        </button>
                      </div>

                      {articleList.length > 1 ? (
                        <div className="flex flex-wrap gap-1.5 pl-6 pt-0.5">
                          {articleList.map((art, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#161b26] border border-[#c69c59]/50 text-xs font-mono font-semibold text-[#e5c07b] shadow-sm"
                            >
                              {art}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="pl-6">
                          <span className="text-[#e5c07b] font-mono font-extrabold text-xs">
                            {suspect.artigo}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* OBS */}
                {suspect.observacoes && (
                  <div className="group/row flex items-start justify-between gap-2 py-0.5 hover:bg-neutral-800/40 rounded px-1.5 -mx-1.5 transition-colors">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="text-neutral-400 font-bold uppercase tracking-wide">
                          OBS:{' '}
                        </span>
                        <span className="text-neutral-200 font-medium whitespace-pre-wrap">
                          {suspect.observacoes}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(suspect.observacoes, 'obs', e)}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex-shrink-0 cursor-pointer"
                      title="Copiar Observações"
                    >
                      {copiedField === 'obs' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-40 group-hover/row:opacity-100 hover:opacity-100" />
                      )}
                    </button>
                  </div>
                )}

                {/* LOCAL DA ABORDAGEM, HORA & ÁREA DO BPM */}
                {(suspect.localAbordagem || suspect.horaAbordagem || suspect.bpm) && (
                  <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <MapPin className="w-4 h-4 text-[#c69c59] flex-shrink-0" />
                        <span className="text-neutral-400 font-bold uppercase tracking-wide">
                          LOCAL DA ABORDAGEM:
                        </span>
                        {suspect.horaAbordagem && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c2434] border border-[#c69c59]/60 text-[#f5d799] font-mono text-[10px] tracking-wider uppercase font-bold">
                            <Clock className="w-3 h-3 text-[#c69c59]" />
                            <span>{suspect.horaAbordagem}</span>
                          </span>
                        )}
                        {suspect.bpm && (
                          <span className="px-2 py-0.5 rounded bg-[#1c2434] border border-[#c69c59]/60 text-[#f5d799] font-mono text-[10px] tracking-wider uppercase font-bold">
                            ÁREA DO {suspect.bpm}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {getGoogleMapsUrl() && (
                          <a
                            href={getGoogleMapsUrl()!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-[#161f2e] hover:bg-[#1e2b40] text-[#e5c07b] hover:text-white border border-[#c69c59]/40 transition-colors cursor-pointer flex items-center justify-center"
                            title="Abrir no Google Maps"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) =>
                            copyToClipboard(suspect.localAbordagem, 'local', e)
                          }
                          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
                          title="Copiar Local da Abordagem"
                        >
                          {copiedField === 'local' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-white font-semibold pl-6 leading-snug">
                      {suspect.localAbordagem || 'Endereço da abordagem não informado'}
                    </p>

                    {getCoords() && (
                      <div className="pl-6 pt-2 space-y-2">
                        <div className="relative w-full h-44 sm:h-56 rounded-xl overflow-hidden border border-[#c69c59]/50 shadow-md bg-black">
                          <iframe
                            title="Google Maps Alfinete Abordagem"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer"
                            src={`https://maps.google.com/maps?q=${getCoords()!.lat},${getCoords()!.lng}&hl=pt-BR&z=17&output=embed`}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-neutral-400 font-mono">
                          <span className="text-[#e5c07b]">
                            GPS: {getCoords()!.lat.toFixed(6)}, {getCoords()!.lng.toFixed(6)}
                          </span>
                          <span className="text-emerald-400">
                            📍 Alfinete fixado nas coordenadas exatas
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO DA ABA 2: VÍNCULOS (Facções / Organizações Criminosas e Comparsas) */}
            {activeTab === 'vinculos' && (
              <div className="rounded-2xl bg-[#0c1017] border border-neutral-800/90 p-4 sm:p-5 space-y-4 text-xs animate-fadeIn">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      <span>Vínculos com Organizações Criminosas</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Facções, escalão hierárquico e comparsas mapeados
                    </p>
                  </div>
                </div>

                {faccoesVinculadas.length > 0 ? (
                  <div className="space-y-3">
                    {faccoesVinculadas.map(({ orcrim, funcao, membroId }, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#121622] border border-[#c69c59]/40 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40 font-mono font-bold text-[10px]">
                              {orcrim.sigla}
                            </span>
                            <span className="text-white font-extrabold uppercase text-xs">
                              {orcrim.nome}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#e5c07b]">
                            <span className="text-neutral-400">Função Hierárquica:</span>{' '}
                            <span className="font-bold">{funcao || 'Operacional'}</span>
                          </div>
                          {orcrim.origem && (
                            <div className="text-[10px] text-neutral-400">
                              Origem: {orcrim.origem}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono font-bold uppercase">
                            Mapeado
                          </span>
                          {membroId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteVinculoOrcrim(orcrim.id, membroId, orcrim.sigla || orcrim.nome)}
                              className="p-1 rounded-lg bg-neutral-900 hover:bg-red-950/80 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-500/50 transition-colors cursor-pointer"
                              title={`Desvincular de ${orcrim.sigla || orcrim.nome}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-xl border border-dashed border-neutral-800 bg-[#0e1219]">
                    <ShieldAlert className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    <p className="text-xs text-neutral-400 font-semibold">
                      Nenhum vínculo a facção ou ORCRIM registrado para este abordado ainda.
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Você pode vinculá-lo através do módulo de ORCRIM / Organograma.
                    </p>
                  </div>
                )}

                {/* SEÇÃO 2: VÍNCULOS DE PESSOAS (Familiares, Comparsas e Relações de Fuga) */}
                <div className="pt-4 border-t border-neutral-800/80 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#c69c59]" />
                        <span>Vínculos de Pessoas & Parentesco</span>
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        Familiares e contatos de apoio para busca e captura em fuga
                      </p>
                    </div>

                    <button
                      type="button"
                      id="btn-add-vinculo-pessoa"
                      onClick={() => {
                        setEditingVinculoPessoa(null);
                        setIsAddVinculoPessoaOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#182030] hover:bg-[#202c44] border border-[#c69c59]/50 text-[#f5d799] font-bold text-xs transition-all cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#c69c59]" />
                      <span>+ Adicionar Vínculo de Pessoa</span>
                    </button>
                  </div>

                  {vinculosPessoas.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {vinculosPessoas.map((vp) => (
                        <div
                          key={vp.id}
                          onClick={() => setSelectedVinculoPessoaDetail(vp)}
                          className="p-3 rounded-xl bg-[#121622] hover:bg-[#161c2c] border border-neutral-800 hover:border-[#c69c59]/60 transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-sm group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <span className="font-extrabold text-white text-xs uppercase truncate group-hover:text-[#e5c07b]">
                                {vp.nome}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-[9px] font-bold uppercase flex-shrink-0">
                                {vp.grauParentesco}
                              </span>
                            </div>

                            {(vp.rg || vp.cpf) && (
                              <div className="text-[10px] text-neutral-400 font-mono">
                                {vp.rg ? `RG: ${vp.rg}` : ''} {vp.cpf ? `CPF: ${vp.cpf}` : ''}
                              </div>
                            )}

                            {vp.endereco && (
                              <div className="text-[10px] text-neutral-300 truncate flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-[#c69c59] flex-shrink-0" />
                                <span className="truncate">{vp.endereco}</span>
                              </div>
                            )}

                            {vp.observacoes && (
                              <div className="text-[10px] text-neutral-400 line-clamp-1 italic">
                                Obs: {vp.observacoes}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-neutral-800/60 text-neutral-400">
                            <span className="text-[#e5c07b] group-hover:underline">Ver ficha completa →</span>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVinculoPessoa(vp);
                                  setIsAddVinculoPessoaOpen(true);
                                }}
                                className="p-1 hover:text-white"
                                title="Editar"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVinculoPessoa(vp.id)}
                                className="p-1 hover:text-red-400"
                                title="Remover"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center rounded-xl border border-dashed border-neutral-800 bg-[#0e1219]">
                      <Users className="w-6 h-6 text-neutral-600 mx-auto mb-1" />
                      <p className="text-xs text-neutral-400 font-medium">
                        Nenhum vínculo de pessoa adicionado para busca em caso de fuga.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CONTEÚDO DA ABA 3: ABORDAGENS (Matching Image 2 + Botão Nova Abordagem) */}
            {activeTab === 'abordagens' && (
              <div className="rounded-2xl bg-[#0c1017] border border-neutral-800/90 p-4 sm:p-5 space-y-4 text-xs animate-fadeIn">
                {/* Header da aba com o botão solicitado + Registrar Nova Abordagem */}
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-neutral-800/80 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-blue-400" />
                      <span>Histórico de Abordagens</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Total de intervenções registradas:{' '}
                      <strong className="text-[#e5c07b] font-mono">{suspectAbordagens.length}</strong>
                    </p>
                  </div>

                  {/* Botão de Nova Abordagem */}
                  <button
                    type="button"
                    id="btn-nova-abordagem-card"
                    onClick={() => setIsNovaAbordagemOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-extrabold text-xs shadow-md shadow-[#c69c59]/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-neutral-950 stroke-[2.5]" />
                    <span>+ Nova Abordagem</span>
                  </button>
                </div>

                {/* Lista de Abordagens do Abordado */}
                {suspectAbordagens.length > 0 ? (
                  <div className="space-y-3">
                    {suspectAbordagens.map((ab) => (
                      <div
                        key={ab.id}
                        className="p-3.5 rounded-xl bg-[#121622] border border-neutral-800 hover:border-[#c69c59]/40 space-y-2 transition-all"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-1 border-b border-neutral-800/60 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#e5c07b]">
                              <Calendar className="w-3.5 h-3.5 text-[#c69c59]" />
                              <span>{ab.data}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-300">
                              <Clock className="w-3.5 h-3.5 text-neutral-400" />
                              <span>{ab.hora}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {ab.viatura && (
                              <span className="px-2 py-0.5 rounded bg-[#182030] text-[#f5d799] border border-[#c69c59]/30 text-[10px] font-mono font-bold">
                                {ab.viatura}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAbordagem(ab.id)}
                              className="p-1 rounded-lg bg-neutral-900/80 hover:bg-rose-950/80 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-800/80 transition-colors cursor-pointer"
                              title="Excluir Registro de Abordagem"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Local / Endereço */}
                        <div className="flex items-start gap-2 text-neutral-300">
                          <MapPin className="w-3.5 h-3.5 text-[#c69c59] flex-shrink-0 mt-0.5" />
                          <span className="font-semibold text-white">{ab.endereco}</span>
                        </div>

                        {/* Natureza */}
                        {ab.natureza && (
                          <div className="text-[11px] text-neutral-400 pl-5.5">
                            <strong className="text-neutral-300">Natureza:</strong> {ab.natureza}
                          </div>
                        )}

                        {/* Foto da abordagem se houver */}
                        {ab.foto && (
                          <div className="pl-5.5 pt-1">
                            <div className="w-32 h-24 rounded-lg overflow-hidden border border-neutral-700 bg-black">
                              <img src={ab.foto} alt="Abordagem" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}

                        {/* Outras pessoas abordadas juntas */}
                        {ab.outrosAbordados && ab.outrosAbordados.length > 0 && (
                          <div className="pl-5.5 pt-1 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-[#e5c07b] flex items-center gap-1">
                              <Users className="w-3 h-3 text-[#c69c59]" />
                              <span>Abordados em conjunto ({ab.outrosAbordados.length}):</span>
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {ab.outrosAbordados.map((outro, oIdx) => (
                                <span
                                  key={oIdx}
                                  className="px-2 py-0.5 rounded bg-[#181d2a] border border-neutral-700 text-white text-[10px]"
                                >
                                  {outro.nome} {outro.alcunha ? `(${outro.alcunha})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Observações */}
                        {ab.observacoes && (
                          <div className="pl-5.5 pt-1 text-neutral-300 bg-[#0d1017] p-2 rounded-lg border border-neutral-800/80 leading-relaxed text-[11px]">
                            {ab.observacoes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-xl border border-dashed border-neutral-800 bg-[#0e1219]">
                    <Car className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    <p className="text-xs text-neutral-400 font-semibold">
                      Nenhuma abordagem registrada anteriormente para este abordado.
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Clique no botão acima para registrar a primeira abordagem com GPS e hora automáticos.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsNovaAbordagemOpen(true)}
                      className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 text-xs font-bold cursor-pointer"
                    >
                      + Registrar Primeira Abordagem
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Lightbox Ampliar Foto */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fadeIn"
          onClick={() => setIsZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsZoomOpen(false)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-neutral-900/90 text-white hover:bg-neutral-800 border border-neutral-700/80 transition-all cursor-pointer shadow-xl z-20"
            title="Fechar ampliação"
          >
            <X className="w-6 h-6" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700/80 transition-all cursor-pointer shadow-xl z-20 active:scale-95"
                title="Foto anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700/80 transition-all cursor-pointer shadow-xl z-20 active:scale-95"
                title="Próxima foto"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeSrc || currentPhoto}
              alt={suspect.nome}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <div className="mt-3 px-4 py-1.5 rounded-full bg-black/80 border border-neutral-700 text-xs font-mono text-neutral-300 shadow-md">
              {suspect.nome} • Foto {activePhotoIdx + 1} de {photos.length}
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Nova Abordagem */}
      {isNovaAbordagemOpen && (
        <NovaAbordagemModal
          isOpen={isNovaAbordagemOpen}
          onClose={() => setIsNovaAbordagemOpen(false)}
          suspect={suspect}
          allSuspects={allSuspects}
          onSuccess={() => {
            loadSuspectAbordagens();
          }}
          onRequestNovoCadastro={onRequestNovoCadastro}
        />
      )}

      {/* Modal Adicionar / Editar Vínculo de Pessoa */}
      {isAddVinculoPessoaOpen && (
        <VinculoPessoaModal
          isOpen={isAddVinculoPessoaOpen}
          onClose={() => {
            setIsAddVinculoPessoaOpen(false);
            setEditingVinculoPessoa(null);
          }}
          onSave={handleSaveVinculoPessoa}
          onDelete={handleDeleteVinculoPessoa}
          initialData={editingVinculoPessoa}
        />
      )}

      {/* Modal Visualizar Detalhes do Vínculo de Pessoa */}
      {selectedVinculoPessoaDetail && (
        <VinculoPessoaDetailModal
          vinculo={selectedVinculoPessoaDetail}
          onClose={() => setSelectedVinculoPessoaDetail(null)}
          onEdit={(vp) => {
            setSelectedVinculoPessoaDetail(null);
            setEditingVinculoPessoa(vp);
            setIsAddVinculoPessoaOpen(true);
          }}
          onDelete={handleDeleteVinculoPessoa}
        />
      )}
      {/* Modal Confirmação de Desvinculação de Facção */}
      {vinculoOrcrimToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div
            className="relative w-full max-w-sm bg-[#121622] border border-amber-500/60 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Desvincular Facção?</span>
            </h4>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Deseja realmente desvincular este indivíduo da facção{' '}
              <strong className="text-[#e5c07b]">{vinculoOrcrimToDelete.orcrimNome}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVinculoOrcrimToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVinculoOrcrim}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Confirmação de Exclusão de Abordagem */}
      {abordagemToDeleteId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div
            className="relative w-full max-w-sm bg-[#121622] border border-red-500/60 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Excluir Registro de Abordagem?</span>
            </h4>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Deseja realmente excluir este registro de abordagem? Esta ação removerá o histórico e atualizará os dados operacionais do abordado no banco de dados.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAbordagemToDeleteId(null)}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAbordagem}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer transition-colors shadow"
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
