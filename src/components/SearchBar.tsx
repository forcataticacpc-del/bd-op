import React from 'react';
import { Search, X, Loader2, Database, ScanLine } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
  onOpenFacialRecognition?: () => void;
  totalFiltered: number;
  totalAll: number;
  isSearching?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  onOpenFacialRecognition,
  totalFiltered,
  totalAll,
  isSearching = false,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-3 px-4">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-[#c69c59] animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-[#c69c59]" />
          )}
        </div>
        <input
          type="text"
          id="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Pesquisar por Nome, Mãe, RG, CPF, Apelido, Artigo (sem acentos)..."
          className="w-full pl-10 pr-32 py-2.5 sm:py-3 rounded-xl bg-[#161b22] border border-neutral-700/80 focus:border-[#c69c59] focus:ring-1 focus:ring-[#c69c59]/50 text-sm text-neutral-100 placeholder:text-neutral-500 transition-all outline-none shadow-sm"
        />

        <div className="absolute right-2 flex items-center gap-1.5">
          {onOpenFacialRecognition && (
            <button
              type="button"
              id="btn-search-facial-recognition"
              onClick={onOpenFacialRecognition}
              className="p-1.5 rounded-lg bg-[#1f2637] hover:bg-[#283247] text-[#e5c07b] border border-[#c69c59]/40 hover:border-[#c69c59] transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer"
              title="Identificação Facial Tática por IA (Câmera / Foto do Abordado)"
            >
              <ScanLine className="w-4 h-4 text-[#c69c59]" />
              <span className="hidden sm:inline text-[11px] font-bold text-[#e5c07b]">Scan Facial</span>
            </button>
          )}

          {value && (
            <button
              type="button"
              id="btn-clear-search"
              onClick={() => onChange('')}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Limpar pesquisa"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            id="btn-submit-search"
            disabled={isSearching}
            className="px-3 py-1.5 rounded-lg bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            title="Buscar no Banco de Dados em Nuvem"
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />
            ) : (
              <span>Buscar</span>
            )}
          </button>
        </div>
      </form>

      {/* Tactical Status Under Search Bar (Sem letras miúdas indesejadas) */}
      {(isSearching || value.trim()) && (
        <div className="mt-1.5 px-2 flex flex-wrap items-center justify-between text-xs text-neutral-400 gap-1">
          {isSearching ? (
            <span className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px] animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-[#c69c59]" />
              Consultando Banco de Dados...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-neutral-300 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Filtrando por: <strong className="text-amber-200 font-mono">"{value}"</strong>
            </span>
          )}

          <span className="text-[11px] font-mono text-neutral-400">
            {totalFiltered} {totalFiltered === 1 ? 'registro encontrado' : 'registros encontrados'}
          </span>
        </div>
      )}
    </div>
  );
};

