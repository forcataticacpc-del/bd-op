import React from 'react';
import {
  ShieldAlert,
  Users,
  Target,
  Lock,
  Skull,
  Plus,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  FolderGit2,
} from 'lucide-react';
import { SuspectRecord } from '../types';
import { BackendProvider } from '../utils/cloudflareApi';

interface WebCommandBarProps {
  suspects: SuspectRecord[];
  activeProvider: BackendProvider;
  onOpenCloudflareModal?: () => void;
  onOpenGitHubModal?: () => void;
  onOpenOrcrimModal?: () => void;
  onOpenUserManagementModal?: () => void;
  onOpenSmartImportModal?: () => void;
  onNewRecord: () => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  onSelectMarkerFilter: (marker: string) => void;
  currentMarker: string;
}

export const WebCommandBar: React.FC<WebCommandBarProps> = ({
  suspects,
  activeProvider,
  onOpenCloudflareModal,
  onOpenGitHubModal,
  onOpenOrcrimModal,
  onOpenUserManagementModal,
  onOpenSmartImportModal,
  onNewRecord,
  onRefreshAll,
  isRefreshing,
  onSelectMarkerFilter,
  currentMarker,
}) => {
  const total = suspects.length;
  const alvosPrioritarios = suspects.filter(
    (s) => s.marcador === 'ALVO_PRIORITARIO' || (s.alcunha && s.alcunha.toUpperCase().includes('ALVO'))
  ).length;
  const presos = suspects.filter((s) => s.marcador === 'PRESO').length;
  const mortos = suspects.filter((s) => s.marcador === 'MORTO').length;

  return (
    <div
      id="web-tactical-command-bar"
      className="hidden md:block w-full max-w-7xl mx-auto px-4 mb-3"
    >
      <div className="bg-[#121622]/90 border border-neutral-800 rounded-2xl p-3 shadow-lg flex items-center justify-between gap-4">
        {/* KPI Chips Clicáveis para Filtragem Instantânea */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Total Geral */}
          <button
            type="button"
            onClick={() => onSelectMarkerFilter('TODOS')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              currentMarker === 'TODOS'
                ? 'bg-[#1b212f] border-[#c69c59] text-white shadow-sm'
                : 'bg-[#151924] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#c69c59]" />
            <span>Total:</span>
            <span className="font-mono text-white text-xs">{total}</span>
          </button>

          {/* Alvos Prioritários */}
          <button
            type="button"
            onClick={() =>
              onSelectMarkerFilter(currentMarker === 'ALVO_PRIORITARIO' ? 'TODOS' : 'ALVO_PRIORITARIO')
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              currentMarker === 'ALVO_PRIORITARIO'
                ? 'bg-red-950/60 border-red-500 text-red-200 shadow-md ring-1 ring-red-500'
                : 'bg-[#151924] border-neutral-800 text-neutral-400 hover:text-red-400 hover:border-red-900/50'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-red-500" />
            <span>Alvos Prioritários:</span>
            <span className="font-mono text-red-400 font-extrabold text-xs">{alvosPrioritarios}</span>
          </button>

          {/* Presos */}
          <button
            type="button"
            onClick={() =>
              onSelectMarkerFilter(currentMarker === 'PRESO' ? 'TODOS' : 'PRESO')
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              currentMarker === 'PRESO'
                ? 'bg-amber-950/50 border-amber-500 text-amber-200 shadow-md'
                : 'bg-[#151924] border-neutral-800 text-neutral-400 hover:text-amber-400'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>Presos:</span>
            <span className="font-mono text-amber-300 font-bold text-xs">{presos}</span>
          </button>

          {/* Baixas / Mortos */}
          <button
            type="button"
            onClick={() =>
              onSelectMarkerFilter(currentMarker === 'MORTO' ? 'TODOS' : 'MORTO')
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              currentMarker === 'MORTO'
                ? 'bg-neutral-800 border-neutral-500 text-neutral-200 shadow-md'
                : 'bg-[#151924] border-neutral-800 text-neutral-400 hover:text-neutral-300'
            }`}
          >
            <Skull className="w-3.5 h-3.5 text-neutral-400" />
            <span>Mortos:</span>
            <span className="font-mono text-neutral-300 font-bold text-xs">{mortos}</span>
          </button>
        </div>

        {/* Lado Direito: Ações de Comando Web */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Módulo ORCRIM */}
          {onOpenOrcrimModal && (
            <button
              type="button"
              id="btn-web-command-orcrim"
              onClick={onOpenOrcrimModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 hover:border-rose-400 text-rose-200 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Abrir Módulo de Organizações Criminosas e Organograma"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>ORCRIM</span>
            </button>
          )}

          {/* Gestão de Usuários */}
          {onOpenUserManagementModal && (
            <button
              type="button"
              id="btn-web-command-users"
              onClick={onOpenUserManagementModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161f2e] hover:bg-[#1d2a3f] border border-[#3b82f6]/40 hover:border-[#3b82f6] text-blue-200 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Gestão de Usuários e Permissões"
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Usuários</span>
            </button>
          )}

          {/* Sincronização e Deploy no GitHub */}
          {onOpenGitHubModal && (
            <button
              type="button"
              id="btn-web-command-github"
              onClick={onOpenGitHubModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Publicar no GitHub (Deploy Automático no Cloudflare)"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>GitHub</span>
            </button>
          )}

          {/* Atualizar Banco */}
          <button
            type="button"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151924] hover:bg-[#1c2230] border border-neutral-700/80 text-neutral-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar dados da nuvem"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#c69c59] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          {/* Botão Novo Registro Web */}
          <button
            type="button"
            onClick={onNewRecord}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#e5c07b] hover:from-[#d4af37] hover:to-[#ffd700] text-neutral-950 text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nova Abordagem</span>
          </button>
        </div>
      </div>
    </div>
  );
};
