import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Lock,
  Skull,
  Crosshair,
  AlertTriangle,
  Share2,
  Check,
  FileJson,
} from 'lucide-react';
import { SuspectRecord } from '../types';
import { formatPhotoUrl, extractSuspectPhotos } from '../utils/googleSheetsApi';
import { CardViewMode } from './SettingsModal';
import { shareSuspectWithAllPhotos } from '../utils/shareUtils';
import { exportSingleCardJson } from '../utils/exportCards';

interface SuspectCardProps {
  suspect: SuspectRecord;
  onClick: () => void;
  viewMode?: CardViewMode;
  onToast?: (msg: string) => void;
}

// Formatadores robustos para garantia de exibição de Mãe, Nascimento e Endereço
export const getMotherName = (rec: SuspectRecord): string => {
  const anyRec = rec as any;
  const val =
    rec.mae ||
    anyRec.nome_mae ||
    anyRec.nomeMae ||
    anyRec['nome_mae'] ||
    anyRec['NOME_MAE'] ||
    anyRec['NOME DA MÃE'] ||
    anyRec['NOME DA MAE'] ||
    anyRec['Nome da Mãe'] ||
    anyRec['Nome da Mae'] ||
    anyRec.filiacao ||
    anyRec.MAE ||
    anyRec['MÃE'] ||
    '';
  const str = String(val).trim();
  if (!str || str.toUpperCase() === 'NÃO INFORMADA' || str.toUpperCase() === 'NAO INFORMADA' || str === '-') {
    return '';
  }
  return str.toUpperCase();
};

export const formatDateBr = (rawDate: string | undefined): string => {
  if (!rawDate) return '';
  const trimmed = String(rawDate).trim();
  if (!trimmed || trimmed === '-' || trimmed.toUpperCase() === 'NÃO INFORMADO' || trimmed.toUpperCase() === 'NAO INFORMADO') {
    return '';
  }

  // Se já estiver formatado em DD/MM/AAAA ou DD-MM-AAAA
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(trimmed)) {
    return trimmed.replace(/-/g, '/');
  }

  // Formato ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  // String de Data JS (Ex: "Thu Sep 09 2004 00:00:00 GMT-0300")
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      if (ano >= 1900 && ano <= 2100) {
        return `${dia}/${mes}/${ano}`;
      }
    }
  } catch {}

  return trimmed;
};

export const getBirthDate = (rec: SuspectRecord): string => {
  const anyRec = rec as any;
  const raw =
    rec.dataNasc ||
    anyRec.nasc ||
    anyRec['nasc'] ||
    anyRec.data_nasc ||
    anyRec['DATA DE NASCIMENTO'] ||
    anyRec['DATA NASCIMENTO'] ||
    anyRec['Data de Nascimento'] ||
    anyRec.dataNascimento ||
    anyRec.nascimento ||
    '';
  return formatDateBr(raw);
};

export const getCleanAddress = (rec: SuspectRecord): string => {
  const anyRec = rec as any;
  let val = rec.endereco;
  if (!val && Array.isArray(rec.enderecos) && rec.enderecos.length > 0) {
    val = rec.enderecos[0];
  }
  if (!val && Array.isArray(anyRec.enderecos) && anyRec.enderecos.length > 0) {
    val = anyRec.enderecos[0];
  }
  if (!val && anyRec.logradouro) {
    val = anyRec.logradouro;
  }
  const str = String(val || '').trim();
  if (!str || str.toUpperCase() === '[OBJECT OBJECT]') {
    return '';
  }
  return str;
};

const SuspectCardComponent: React.FC<SuspectCardProps> = ({
  suspect,
  onClick,
  viewMode = 'grid',
  onToast,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Extrai fotos reais do registro
  const photos = extractSuspectPhotos(suspect);
  const currentPhotoRaw = photos[photoIndex] || photos[0] || '';
  const photoSrc = formatPhotoUrl(currentPhotoRaw);
  const hasMultiplePhotos = photos.length > 1;

  useEffect(() => {
    setImageError(false);
    setActiveSrc(photoSrc);
    setPhotoIndex(0);
  }, [suspect.id, currentPhotoRaw, photoSrc]);

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageError(false);
    const prevIdx = photoIndex > 0 ? photoIndex - 1 : photos.length - 1;
    setPhotoIndex(prevIdx);
    setActiveSrc(formatPhotoUrl(photos[prevIdx]));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageError(false);
    const nextIdx = photoIndex < photos.length - 1 ? photoIndex + 1 : 0;
    setPhotoIndex(nextIdx);
    setActiveSrc(formatPhotoUrl(photos[nextIdx]));
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSharing) return;
    setIsSharing(true);
    try {
      const res = await shareSuspectWithAllPhotos(suspect);
      if (res.success) {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      }
      if (onToast) onToast(res.message);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Erro ao compartilhar:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Identifica estilo baseado no Marcador Operacional (Preso, Morto, Alvo Prioritário, Foragido)
  const marcador = (suspect.marcador || '').toUpperCase();
  const isMorto = marcador === 'MORTO';
  const isPreso = marcador === 'PRESO';
  const isAlvoPrioritario = marcador === 'ALVO_PRIORITARIO' || marcador === 'ALVO PRIORITARIO';
  const isForagido = marcador === 'FORAGIDO';

  const getCardStyle = () => {
    if (isMorto) {
      return {
        markerClass: 'card-marcador-morto',
        cardBg: 'bg-[#220c10] shadow-[0_4px_20px_rgba(220,38,38,0.2)]',
        borderColor: 'border-red-500/70 hover:border-red-400',
        badgeBg: 'bg-red-950/95 border-red-500/80 text-red-200',
        label: 'MORTO',
        icon: <Skull className="w-3 h-3 text-red-400 flex-shrink-0" />,
      };
    }
    if (isPreso) {
      return {
        markerClass: 'card-marcador-preso',
        cardBg: 'bg-[#181e28] shadow-[0_4px_20px_rgba(148,163,184,0.15)]',
        borderColor: 'border-slate-400/70 hover:border-slate-300',
        badgeBg: 'bg-slate-500/95 border-slate-300 text-slate-100 font-extrabold',
        label: 'PRESO',
        icon: <Lock className="w-3 h-3 text-slate-100 flex-shrink-0" />,
      };
    }
    if (isAlvoPrioritario) {
      return {
        markerClass: 'card-marcador-alvo',
        cardBg: 'bg-[#261710] shadow-[0_4px_20px_rgba(168,90,44,0.25)]',
        borderColor: 'border-[#9c552e] hover:border-[#bf6b3d]',
        badgeBg: 'bg-[#5e351f]/95 border-[#9c552e] text-[#fadcce] font-extrabold',
        label: 'ALVO PRIORITÁRIO',
        icon: <Crosshair className="w-3 h-3 text-[#f09a6c] flex-shrink-0" />,
      };
    }
    if (isForagido) {
      return {
        markerClass: 'card-marcador-foragido',
        cardBg: 'bg-[#26220a] shadow-[0_4px_20px_rgba(234,179,8,0.25)]',
        borderColor: 'border-yellow-500/80 hover:border-yellow-400',
        badgeBg: 'bg-yellow-400 border-yellow-300 text-neutral-950 font-black',
        label: 'FORAGIDO',
        icon: <AlertTriangle className="w-3 h-3 text-neutral-950 flex-shrink-0" />,
      };
    }
    return {
      markerClass: 'card-marcador-nenhum',
      cardBg: 'bg-[#10141d]',
      borderColor: 'border-neutral-800/90 hover:border-[#c69c59]/60',
      badgeBg: '',
      label: '',
      icon: null,
    };
  };

  const currentStyle = getCardStyle();

  // Fallback de avatar quando não há foto
  const renderFallbackAvatar = (sizeClass: string = 'w-10 h-10', iconSize: string = 'w-5 h-5') => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#141923] to-[#0c0f16] text-neutral-500 p-2 select-none">
      <div className={`${sizeClass} rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mb-1 shadow-inner`}>
        <User className={`${iconSize} text-neutral-400`} />
      </div>
      <span className="text-[9px] font-bold tracking-wider text-neutral-400 uppercase">
        Sem Foto
      </span>
    </div>
  );

  // Badge do Marcador no canto superior esquerdo da foto
  const renderMarcadorBadge = (className: string = '') => {
    if (!currentStyle.label) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border tracking-wider uppercase shadow-sm ${currentStyle.badgeBg} ${className}`}
      >
        {currentStyle.icon}
        <span>{currentStyle.label}</span>
      </span>
    );
  };

  // Tag do VULGO no canto superior direito da foto
  const renderVulgoTag = () => {
    if (!suspect.alcunha) return null;
    return (
      <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/90 backdrop-blur-md border border-[#c69c59] text-[#f5d799] text-[10px] font-extrabold tracking-wider shadow-lg max-w-[130px] truncate">
          &quot;{suspect.alcunha}&quot;
        </span>
      </div>
    );
  };

  // Botão discreto com apenas o ícone de compartilhar, alinhado às cores do app
  const renderShareButton = () => (
    <button
      type="button"
      onClick={handleShareClick}
      disabled={isSharing}
      className={`p-1.5 rounded-lg border transition-all cursor-pointer shadow-sm active:scale-90 flex-shrink-0 disabled:opacity-50 ${
        shareSuccess
          ? 'bg-[#1e2636] border-[#c69c59] text-[#e5c07b]'
          : isSharing
          ? 'bg-[#182232] border-[#c69c59] text-[#e5c07b]'
          : 'bg-[#141a24] hover:bg-[#1e2636] border-neutral-700/70 hover:border-[#c69c59] text-neutral-300 hover:text-[#e5c07b]'
      }`}
      title="Compartilhar ficha com fotos via WhatsApp ou outros aplicativos"
    >
      {isSharing ? (
        <div className="w-3.5 h-3.5 border-2 border-[#c69c59] border-t-transparent rounded-full animate-spin flex-shrink-0" />
      ) : shareSuccess ? (
        <Check className="w-3.5 h-3.5 text-[#e5c07b] flex-shrink-0" />
      ) : (
        <Share2 className="w-3.5 h-3.5" />
      )}
    </button>
  );

  // Botão discreto para exportação individual do card em formato JSON para outros bancos de dados
  const renderExportButton = () => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        exportSingleCardJson(suspect);
        if (onToast) onToast(`Card de "${suspect.nome || 'Abordado'}" exportado individualmente em JSON!`);
      }}
      className="p-1.5 rounded-lg border bg-[#141a24] hover:bg-[#1a2334] border-neutral-700/70 hover:border-blue-500/70 text-neutral-400 hover:text-blue-300 transition-all cursor-pointer shadow-sm active:scale-90 flex-shrink-0"
      title="Exportar este card individualmente em JSON para importar em outro banco de dados"
    >
      <FileJson className="w-3.5 h-3.5" />
    </button>
  );

  // Identifica se o card/registro foi editado
  const isEdited = Boolean(
    (suspect.alterado &&
      suspect.alterado.trim() !== '' &&
      !suspect.alterado.toUpperCase().includes('NÃO') &&
      !suspect.alterado.toUpperCase().includes('NAO')) ||
    (suspect.dataAtualizacao &&
      suspect.dataCriacao &&
      suspect.dataAtualizacao !== suspect.dataCriacao)
  );

  const getEditedDateStr = () => {
    if (!suspect.dataAtualizacao) return '';
    try {
      const d = new Date(suspect.dataAtualizacao);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('pt-BR');
      }
    } catch {
      // fallback
    }
    return '';
  };

  // Mensagem discreta de card editado removida das telas de cards (será mantida na administração)
  const renderEditedBadge = () => null;

  // Dados consolidados
  const maeNome = getMotherName(suspect);
  const dataNascimento = getBirthDate(suspect);
  const enderecoLimpo = getCleanAddress(suspect);

  // -------------------------------------------------------------
  // MODO 1: LISTA OPERACIONAL (Horizontal)
  // -------------------------------------------------------------
  if (viewMode === 'list') {
    return (
      <div
        id={`suspect-card-${suspect.id}`}
        onClick={onClick}
        className={`group relative flex flex-row min-h-[220px] rounded-xl overflow-hidden card-content-visibility ${currentStyle.markerClass} ${currentStyle.cardBg} border ${currentStyle.borderColor} transition-all duration-200 shadow-md hover:shadow-xl cursor-pointer select-none`}
      >
        {/* Thumbnail na esquerda com vulgo no canto superior direito da foto */}
        <div className="relative w-44 sm:w-56 flex-shrink-0 bg-[#131720] overflow-hidden border-r border-neutral-800/80">
          {(activeSrc || photoSrc) && !imageError ? (
            <img
              src={activeSrc || photoSrc}
              alt={suspect.nome}
              className="w-full h-full object-cover object-[center_12%] group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : (
            renderFallbackAvatar('w-10 h-10', 'w-5 h-5')
          )}

          {/* Marcador no canto superior esquerdo da foto */}
          {currentStyle.label && (
            <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
              {renderMarcadorBadge()}
            </div>
          )}

          {/* Tag de Vulgo no canto superior direito da foto */}
          {renderVulgoTag()}

          {hasMultiplePhotos && (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[8px] text-[#e5c07b] border border-[#c69c59]/40 z-10">
              {photos.length} fotos
            </span>
          )}
        </div>

        {/* Informações detalhadas */}
        <div className="p-3 flex-1 min-w-0 flex flex-col justify-between text-xs text-neutral-300">
          <div className="space-y-1 text-[11px]">
            {/* 1. Nome */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Nome:</span>
                <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase truncate tracking-wide" title={suspect.nome}>
                  {suspect.nome || 'NÃO INFORMADO'}
                </h3>
              </div>
            </div>

            {/* 2. Mãe */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Mãe:</span>
              <span className="text-white font-semibold uppercase truncate" title={maeNome}>
                {maeNome || 'NÃO INFORMADA'}
              </span>
            </div>

            {/* 3. RG */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">RG:</span>
              <span className="text-white font-semibold truncate">{suspect.rg || '-'}</span>
            </div>

            {/* 4. CPF */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">CPF:</span>
              <span className="text-white font-semibold truncate">{suspect.cpf || '-'}</span>
            </div>

            {/* 5. Nascimento */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Nascimento:</span>
              <span className="text-white font-semibold truncate">{dataNascimento || '-'}</span>
            </div>

            {/* 6. Endereço */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Endereço:</span>
              <span className="text-white font-semibold truncate" title={enderecoLimpo}>
                {enderecoLimpo || 'Endereço não informado'}
              </span>
            </div>

            {/* Artigo Penal (se houver) */}
            {suspect.artigo && (
              <div className="flex items-center gap-1.5 text-neutral-300 truncate text-[10px]">
                <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Artigo:</span>
                <span className="text-[#e5c07b] font-semibold truncate">{suspect.artigo}</span>
              </div>
            )}

            {/* Observações - mesmo tamanho e padrão do nome, sem itálico */}
            {suspect.observacoes && (
              <div className="flex items-start gap-1.5 text-neutral-200 truncate pt-0.5">
                <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Obs:</span>
                <span className="font-extrabold text-xs sm:text-sm text-white uppercase truncate tracking-wide" title={suspect.observacoes}>
                  {suspect.observacoes}
                </span>
              </div>
            )}
          </div>

          {/* Rodapé da linha: Ícone de Compartilhar no canto inferior esquerdo */}
          <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-neutral-800/80 gap-2 mt-2">
            <div className="flex items-center gap-2">
              {renderShareButton()}
              {renderExportButton()}
              {renderEditedBadge()}
            </div>
            <span className="text-[#c69c59] font-semibold hover:underline flex-shrink-0">
              Ver Ficha →
            </span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MODO 2: COMPACTO / DETALHES (E 3 CARDS LADO A LADO)
  // -------------------------------------------------------------
  if (viewMode === 'compact' || viewMode === 'grid-3') {
    return (
      <div
        id={`suspect-card-${suspect.id}`}
        onClick={onClick}
        className={`group relative flex flex-col min-h-[480px] rounded-2xl overflow-hidden card-content-visibility ${currentStyle.markerClass} ${currentStyle.cardBg} border ${currentStyle.borderColor} transition-all duration-200 shadow-md hover:shadow-xl cursor-pointer select-none`}
      >
        {/* Foto compacta com vulgo no canto superior direito da foto */}
        <div className="relative h-48 sm:h-52 w-full flex-shrink-0 bg-[#131720] overflow-hidden flex items-center justify-center border-b border-neutral-800/80">
          {(activeSrc || photoSrc) && !imageError ? (
            <img
              src={activeSrc || photoSrc}
              alt={suspect.nome}
              className="w-full h-full object-cover object-[center_12%] group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : (
            renderFallbackAvatar('w-11 h-11', 'w-5 h-5')
          )}

          {/* Marcador no canto superior esquerdo da foto */}
          {currentStyle.label && (
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              {renderMarcadorBadge()}
            </div>
          )}

          {/* Tag de Vulgo no canto superior direito da foto */}
          {renderVulgoTag()}
        </div>

        {/* Detalhes ordenados rigorosamente */}
        <div className="p-3 text-xs text-neutral-300 flex-1 flex flex-col justify-between">
          <div className="space-y-1 text-[11px]">
            {/* 1. Nome */}
            <div className="pb-0.5">
              <span className="text-[10px] text-neutral-400 font-bold uppercase mr-1">Nome:</span>
              <span className="font-extrabold text-xs text-white uppercase truncate inline" title={suspect.nome}>
                {suspect.nome || 'NÃO INFORMADO'}
              </span>
            </div>

            {/* 2. Mãe */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Mãe:</span>
              <span className="text-white font-semibold uppercase truncate" title={maeNome}>
                {maeNome || 'NÃO INFORMADA'}
              </span>
            </div>

            {/* 3. RG */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">RG:</span>
              <span className="text-white font-semibold truncate">{suspect.rg || '-'}</span>
            </div>

            {/* 4. CPF */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">CPF:</span>
              <span className="text-white font-semibold truncate">{suspect.cpf || '-'}</span>
            </div>

            {/* 5. Nascimento */}
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Nascimento:</span>
              <span className="text-white truncate">{dataNascimento || '-'}</span>
            </div>

            {/* 6. Endereço */}
            <div className="flex items-start gap-1.5 text-neutral-300">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0 mt-0.5">Endereço:</span>
              <span className="text-white font-semibold leading-tight truncate flex-1" title={enderecoLimpo}>
                {enderecoLimpo || 'Endereço não informado'}
              </span>
            </div>

            {/* Artigo Penal (se houver) */}
            {suspect.artigo && (
              <div className="flex items-center gap-1.5 text-neutral-300 pt-0.5 text-[10px]">
                <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Artigo:</span>
                <span className="text-[#e5c07b] font-semibold truncate">{suspect.artigo}</span>
              </div>
            )}

            {/* Observações - mesmo tamanho e padrão do nome, sem itálico */}
            {suspect.observacoes && (
              <div className="pt-0.5" title={suspect.observacoes}>
                <span className="text-[10px] text-neutral-400 font-bold uppercase mr-1">Obs:</span>
                <span className="font-extrabold text-xs text-white uppercase truncate inline">
                  {suspect.observacoes}
                </span>
              </div>
            )}
          </div>

          {/* Rodapé Compacto: Ícone de Compartilhar no canto inferior esquerdo */}
          <div className="pt-2 mt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2">
              {renderShareButton()}
              {renderExportButton()}
              {renderEditedBadge()}
            </div>
            <span className="text-[#c69c59] font-semibold hover:underline">Ver Ficha →</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MODO 3: GRADE PADRÃO / LADO A LADO
  // -------------------------------------------------------------
  return (
    <div
      id={`suspect-card-${suspect.id}`}
      onClick={onClick}
      className={`group relative flex flex-col min-h-[530px] rounded-2xl overflow-hidden card-content-visibility ${currentStyle.markerClass} ${currentStyle.cardBg} border ${currentStyle.borderColor} transition-all duration-200 shadow-md hover:shadow-2xl cursor-pointer select-none`}
    >
      {/* Photo Container com Marcador na Esquerda e Vulgo no Canto Superior Direito */}
      <div className="relative h-64 sm:h-72 w-full flex-shrink-0 bg-[#131720] overflow-hidden flex items-center justify-center border-b border-neutral-800/80">
        {(activeSrc || photoSrc) && !imageError ? (
          <img
            src={activeSrc || photoSrc}
            alt={suspect.nome}
            className="w-full h-full object-cover object-[center_12%] transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          renderFallbackAvatar('w-14 h-14', 'w-7 h-7')
        )}

        {/* Marcador no canto superior esquerdo da foto */}
        {currentStyle.label && (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            {renderMarcadorBadge()}
          </div>
        )}

        {/* Tag do VULGO no CANTO SUPERIOR DIREITO DA FOTO */}
        {renderVulgoTag()}

        {/* Photo Counter Overlay no canto inferior direito da foto */}
        {hasMultiplePhotos && (
          <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none">
            <span className="px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-[#c69c59]/50 text-white text-[10px] font-medium shadow-sm">
              {photoIndex + 1}/{photos.length} Fotos
            </span>
          </div>
        )}

        {/* Carousel Arrows */}
        {hasMultiplePhotos && photoSrc && !imageError && (
          <>
            <button
              type="button"
              onClick={handlePrevPhoto}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-all z-10 opacity-80 hover:opacity-100 cursor-pointer shadow-md"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextPhoto}
              aria-label="Próxima foto"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-all z-10 opacity-80 hover:opacity-100 cursor-pointer shadow-md"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Card Info Section: Nome, Mãe, RG, CPF, Nascimento, Endereço, Artigo, Observações */}
      <div className="p-3.5 text-xs text-neutral-300 flex-1 flex flex-col justify-between overflow-hidden">
        <div className="space-y-1.5 text-[11px]">
          {/* 1. Nome */}
          <div className="pb-0.5">
            <span className="text-[10px] text-neutral-400 font-bold uppercase mr-1.5">Nome:</span>
            <span
              className="font-extrabold text-xs sm:text-sm text-white tracking-wide uppercase truncate inline"
              title={suspect.nome}
            >
              {suspect.nome || 'NÃO INFORMADO'}
            </span>
          </div>

          {/* 2. Mãe */}
          <div className="flex items-center gap-1.5 text-neutral-300 truncate">
            <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Mãe:</span>
            <span className="text-white font-semibold uppercase truncate" title={maeNome}>
              {maeNome || 'NÃO INFORMADA'}
            </span>
          </div>

          {/* 3. RG */}
          <div className="flex items-center gap-1.5 text-neutral-300 truncate">
            <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">RG:</span>
            <span className="text-white font-semibold truncate">
              {suspect.rg || '-'}
            </span>
          </div>

          {/* 4. CPF */}
          <div className="flex items-center gap-1.5 text-neutral-300 truncate">
            <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">CPF:</span>
            <span className="text-white font-semibold truncate">
              {suspect.cpf || '-'}
            </span>
          </div>

          {/* 5. Nascimento */}
          <div className="flex items-center gap-1.5 text-neutral-300 truncate">
            <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Nascimento:</span>
            <span className="text-white truncate">
              {dataNascimento || '-'}
            </span>
          </div>

          {/* 6. Endereço */}
          <div className="flex items-start gap-1.5 text-neutral-300">
            <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0 mt-0.5">Endereço:</span>
            <span className="text-white font-semibold leading-tight truncate flex-1" title={enderecoLimpo}>
              {enderecoLimpo || 'Endereço não informado'}
            </span>
          </div>

          {/* Artigo Penal (se houver) */}
          {suspect.artigo && (
            <div className="flex items-center gap-1.5 text-neutral-300 pt-0.5">
              <span className="text-[10px] text-neutral-400 font-bold uppercase flex-shrink-0">Artigo:</span>
              <span className="text-[#e5c07b] font-semibold truncate">
                {suspect.artigo}
              </span>
            </div>
          )}

          {/* Observações - mesmo tamanho e padrão do nome, sem itálico */}
          {suspect.observacoes && (
            <div className="pt-0.5" title={suspect.observacoes}>
              <span className="text-[10px] text-neutral-400 font-bold uppercase mr-1.5">Obs:</span>
              <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide uppercase truncate inline">
                {suspect.observacoes}
              </span>
            </div>
          )}
        </div>

        {/* Rodapé Interno do Card: Ícone de Compartilhar no canto inferior esquerdo */}
        <div className="pt-2.5 mt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-2">
            {renderShareButton()}
            {renderExportButton()}
            {renderEditedBadge()}
          </div>
          <span className="text-[#c69c59] font-medium hover:underline flex items-center gap-1">
            Ver Ficha Completa →
          </span>
        </div>
      </div>
    </div>
  );
};

// Componente memoizado para renderização instantânea a 60 FPS durante rolagem e buscas
export const SuspectCard = React.memo<SuspectCardProps>(SuspectCardComponent, (prev, next) => {
  return (
    prev.suspect.id === next.suspect.id &&
    prev.suspect.dataCriacao === next.suspect.dataCriacao &&
    prev.suspect.marcador === next.suspect.marcador &&
    prev.suspect.nome === next.suspect.nome &&
    prev.suspect.alcunha === next.suspect.alcunha &&
    prev.suspect.fotos?.length === next.suspect.fotos?.length &&
    prev.suspect.localAbordagem === next.suspect.localAbordagem &&
    prev.viewMode === next.viewMode
  );
});

