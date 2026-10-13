import React from 'react';
import { Search, Plus, Target, Filter, Settings, ShieldAlert } from 'lucide-react';

interface MobileBottomNavProps {
  onSearchClick: () => void;
  onNewRecordClick: () => void;
  onFilterClick: () => void;
  onPriorityTargetsClick: () => void;
  onSettingsClick: () => void;
  onOrcrimClick?: () => void;
  isPriorityActive: boolean;
  activeFilterCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onSearchClick,
  onNewRecordClick,
  onFilterClick,
  onPriorityTargetsClick,
  onSettingsClick,
  onOrcrimClick,
  isPriorityActive,
  activeFilterCount,
}) => {
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Navegação Operacional Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d1117]/95 backdrop-blur-lg border-t border-[#c69c59]/30 px-1 py-1.5 shadow-2xl safe-area-pb"
    >
      <div className="max-w-md mx-auto grid grid-cols-6 items-center justify-items-center">
        {/* 1. Consulta / Busca */}
        <button
          type="button"
          onClick={onSearchClick}
          className="flex flex-col items-center justify-center w-full py-1 text-neutral-400 hover:text-[#e5c07b] active:scale-90 transition-all cursor-pointer"
          title="Pesquisar Abordados"
        >
          <Search className="w-4 h-4 mb-0.5" />
          <span className="text-[8px] font-bold uppercase tracking-tight">Buscar</span>
        </button>

        {/* 2. ORCRIM */}
        <button
          type="button"
          onClick={onOrcrimClick}
          className="flex flex-col items-center justify-center w-full py-1 text-rose-400/90 hover:text-rose-300 active:scale-90 transition-all cursor-pointer"
          title="Módulo ORCRIM (Facções e Organograma)"
        >
          <ShieldAlert className="w-4 h-4 mb-0.5 text-rose-400" />
          <span className="text-[8px] font-bold uppercase tracking-tight">ORCRIM</span>
        </button>

        {/* 3. Botão Central: Nova Abordagem */}
        <button
          type="button"
          onClick={onNewRecordClick}
          className="flex flex-col items-center justify-center w-full py-1 text-amber-300 hover:text-amber-200 active:scale-90 transition-all cursor-pointer"
          title="Cadastrar Nova Abordagem"
        >
          <Plus className="w-4 h-4 mb-0.5 stroke-[2.5] text-[#c69c59]" />
          <span className="text-[8px] font-bold uppercase tracking-tight text-amber-200">Novo</span>
        </button>

        {/* 4. Alvos Prioritários */}
        <button
          type="button"
          onClick={onPriorityTargetsClick}
          className={`relative flex flex-col items-center justify-center w-full py-1 active:scale-90 transition-all cursor-pointer ${
            isPriorityActive ? 'text-red-400 font-extrabold' : 'text-neutral-400 hover:text-red-400'
          }`}
          title="Ver Alvos Prioritários"
        >
          <Target className={`w-4 h-4 mb-0.5 ${isPriorityActive ? 'text-red-500 animate-pulse' : ''}`} />
          <span className="text-[8px] font-bold uppercase tracking-tight">Alvos</span>
          {isPriorityActive && (
            <span className="absolute top-0.5 right-2 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          )}
        </button>

        {/* 5. Filtros (Bairros e Artigos) */}
        <button
          type="button"
          onClick={onFilterClick}
          className="relative flex flex-col items-center justify-center w-full py-1 text-neutral-400 hover:text-[#e5c07b] active:scale-90 transition-all cursor-pointer"
          title="Filtrar por Bairro ou Artigo"
        >
          <Filter className="w-4 h-4 mb-0.5" />
          <span className="text-[8px] font-bold uppercase tracking-tight">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="absolute top-0 right-1 px-1 py-0.2 rounded-full text-[8px] font-mono bg-[#c69c59] text-neutral-950 font-black">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* 6. Ajustes */}
        <button
          type="button"
          onClick={onSettingsClick}
          className="flex flex-col items-center justify-center w-full py-1 text-neutral-400 hover:text-[#e5c07b] active:scale-90 transition-all cursor-pointer"
          title="Configurações e Nuvem"
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span className="text-[8px] font-bold uppercase tracking-tight">Ajustes</span>
        </button>
      </div>
    </nav>
  );
};
