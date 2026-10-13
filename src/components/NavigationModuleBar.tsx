import React from 'react';

export type NavigationModule = 'cadastrados' | 'abordagens' | 'orcrim' | 'organograma' | 'facial';
export type BarPosition = 'above' | 'below';

interface NavigationModuleBarProps {
  activeModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  totalCadastrados?: number;
  totalOrcrims?: number;
  barPosition?: BarPosition;
  onChangeBarPosition?: (pos: BarPosition) => void;
}

export const NavigationModuleBar: React.FC<NavigationModuleBarProps> = ({
  activeModule,
  onSelectModule,
  totalOrcrims = 0,
}) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 mb-2.5">
      <div className="bg-[#121622]/90 backdrop-blur border border-[#c69c59]/30 rounded-2xl p-2 sm:p-2.5 shadow-lg flex flex-col gap-2">
        {/* Barra de Módulos Operacionais: Abordagens, ORCRIM / FC e Organograma */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* 1. Abordagens */}
          <button
            type="button"
            id="nav-btn-abordagens"
            onClick={() => onSelectModule('abordagens')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm ${
              activeModule === 'abordagens'
                ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 border-[#d8ab62] shadow-[#c69c59]/20 shadow-md'
                : 'bg-[#181d2a] hover:bg-[#1f2637] border-neutral-700/80 text-neutral-200 hover:border-[#c69c59]/50'
            }`}
          >
            <span className="truncate">Abordagens</span>
          </button>

          {/* 2. ORCRIM / FC */}
          <button
            type="button"
            id="nav-btn-orcrim"
            onClick={() => onSelectModule('orcrim')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm ${
              activeModule === 'orcrim'
                ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 border-[#d8ab62] shadow-[#c69c59]/20 shadow-md'
                : 'bg-[#181d2a] hover:bg-[#1f2637] border-neutral-700/80 text-neutral-200 hover:border-[#c69c59]/50'
            }`}
          >
            <span className="truncate">ORCRIM / FC</span>
            {totalOrcrims > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-extrabold flex-shrink-0 ${
                  activeModule === 'orcrim'
                    ? 'bg-neutral-950 text-[#e5c07b]'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {totalOrcrims}
              </span>
            )}
          </button>

          {/* 3. Organograma */}
          <button
            type="button"
            id="nav-btn-organograma"
            onClick={() => onSelectModule('organograma')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm ${
              activeModule === 'organograma'
                ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 border-[#d8ab62] shadow-[#c69c59]/20 shadow-md'
                : 'bg-[#181d2a] hover:bg-[#1f2637] border-neutral-700/80 text-neutral-200 hover:border-[#c69c59]/50'
            }`}
          >
            <span className="truncate">Organograma</span>
          </button>
        </div>
      </div>
    </div>
  );
};
