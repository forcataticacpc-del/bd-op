import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Download,
  Smartphone,
  Monitor,
  LogOut,
  Sparkles,
  FolderGit2,
} from 'lucide-react';
import { ThemeMode } from '../utils/theme';
import { BackendProvider } from '../utils/cloudflareApi';
import { UserSession } from '../utils/userAuth';
import { getAppCustomName } from '../utils/appName';

export type ViewportMode = 'mobile' | 'web' | 'auto';

interface HeaderProps {
  totalRecords: number;
  onOpenSettingsModal: () => void;
  onOpenInstallModal?: () => void;
  onOpenCloudflareModal?: () => void;
  onOpenGitHubModal?: () => void;
  onOpenOrcrimModal?: () => void;
  onOpenUserManagementModal?: () => void;
  onOpenAuthModal?: () => void;
  onOpenSmartImportModal?: () => void;
  onLogout?: () => void;
  currentSession?: UserSession | null;
  activeProvider?: BackendProvider;
  viewportMode?: ViewportMode;
  onChangeViewportMode?: (mode: ViewportMode) => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettingsModal,
  onOpenInstallModal,
  onOpenGitHubModal,
  onOpenSmartImportModal,
  onLogout,
  currentSession,
  viewportMode = 'auto',
  onChangeViewportMode,
  theme,
  onToggleTheme,
}) => {
  const [appName, setAppName] = useState(getAppCustomName);

  useEffect(() => {
    const handleNameChange = () => {
      setAppName(getAppCustomName());
    };
    window.addEventListener('app_name_changed', handleNameChange);
    return () => window.removeEventListener('app_name_changed', handleNameChange);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#0d1117]/95 backdrop-blur border-b border-[#c69c59]/25 px-3 sm:px-4 py-2 sm:py-2.5 transition-all shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Logo e Título */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center">
            <img
              src="/banco_de_dados_logo.svg"
              alt={appName}
              className="w-full h-full object-contain drop-shadow-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-extrabold tracking-tight text-white uppercase truncate leading-tight">
              {appName}
            </h1>
          </div>
        </div>

        {/* Right Actions: Seletor Celular/Web + Instalar + Tema + Ajustes */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Seletor Rápido de Visualização (📱 Celular / 💻 Web) */}
          {onChangeViewportMode && (
            <div className="flex items-center bg-[#161b22] border border-neutral-700/80 rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => onChangeViewportMode('mobile')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  viewportMode === 'mobile'
                    ? 'bg-[#c69c59] text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Visualizar interface para Celular"
              >
                <Smartphone className="w-3 h-3" />
                <span>Celular</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeViewportMode('web')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  viewportMode === 'web'
                    ? 'bg-[#c69c59] text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Visualizar interface para Web"
              >
                <Monitor className="w-3 h-3" />
                <span>Web</span>
              </button>
            </div>
          )}

          {/* Botão Instalar App */}
          {onOpenInstallModal && (
            <button
              type="button"
              id="btn-header-install-app"
              onClick={onOpenInstallModal}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#c69c59] to-[#e5c07b] hover:from-[#d4af37] hover:to-[#ffd700] text-neutral-950 font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Instalar App no Celular ou Área de Trabalho do PC"
            >
              <Download className="w-3.5 h-3.5 text-neutral-950" />
              <span>Instalar</span>
            </button>
          )}

          {/* Alternador de Tema */}
          {onToggleTheme && (
            <button
              type="button"
              id="btn-header-theme-toggle"
              onClick={onToggleTheme}
              className="flex items-center justify-center p-2 rounded-lg bg-[#161b22] hover:bg-[#1f2530] border border-neutral-700/80 hover:border-[#c69c59]/60 text-neutral-300 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
              title={theme === 'light' ? 'Mudar para Modo Dark' : 'Mudar para Modo Claro'}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-[#e5c07b]" />
              ) : (
                <Sun className="w-4 h-4 text-[#e5c07b]" />
              )}
            </button>
          )}

          {/* Botão GitHub Sync / Auto-Deploy */}
          {onOpenGitHubModal && (
            <button
              type="button"
              id="btn-header-github-sync"
              onClick={onOpenGitHubModal}
              className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#161b22] hover:bg-[#1a2333] border border-neutral-700/80 hover:border-emerald-500/80 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Publicar no GitHub (Auto-Deploy no Cloudflare)"
            >
              <FolderGit2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline font-bold">GitHub</span>
            </button>
          )}

          {/* Ajustes */}
          <button
            type="button"
            id="btn-header-settings"
            onClick={onOpenSettingsModal}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg bg-[#161b22] hover:bg-[#1f2530] border border-[#c69c59]/40 hover:border-[#c69c59] text-xs font-semibold text-[#e5c07b] transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Abrir Ajustes da Aplicação"
          >
            <Settings className="w-4 h-4 text-[#c69c59]" />
            <span className="hidden sm:inline text-xs font-bold text-[#e5c07b]">Ajustes</span>
          </button>

          {/* Botão Sair da Conta */}
          {onLogout && (
            <button
              type="button"
              id="btn-header-logout"
              onClick={onLogout}
              className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/60 border border-red-900/60 hover:border-red-500/80 text-xs font-bold text-red-300 hover:text-red-100 transition-all shadow-sm active:scale-95 cursor-pointer"
              title={
                currentSession
                  ? `Sair da conta (${currentSession.nome || currentSession.login})`
                  : 'Sair da conta'
              }
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

