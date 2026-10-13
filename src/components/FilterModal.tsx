import React, { useState, useMemo } from 'react';
import {
  X,
  Filter,
  MapPin,
  Tag,
  FileText,
  RotateCcw,
  Check,
  Search,
  Building2,
} from 'lucide-react';
import { SuspectRecord, SuspectMarcador } from '../types';
import { countSuspectsByBairro, normalizeText } from '../data/bairrosBH';

export interface FilterCriteria {
  bairro: string;
  marcador: SuspectMarcador | 'TODOS' | 'SEM_MARCADOR';
  artigo: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  suspects: SuspectRecord[];
  currentFilters: FilterCriteria;
  onApplyFilters: (filters: FilterCriteria) => void;
  onClearFilters: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  suspects,
  currentFilters,
  onApplyFilters,
  onClearFilters,
}) => {
  const [bairro, setBairro] = useState(currentFilters.bairro || '');
  const [marcador, setMarcador] = useState<SuspectMarcador | 'TODOS' | 'SEM_MARCADOR'>(
    currentFilters.marcador || 'TODOS'
  );
  const [artigo, setArtigo] = useState(currentFilters.artigo || '');
  const [bairroSearch, setBairroSearch] = useState('');

  // Atualiza estado interno quando o modal abre ou filtros mudam
  React.useEffect(() => {
    if (isOpen) {
      setBairro(currentFilters.bairro || '');
      setMarcador(currentFilters.marcador || 'TODOS');
      setArtigo(currentFilters.artigo || '');
      setBairroSearch('');
    }
  }, [isOpen, currentFilters]);

  // Contagem de abordados em cada bairro de Belo Horizonte
  const { todosBairros, bairrosComAbordados, totalAbordadosComBairro } = useMemo(() => {
    return countSuspectsByBairro(suspects);
  }, [suspects]);

  // Filtra a lista de bairros pelo termo digitado na busca de bairros
  const filteredBairros = useMemo(() => {
    if (!bairroSearch.trim()) return todosBairros;
    const term = normalizeText(bairroSearch);
    return todosBairros.filter((b) => normalizeText(b.bairro).includes(term));
  }, [todosBairros, bairroSearch]);

  if (!isOpen) return null;

  const isAnyFilterActive = Boolean(
    bairro || (marcador && marcador !== 'TODOS') || artigo.trim()
  );

  const handleApply = () => {
    onApplyFilters({
      bairro,
      marcador,
      artigo: artigo.trim(),
    });
    onClose();
  };

  const handleReset = () => {
    setBairro('');
    setMarcador('TODOS');
    setArtigo('');
    setBairroSearch('');
    onClearFilters();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="filter-modal-dialog"
        className="relative w-full max-w-lg my-auto bg-[#10141d] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Filtro */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800/90 bg-[#141822]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c69c59]/15 border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b]">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                Filtrar Abordados
              </h2>
              <span className="text-[10px] text-[#c69c59] font-mono block">
                BELO HORIZONTE • MARCADORES • ARTIGOS
              </span>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-filter-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Filtro com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* 1. FILTRO POR BAIRRO DE BELO HORIZONTE - MG COM COMPARATIVO */}
          <div className="space-y-2 p-3 rounded-xl bg-[#141822] border border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#c69c59]" />
                <span>Bairros de Belo Horizonte - MG</span>
              </label>
              <span className="text-[10px] font-mono text-[#e5c07b] bg-[#1a202d] px-2 py-0.5 rounded border border-[#c69c59]/30">
                {bairrosComAbordados.length} bairros c/ abordados
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 leading-snug">
              Comparativo automático com os endereços cadastrados no app ({totalAbordadosComBairro} abordados mapeados em BH):
            </p>

            {/* Input de busca rápida de bairro */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bairroSearch}
                onChange={(e) => setBairroSearch(e.target.value)}
                placeholder="Pesquisar bairro de BH..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#10141d] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors"
              />
              {bairroSearch && (
                <button
                  type="button"
                  onClick={() => setBairroSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Seleção do Bairro com Contagem */}
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              <button
                type="button"
                onClick={() => setBairro('')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  !bairro
                    ? 'bg-[#c69c59]/20 border border-[#c69c59] text-[#e5c07b] font-bold'
                    : 'bg-[#10141d] hover:bg-neutral-800 text-neutral-300 border border-transparent'
                }`}
              >
                <span>Todos os Bairros</span>
                {!bairro && <Check className="w-3.5 h-3.5 text-[#c69c59]" />}
              </button>

              {filteredBairros.map((item) => {
                const isSelected = bairro === item.bairro;
                const hasCount = item.total > 0;
                return (
                  <button
                    key={item.bairro}
                    type="button"
                    onClick={() => setBairro(isSelected ? '' : item.bairro)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#c69c59]/20 border border-[#c69c59] text-[#e5c07b] font-bold'
                        : hasCount
                        ? 'bg-[#1a2130] hover:bg-[#222c40] text-white border border-[#c69c59]/30'
                        : 'bg-[#10141d] hover:bg-neutral-800 text-neutral-400 border border-transparent'
                    }`}
                  >
                    <span className="truncate pr-2">{item.bairro}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        hasCount
                          ? 'bg-[#c69c59] text-neutral-950 font-bold'
                          : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {item.total} {item.total === 1 ? 'abordado' : 'abordados'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. FILTRO POR MARCADORES */}
          <div className="space-y-2 p-3 rounded-xl bg-[#141822] border border-neutral-800">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#c69c59]" />
              <span>Marcador Operacional</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {[
                { id: 'TODOS', label: 'Todos' },
                { id: 'PRESO', label: 'Preso', color: 'text-slate-300' },
                { id: 'ALVO_PRIORITARIO', label: 'Alvo Prioritário', color: 'text-amber-500' },
                { id: 'FORAGIDO', label: 'Foragido', color: 'text-yellow-400' },
                { id: 'MORTO', label: 'Morto', color: 'text-red-400' },
              ].map((opt) => {
                const isSelected = marcador === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMarcador(opt.id as any)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer text-center truncate ${
                      isSelected
                        ? 'bg-[#c69c59] text-neutral-950 border-[#c69c59] shadow-sm font-bold'
                        : 'bg-[#10141d] text-neutral-300 border-neutral-700/80 hover:border-neutral-600 hover:bg-neutral-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. FILTRO POR ARTIGO PENAL */}
          <div className="space-y-2 p-3 rounded-xl bg-[#141822] border border-neutral-800">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#c69c59]" />
              <span>Busca por Artigo Penal</span>
            </label>

            <input
              type="text"
              value={artigo}
              onChange={(e) => setArtigo(e.target.value)}
              placeholder="Ex: 157, 33, 121, 155, 14, 16..."
              className="w-full px-3 py-2 rounded-lg bg-[#10141d] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase font-mono transition-colors"
            />

            {/* Sugestões rápidas dos artigos mais comuns */}
            <div className="flex flex-wrap gap-1 pt-1">
              {['157', '33', '121', '155', '180', '16', '14'].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setArtigo(sug)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-all ${
                    artigo === sug
                      ? 'bg-[#c69c59] text-neutral-950 font-bold border-[#c69c59]'
                      : 'bg-[#10141d] text-neutral-400 border-neutral-700 hover:text-white hover:border-[#c69c59]/50'
                  }`}
                >
                  Art. {sug}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer com Botão de Disparar a Filtragem e Limpar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-neutral-800/90 bg-[#141822] gap-2">
          <button
            type="button"
            id="btn-clear-filters"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-cancel-filters"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-neutral-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              id="btn-apply-filters"
              onClick={handleApply}
              className="px-4 py-2 rounded-lg bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrar Resultados</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
