import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Camera,
  Upload,
  User,
  MapPin,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Save,
  Shield,
  FileText,
  Calendar,
} from 'lucide-react';
import { SuspectRecord, SuspectMarcador } from '../types';
import { ProcessedAiCandidate } from '../utils/aiExtraction';
import { calculateAge, formatCPF } from '../utils/textUtils';

// Compressão no cliente para upload de imagens
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 960;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve((event.target?.result as string) || '');
          return;
        }

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.88);
        resolve(compressedBase64);
      };
      img.onerror = () => resolve((event.target?.result as string) || '');
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

interface AiMultiReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: ProcessedAiCandidate[];
  onSaveRecord: (record: SuspectRecord) => Promise<void> | void;
  existingSuspects?: SuspectRecord[];
}

// Artigos penais táticos mais recorrentes para inserção rápida com 1 clique
const COMMON_ARTICLES = [
  { code: 'Art. 157', label: 'Roubo' },
  { code: 'Art. 155', label: 'Furto' },
  { code: 'Art. 33', label: 'Tráfico de Drogas' },
  { code: 'Art. 12', label: 'Posse Arma' },
  { code: 'Art. 14', label: 'Porte Arma' },
  { code: 'Art. 16', label: 'Arma Restrita' },
  { code: 'Art. 121', label: 'Homicídio' },
  { code: 'Art. 180', label: 'Receptação' },
  { code: 'Art. 28', label: 'Uso de Drogas' },
];

export const AiMultiReviewModal: React.FC<AiMultiReviewModalProps> = ({
  isOpen,
  onClose,
  candidates: initialCandidates,
  onSaveRecord,
  existingSuspects = [],
}) => {
  const [candidates, setCandidates] = useState<ProcessedAiCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Inicializa o estado dos candidatos quando o modal abre
  useEffect(() => {
    if (isOpen && initialCandidates && initialCandidates.length > 0) {
      setCandidates(
        initialCandidates.map((c) => ({
          ...c,
          status: c.status || 'pending',
          availablePhotos: c.availablePhotos || (c.croppedPhoto ? [c.croppedPhoto] : []),
        }))
      );
      setCurrentIndex(0);
    }
  }, [isOpen, initialCandidates]);

  if (!isOpen || candidates.length === 0) return null;

  const current = candidates[currentIndex] || candidates[0];

  // Métricas de progresso
  const totalCount = candidates.length;
  const savedCount = candidates.filter((c) => c.status === 'saved').length;
  const discardedCount = candidates.filter((c) => c.status === 'discarded').length;
  const pendingCount = candidates.filter((c) => c.status === 'pending' || c.status === 'reviewed').length;
  const isAllDone = pendingCount === 0;

  // Atualiza um campo do candidato atual
  const updateCurrentField = (field: keyof ProcessedAiCandidate, value: any) => {
    setCandidates((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        [field]: value,
        status: updated[currentIndex].status === 'pending' ? 'reviewed' : updated[currentIndex].status,
      };
      return updated;
    });
  };

  // Upload de nova foto para o candidato atual
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      if (compressed) {
        setCandidates((prev) => {
          const updated = [...prev];
          const curr = updated[currentIndex];
          const photos = curr.availablePhotos ? [compressed, ...curr.availablePhotos] : [compressed];
          updated[currentIndex] = {
            ...curr,
            croppedPhoto: compressed,
            availablePhotos: photos,
            status: 'reviewed',
          };
          return updated;
        });
        showToast('Foto do abordado atualizada!');
      }
    } catch (err) {
      console.error('Erro ao carregar foto:', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Alterna entre fotos disponíveis (ex: recorte e print original)
  const handleSelectPhoto = (photo: string) => {
    updateCurrentField('croppedPhoto', photo);
  };

  // Remove foto atual
  const handleRemovePhoto = () => {
    updateCurrentField('croppedPhoto', null);
  };

  // Alterna artigo penal comum
  const handleToggleArticle = (code: string) => {
    const currentArt = current.artigo || '';
    if (currentArt.includes(code)) {
      // Remove
      const replaced = currentArt
        .replace(new RegExp(`\\b${code}\\b`, 'g'), '')
        .replace(/,\s*,/g, ',')
        .replace(/^,\s*|,\s*$/g, '')
        .trim();
      updateCurrentField('artigo', replaced);
    } else {
      // Adiciona
      const newArt = currentArt.trim() ? `${currentArt.trim()}, ${code}` : code;
      updateCurrentField('artigo', newArt);
    }
  };

  // Captura GPS atual para o local de abordagem
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      showToast('Geolocalização não suportada neste dispositivo.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const coordString = `${lat},${lng}`;
        updateCurrentField('observacoes', (current.observacoes ? `${current.observacoes}\n` : '') + `[GPS Abordagem: ${coordString}]`);
        setIsLocating(false);
        showToast(`Coordenadas capturadas: ${coordString}`);
      },
      (err) => {
        setIsLocating(false);
        showToast(`Não foi possível obter GPS: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Mostra toast temporário
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Salva o registro atual
  const handleSaveCurrent = async () => {
    if (!current.nome || !current.nome.trim()) {
      showToast('O nome completo do abordado é obrigatório.');
      return;
    }

    setIsSaving(true);

    try {
      const now = new Date();
      const photosArray = current.croppedPhoto ? [current.croppedPhoto] : current.availablePhotos || [];

      const record: SuspectRecord = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nome: (current.nome || '').trim().toUpperCase(),
        alcunha: (current.alcunha || '').trim().toUpperCase(),
        mae: (current.mae || '').trim().toUpperCase(),
        rg: (current.rg || '').trim(),
        cpf: formatCPF(current.cpf),
        dataNasc: (current.dataNasc || '').trim(),
        endereco: (current.endereco || '').trim(),
        artigo: (current.artigo || '').trim(),
        marcador: (current.marcador as SuspectMarcador) || 'NENHUM',
        observacoes: (current.observacoes || '').trim(),
        fotos: photosArray,
        dataCriacao: now.toISOString(),
        dataAtualizacao: now.toISOString(),
      };

      await onSaveRecord(record);

      // Marca o registro como salvo no array de candidatos
      setCandidates((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...updated[currentIndex],
          status: 'saved',
        };
        return updated;
      });

      showToast(`Registro de "${record.nome}" salvo com sucesso!`);

      // Avança para o próximo registro pendente automaticamente
      const nextPendingIndex = candidates.findIndex(
        (c, idx) => idx > currentIndex && (c.status === 'pending' || c.status === 'reviewed')
      );

      if (nextPendingIndex !== -1) {
        setCurrentIndex(nextPendingIndex);
      } else {
        // Tenta achar qualquer pendente anterior
        const anyPendingIndex = candidates.findIndex(
          (c, idx) => idx !== currentIndex && (c.status === 'pending' || c.status === 'reviewed')
        );
        if (anyPendingIndex !== -1) {
          setCurrentIndex(anyPendingIndex);
        }
      }
    } catch (err: any) {
      console.error('Erro ao salvar registro:', err);
      showToast(err.message || 'Erro ao gravar registro.');
    } finally {
      setIsSaving(false);
    }
  };

  // Descarta o registro atual da fila
  const handleDiscardCurrent = () => {
    setCandidates((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        status: 'discarded',
      };
      return updated;
    });

    showToast(`Registro "${current.nome || 'Abordado'}" descartado da fila.`);

    // Avança para o próximo pendente
    const nextPending = candidates.findIndex(
      (c, idx) => idx > currentIndex && (c.status === 'pending' || c.status === 'reviewed')
    );
    if (nextPending !== -1) {
      setCurrentIndex(nextPending);
    } else {
      const anyPending = candidates.findIndex(
        (c, idx) => idx !== currentIndex && (c.status === 'pending' || c.status === 'reviewed')
      );
      if (anyPending !== -1) {
        setCurrentIndex(anyPending);
      }
    }
  };

  // Salva todos os registros restantes pendentes de uma só vez
  const handleSaveAllRemaining = async () => {
    const pendings = candidates.filter((c) => c.status === 'pending' || c.status === 'reviewed');
    if (pendings.length === 0) return;

    setIsSaving(true);
    let count = 0;

    for (const c of pendings) {
      if (!c.nome || !c.nome.trim()) continue;

      const now = new Date();
      const photosArray = c.croppedPhoto ? [c.croppedPhoto] : c.availablePhotos || [];

      const record: SuspectRecord = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nome: (c.nome || '').trim().toUpperCase(),
        alcunha: (c.alcunha || '').trim().toUpperCase(),
        mae: (c.mae || '').trim().toUpperCase(),
        rg: (c.rg || '').trim(),
        cpf: formatCPF(c.cpf),
        dataNasc: (c.dataNasc || '').trim(),
        endereco: (c.endereco || '').trim(),
        artigo: (c.artigo || '').trim(),
        marcador: (c.marcador as SuspectMarcador) || 'NENHUM',
        observacoes: (c.observacoes || '').trim(),
        fotos: photosArray,
        dataCriacao: now.toISOString(),
        dataAtualizacao: now.toISOString(),
      };

      try {
        await onSaveRecord(record);
        count++;
      } catch (err) {
        console.error('Erro ao salvar item em lote:', err);
      }
    }

    setCandidates((prev) =>
      prev.map((c) => (c.status === 'pending' || c.status === 'reviewed' ? { ...c, status: 'saved' } : c))
    );

    setIsSaving(false);
    showToast(`${count} registros restantes foram salvos e sincronizados com sucesso!`);
  };

  // Idade calculada
  const ageDisplay = current.dataNasc ? calculateAge(current.dataNasc) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && isAllDone) onClose();
      }}
    >
      <div
        id="ai-multi-review-modal"
        className="relative w-full max-w-4xl my-auto bg-[#10141d] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Notificação Flutuante */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-950/95 border border-emerald-500/70 text-emerald-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 1. Header do Modal */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-800 bg-[#141822] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#c69c59]/15 border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b] flex-shrink-0">
              <Sparkles className="w-4 h-4 text-[#e5c07b]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white truncate">
                  Avaliação e Correção de Novos Registros (IA)
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#c69c59]/20 text-[#e5c07b] border border-[#c69c59]/40">
                  {currentIndex + 1} de {totalCount}
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 block truncate">
                Confirme e corrija os dados extraídos antes de confirmar o cadastro no banco de dados em nuvem
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="sm:hidden px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#c69c59]/20 text-[#e5c07b] border border-[#c69c59]/40">
              {currentIndex + 1}/{totalCount}
            </span>
            <button
              type="button"
              id="btn-close-ai-review"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Fechar painel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Barra de Fila / Chips de Seleção Superior */}
        <div className="px-4 sm:px-6 py-2 border-b border-neutral-800/80 bg-[#0d1017] flex items-center justify-between gap-2 overflow-x-auto flex-shrink-0 scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            {candidates.map((c, idx) => {
              const isActive = idx === currentIndex;
              let badgeColor = 'bg-neutral-800 text-neutral-400 border-neutral-700';
              let statusLabel = 'Pendente';

              if (c.status === 'saved') {
                badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50';
                statusLabel = 'Salvo';
              } else if (c.status === 'discarded') {
                badgeColor = 'bg-red-950/60 text-red-400 border-red-800/40 line-through opacity-60';
                statusLabel = 'Descartado';
              } else if (c.status === 'reviewed') {
                badgeColor = 'bg-blue-950/80 text-blue-300 border-blue-600/50';
                statusLabel = 'Avaliado';
              }

              return (
                <button
                  key={c.id || idx}
                  type="button"
                  id={`btn-queue-item-${idx}`}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1e2535] border-[#c69c59] text-white shadow-sm ring-1 ring-[#c69c59]/60'
                      : 'hover:bg-[#151a24] ' + badgeColor
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold text-[#e5c07b]">
                    #{idx + 1}
                  </span>
                  <span className="text-[11px] font-semibold max-w-[110px] truncate">
                    {c.nome || 'Novo Abordado'}
                  </span>
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] font-mono ${
                      c.status === 'saved'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : c.status === 'discarded'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Botão de salvar restantes caso haja mais de 1 */}
          {pendingCount > 1 && (
            <button
              type="button"
              id="btn-save-all-remaining"
              onClick={handleSaveAllRemaining}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f2638] hover:bg-[#28324a] text-[#e5c07b] border border-[#c69c59]/50 font-bold text-[11px] whitespace-nowrap transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex-shrink-0"
              title="Salvar todos os pendentes restantes de uma vez"
            >
              <Save className="w-3.5 h-3.5 text-[#e5c07b]" />
              <span>Salvar Restantes ({pendingCount})</span>
            </button>
          )}
        </div>

        {/* 3. Área Central: Formulário de Avaliação e Correção */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Status Banner se o registro atual já estiver salvo ou descartado */}
          {current.status === 'saved' && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-between text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs">
                  Este registro já foi salvo e sincronizado com o banco de dados em nuvem!
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400/80">SINCRONIZADO</span>
            </div>
          )}

          {current.status === 'discarded' && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 flex items-center justify-between text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="font-semibold text-xs">
                  Este registro foi marcado como descartado. Você pode restaurá-lo salvando-o abaixo.
                </span>
              </div>
              <button
                type="button"
                onClick={() => updateCurrentField('status', 'reviewed')}
                className="px-2 py-1 rounded bg-neutral-800 text-white text-[10px] hover:bg-neutral-700 cursor-pointer"
              >
                Restaurar
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Coluna Esquerda: Fotografia do Abordado */}
            <div className="md:col-span-4 flex flex-col items-center p-4 rounded-xl bg-[#141822] border border-neutral-800 space-y-3">
              <div className="w-full flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#c69c59]" />
                  <span>Foto do Abordado</span>
                </span>
                {current.sourceFileName && (
                  <span className="text-[9px] font-mono text-neutral-400 truncate max-w-[130px]" title={current.sourceFileName}>
                    {current.sourceFileName}
                  </span>
                )}
              </div>

              {/* Visualizador de Foto com Preview */}
              <div className="relative w-40 h-48 sm:w-44 sm:h-52 rounded-xl border border-neutral-700 bg-neutral-950 overflow-hidden flex items-center justify-center shadow-inner group">
                {current.croppedPhoto ? (
                  <img
                    src={current.croppedPhoto}
                    alt={current.nome || 'Foto do Abordado'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-600 gap-1.5">
                    <User className="w-12 h-12 text-neutral-700" />
                    <span className="text-[10px] font-mono text-neutral-500">Sem Foto</span>
                  </div>
                )}

                {current.croppedPhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-red-600 text-white transition-colors cursor-pointer"
                    title="Remover foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Botões de Ação para Fotos */}
              <div className="w-full space-y-2">
                <label className="w-full py-2 px-3 rounded-lg bg-[#1c2230] hover:bg-[#252e42] border border-[#c69c59]/40 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#c69c59]" />
                  <span>{current.croppedPhoto ? 'Trocar Foto' : 'Adicionar Foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {/* Se houver fotos alternativas (como print e recorte facial) */}
                {current.availablePhotos && current.availablePhotos.length > 1 && (
                  <div className="pt-1">
                    <span className="text-[10px] text-neutral-400 font-mono block mb-1">
                      Alternar fotos detectadas:
                    </span>
                    <div className="flex gap-2 justify-center">
                      {current.availablePhotos.map((p, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => handleSelectPhoto(p)}
                          className={`w-10 h-10 rounded-lg border overflow-hidden transition-all cursor-pointer ${
                            current.croppedPhoto === p
                              ? 'border-[#c69c59] ring-2 ring-[#c69c59]/50'
                              : 'border-neutral-700 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={p}
                            alt={`Opção ${pIdx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Marcador Tático Operacional */}
              <div className="w-full pt-2 border-t border-neutral-800 space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Marcador Tático
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateCurrentField('marcador', 'NENHUM')}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      !current.marcador || current.marcador === 'NENHUM'
                        ? 'bg-neutral-800 border-neutral-600 text-white'
                        : 'bg-[#10141d] border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    NENHUM
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentField('marcador', 'PRESO')}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      current.marcador === 'PRESO'
                        ? 'bg-red-950 border-red-500 text-red-200'
                        : 'bg-[#10141d] border-neutral-800 text-red-400/80 hover:text-red-300'
                    }`}
                  >
                    PRESO
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentField('marcador', 'MORTO')}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      current.marcador === 'MORTO'
                        ? 'bg-neutral-700 border-neutral-500 text-white'
                        : 'bg-[#10141d] border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    MORTO
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentField('marcador', 'ALVO_PRIORITARIO')}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      current.marcador === 'ALVO_PRIORITARIO'
                        ? 'bg-amber-950 border-amber-500 text-amber-200'
                        : 'bg-[#10141d] border-neutral-800 text-amber-400/80 hover:text-amber-300'
                    }`}
                  >
                    ALVO PRIORITÁRIO
                  </button>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Dados Cadastrais e Operacionais */}
            <div className="md:col-span-8 space-y-3.5">
              {/* Nome Completo e Vulgo */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
                    <span>Nome Completo do Abordado *</span>
                    <span className="text-[9px] text-[#c69c59] font-mono">OBRIGATÓRIO</span>
                  </label>
                  <input
                    type="text"
                    id="input-ai-nome"
                    value={current.nome || ''}
                    onChange={(e) => updateCurrentField('nome', e.target.value.toUpperCase())}
                    placeholder="NOME COMPLETO CIVIL"
                    className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700 text-white font-bold text-xs uppercase focus:border-[#c69c59] focus:outline-none focus:ring-1 focus:ring-[#c69c59]"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#e5c07b]">
                    Vulgo / Alcunha
                  </label>
                  <input
                    type="text"
                    id="input-ai-alcunha"
                    value={current.alcunha || ''}
                    onChange={(e) => updateCurrentField('alcunha', e.target.value.toUpperCase())}
                    placeholder="VULGO / APELIDO"
                    className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-[#c69c59]/50 text-[#e5c07b] font-bold text-xs uppercase focus:border-[#c69c59] focus:outline-none focus:ring-1 focus:ring-[#c69c59]"
                  />
                </div>
              </div>

              {/* RG, CPF e Data de Nascimento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                    RG (Registro Geral)
                  </label>
                  <input
                    type="text"
                    id="input-ai-rg"
                    value={current.rg || ''}
                    onChange={(e) => updateCurrentField('rg', e.target.value)}
                    placeholder="Ex: MG-12.345.678"
                    className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700 text-white font-mono text-xs focus:border-[#c69c59] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                    CPF
                  </label>
                  <input
                    type="text"
                    id="input-ai-cpf"
                    value={current.cpf || ''}
                    onChange={(e) => updateCurrentField('cpf', formatCPF(e.target.value))}
                    onBlur={() => {
                      if (current.cpf) {
                        updateCurrentField('cpf', formatCPF(current.cpf));
                      }
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700 text-white font-mono text-xs focus:border-[#c69c59] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
                    <span>Data de Nascimento</span>
                    {ageDisplay && (
                      <span className="text-[10px] text-[#c69c59] font-mono font-bold">
                        {ageDisplay}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    id="input-ai-datanasc"
                    value={current.dataNasc || ''}
                    onChange={(e) => updateCurrentField('dataNasc', e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700 text-white font-mono text-xs focus:border-[#c69c59] focus:outline-none"
                  />
                </div>
              </div>

              {/* Nome da Mãe */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                  Nome da Mãe
                </label>
                <input
                  type="text"
                  id="input-ai-mae"
                  value={current.mae || ''}
                  onChange={(e) => updateCurrentField('mae', e.target.value.toUpperCase())}
                  placeholder="NOME COMPLETO DA MÃE"
                  className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700 text-white text-xs uppercase focus:border-[#c69c59] focus:outline-none"
                />
              </div>

              {/* Artigos Penais / Tipificação Criminal com Botões Rápidos */}
              <div className="space-y-1.5 p-3 rounded-xl bg-[#141822] border border-neutral-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#c69c59]" />
                    <span>Artigos Penais / Tipificação</span>
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Clique nas tags para adicionar ou remover
                  </span>
                </div>

                <input
                  type="text"
                  id="input-ai-artigo"
                  value={current.artigo || ''}
                  onChange={(e) => updateCurrentField('artigo', e.target.value)}
                  placeholder="Ex: Art. 157, Art. 33, Art. 16"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d1017] border border-neutral-700 text-white font-mono text-xs focus:border-[#c69c59] focus:outline-none"
                />

                {/* Botões Rápidos de Artigos */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {COMMON_ARTICLES.map((art) => {
                    const isSelected = (current.artigo || '').includes(art.code);
                    return (
                      <button
                        key={art.code}
                        type="button"
                        onClick={() => handleToggleArticle(art.code)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#c69c59] text-neutral-950 border-[#c69c59] font-bold'
                            : 'bg-[#1c2230] text-neutral-300 border-neutral-700 hover:border-[#c69c59]/50'
                        }`}
                      >
                        {art.code} ({art.label})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Endereço Residencial */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                  Endereço Residencial
                </label>
                <input
                  type="text"
                  id="input-ai-endereco"
                  value={current.endereco || ''}
                  onChange={(e) => updateCurrentField('endereco', e.target.value)}
                  placeholder="Rua, número, complemento, bairro e cidade"
                  className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700 text-white text-xs focus:border-[#c69c59] focus:outline-none"
                />
              </div>

              {/* Observações / Modus Operandi com Captura de GPS */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                    Observações / Modus Operandi
                  </label>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isLocating}
                    className="flex items-center gap-1 text-[10px] text-[#e5c07b] hover:underline cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>{isLocating ? 'Capturando GPS...' : 'Adicionar GPS Atual'}</span>
                  </button>
                </div>
                <textarea
                  id="textarea-ai-obs"
                  value={current.observacoes || ''}
                  onChange={(e) => updateCurrentField('observacoes', e.target.value)}
                  rows={3}
                  placeholder="Histórico criminal, passagens, facção, tatuagens, veículos utilizados, mandado de prisão..."
                  className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700 text-white text-xs focus:border-[#c69c59] focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Rodapé Fixo com Navegação e Decisão Operacional */}
        <div className="px-4 sm:px-6 py-3 border-t border-neutral-800 bg-[#141822] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          {/* Lado Esquerdo: Estatísticas e Botão de Descartar */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              id="btn-discard-current-record"
              onClick={handleDiscardCurrent}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title="Descartar este registro da importação"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Descartar Registro</span>
            </button>

            <div className="text-[11px] text-neutral-400 font-mono">
              <span className="text-emerald-400 font-bold">{savedCount} salvos</span>
              {discardedCount > 0 && <span className="text-neutral-500"> • {discardedCount} descartados</span>}
              <span className="text-amber-400"> • {pendingCount} pendentes</span>
            </div>
          </div>

          {/* Lado Direito: Navegação Anterior / Próximo e Salvar Registro */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="btn-prev-record"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors disabled:opacity-30 cursor-pointer"
              title="Registro anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              id="btn-next-record"
              onClick={() => setCurrentIndex((prev) => Math.min(totalCount - 1, prev + 1))}
              disabled={currentIndex === totalCount - 1}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors disabled:opacity-30 cursor-pointer"
              title="Próximo registro"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Botão de Ação Principal: Salvar Registro e Avançar */}
            <button
              type="button"
              id="btn-save-current-record"
              onClick={handleSaveCurrent}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 font-extrabold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4 text-neutral-950" />
              <span>
                {isSaving
                  ? 'Salvando...'
                  : currentIndex === totalCount - 1 || pendingCount <= 1
                  ? 'Salvar e Concluir'
                  : 'Salvar e Próximo'}
              </span>
            </button>

            {isAllDone && (
              <button
                type="button"
                id="btn-finish-review"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
