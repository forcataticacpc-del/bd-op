import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallBannerProps {
  onOpenModal: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ onOpenModal }) => {
  const { isInstalled, isMobile, canInstallNatively, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isInstalled || isDismissed) return null;

  const handleQuickInstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canInstallNatively) {
      await promptInstall();
    } else {
      onOpenModal();
    }
  };

  return (
    <aside
      id="pwa-install-banner"
      aria-label="Aviso de instalação do aplicativo"
      className="bg-[#121622] border-b border-[#c69c59]/30 px-3 py-1.5 flex items-center justify-between text-xs text-neutral-300 z-30 transition-all"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Smartphone className="w-3.5 h-3.5 text-[#c69c59] flex-shrink-0" />
        <span className="text-[11px] truncate">
          {isMobile
            ? 'Instale o app BANCO DE DADOS para acesso rápido na tela inicial'
            : 'Instale o aplicativo na Área de Trabalho para acesso rápido'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <button
          type="button"
          id="btn-banner-install-app"
          onClick={handleQuickInstall}
          className="px-2 py-1 rounded bg-[#c69c59]/20 hover:bg-[#c69c59]/30 border border-[#c69c59]/50 text-[#e5c07b] hover:text-white font-mono font-semibold text-[10px] uppercase flex items-center gap-1 transition-all cursor-pointer"
          title="Instalar aplicativo"
        >
          <Download className="w-3 h-3 text-[#c69c59]" />
          <span>Instalar</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
