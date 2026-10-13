import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Share,
  PlusSquare,
  X,
  CheckCircle2,
  ExternalLink,
  Shield,
  Sparkles,
  Apple,
  Check,
  ChevronRight,
  Info,
  Copy,
  QrCode,
  Database,
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DONT_SHOW_INSTALL_KEY = 'ft_dont_show_install_prompt_v1';

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstalled, isIOS, isMobile, canInstallNatively, promptInstall } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // Aba selecionada interativa: 'android' | 'ios' | 'pc'
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'pc'>(() => {
    if (isIOS) return 'ios';
    if (isMobile) return 'android';
    return 'pc';
  });

  // Caixa de diálogo para marcar "Não exibir novamente"
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  const shareUrl = typeof window !== 'undefined' 
    ? (window.location.origin + window.location.pathname) 
    : 'https://ais-pre-p5ilhzfqyq37ue5idwwxnm-166642900629.us-west1.run.app';

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}&margin=1`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setActionFeedback('Link do aplicativo copiado! Cole no WhatsApp ou navegador do celular.');
      setTimeout(() => {
        setCopiedLink(false);
        setActionFeedback(null);
      }, 3500);
    } catch (_) {
      setActionFeedback('Copie o link manualmente: ' + shareUrl);
    }
  };

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(DONT_SHOW_INSTALL_KEY, 'true');
      } catch (e) {
        console.warn('Erro ao salvar preferência de não exibir', e);
      }
    }
    onClose();
  };

  // Função disparada ao clicar em "Celular Android", "iPhone / iOS" ou "Computador / PC"
  const handleSelectPlatform = async (platform: 'android' | 'ios' | 'pc') => {
    setActiveTab(platform);

    if (platform === 'android' || platform === 'pc') {
      if (canInstallNatively) {
        setIsInstalling(true);
        setActionFeedback('Abrindo solicitação de instalação do sistema...');
        const accepted = await promptInstall();
        setIsInstalling(false);
        if (accepted) {
          setInstalledSuccess(true);
          setActionFeedback('Aplicativo instalado com sucesso! Criando atalho...');
          setTimeout(() => {
            handleClose();
          }, 1500);
        } else {
          setActionFeedback('Siga as instruções abaixo para adicionar o atalho manualmente.');
          setTimeout(() => setActionFeedback(null), 4000);
        }
      } else {
        setActionFeedback(
          platform === 'android'
            ? 'Instruções para Celular Android ativadas abaixo.'
            : 'Instruções para Computador (Chrome/Edge) ativadas abaixo.'
        );
        setTimeout(() => setActionFeedback(null), 3000);
      }
    } else if (platform === 'ios') {
      setActionFeedback('No iPhone/iPad (iOS), siga as etapas de 2 toques no Safari mostradas abaixo.');
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const handleNativeInstallDirect = async () => {
    setIsInstalling(true);
    setActionFeedback('Abrindo instalador nativo...');
    const accepted = await promptInstall();
    setIsInstalling(false);
    if (accepted) {
      setInstalledSuccess(true);
      setActionFeedback('Instalação concluída com sucesso!');
      setTimeout(() => {
        handleClose();
      }, 1500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={handleClose}
    >
      <div
        id="pwa-install-dialog"
        className="relative w-full max-w-lg bg-[#0f131c] border border-[#c69c59]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Faixa Tática Superior */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#c69c59] via-[#e5c07b] to-[#c69c59]" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#c69c59]/50 shadow-md flex-shrink-0 bg-neutral-900 p-1 flex items-center justify-center">
              <img
                src="/banco_de_dados_logo.svg"
                alt="Logo BANCO DE DADOS"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Instalar Aplicativo</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  PWA • Multiplataforma
                </span>
              </h3>
              <span className="text-[11px] text-[#c69c59] font-mono block">
                BANCO DE DADOS • Adicionar Atalho
              </span>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-install-modal"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Rápido */}
        {actionFeedback && (
          <div className="px-4 py-2 bg-[#1d2636] border-b border-amber-500/40 text-[#e5c07b] text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{actionFeedback}</span>
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className="p-5 space-y-4 text-left">
          {installedSuccess || isInstalled ? (
            <div className="p-5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold uppercase text-white">Aplicativo Já Instalado!</h4>
              <p className="text-xs text-neutral-300 leading-relaxed">
                O aplicativo BANCO DE DADOS já está pronto e instalado no seu dispositivo, funcionando em modo nativo independente e com atalho direto.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Selecione o seu dispositivo abaixo para <strong className="text-[#e5c07b]">instalar o aplicativo</strong> e criar o atalho com o ícone do BANCO DE DADOS na tela inicial do celular ou na área de trabalho do computador:
                </p>
              </div>

              {/* Botões de Ação por Dispositivo: Celular Android, Celular iPhone (iOS) e Computador (PC) */}
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Celular Android */}
                <button
                  type="button"
                  id="btn-select-android"
                  onClick={() => handleSelectPlatform('android')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'android'
                      ? 'bg-amber-500/15 border-amber-400 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-[#151a26] border-neutral-800 text-neutral-300 hover:bg-[#1a2233] hover:text-white'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider block">
                    Android
                  </span>
                  <span className="text-[9px] text-neutral-400 font-mono">Celular</span>
                </button>

                {/* 2. iPhone / iPad (iOS) */}
                <button
                  type="button"
                  id="btn-select-ios"
                  onClick={() => handleSelectPlatform('ios')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'ios'
                      ? 'bg-amber-500/15 border-amber-400 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-[#151a26] border-neutral-800 text-neutral-300 hover:bg-[#1a2233] hover:text-white'
                  }`}
                >
                  <Apple className="w-5 h-5 text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider block">
                    iOS (iPhone)
                  </span>
                  <span className="text-[9px] text-neutral-400 font-mono">Safari</span>
                </button>

                {/* 3. Computador / PC */}
                <button
                  type="button"
                  id="btn-select-pc"
                  onClick={() => handleSelectPlatform('pc')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'pc'
                      ? 'bg-amber-500/15 border-amber-400 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-[#151a26] border-neutral-800 text-neutral-300 hover:bg-[#1a2233] hover:text-white'
                  }`}
                >
                  <Monitor className="w-5 h-5 text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider block">
                    Computador
                  </span>
                  <span className="text-[9px] text-neutral-400 font-mono">PC / Mac</span>
                </button>
              </div>

              {/* Se o navegador permitir a instalação nativa imediata por botão */}
              {canInstallNatively && (activeTab === 'android' || activeTab === 'pc') && (
                <button
                  type="button"
                  id="btn-prompt-native-install-action"
                  onClick={handleNativeInstallDirect}
                  disabled={isInstalling}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#c69c59] via-[#d4af37] to-[#e5c07b] hover:from-[#d4af37] hover:to-[#ffd700] text-neutral-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-neutral-950" />
                  <span>
                    {activeTab === 'android'
                      ? 'Adicionar Atalho no Celular Android Agora'
                      : 'Instalar Aplicativo na Área de Trabalho do PC'}
                  </span>
                </button>
              )}

              {/* PAINEL DE INSTRUÇÕES ESPECÍFICAS CONFORME A PLATAFORMA CLICADA */}
              <div className="pt-1">
                {activeTab === 'ios' && (
                  /* INSTRUÇÕES ESPECÍFICAS PARA IPHONE / IPAD (IOS) */
                  <div className="p-4 rounded-xl bg-[#151a26] border border-[#c69c59]/40 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Apple className="w-4 h-4 text-amber-400" />
                      <span>Instalação no iPhone e iPad (Apple iOS / Safari):</span>
                    </div>
                    <ol className="text-xs text-neutral-300 space-y-2.5 list-decimal list-inside leading-relaxed">
                      <li>
                        No navegador <strong className="text-white">Safari</strong>, toque no ícone de{' '}
                        <strong className="text-[#e5c07b]">Compartilhar</strong> (quadrado com seta para cima{' '}
                        <Share className="w-3.5 h-3.5 inline text-amber-400" />) na barra inferior da tela.
                      </li>
                      <li>
                        Role as opções que surgirem e toque em{' '}
                        <strong className="text-[#e5c07b]">"Adicionar à Tela de Início"</strong> (ícone{' '}
                        <PlusSquare className="w-3.5 h-3.5 inline text-amber-400" />).
                      </li>
                      <li>
                        Toque em <strong className="text-white">"Adicionar"</strong> no canto superior direito para fixar o ícone do BANCO DE DADOS entre seus aplicativos.
                      </li>
                    </ol>
                    <div className="p-2 rounded-lg bg-black/40 text-[10px] text-neutral-400 font-mono">
                      * O app abrirá em tela inteira sem barras de navegação do Safari, funcionando exatamente como um app nativo da App Store.
                    </div>
                  </div>
                )}

                {activeTab === 'android' && (
                  /* INSTRUÇÕES PARA CELULARES ANDROID */
                  <div className="p-4 rounded-xl bg-[#151a26] border border-[#c69c59]/40 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      <span>Instalação no Celular Android (Chrome / Edge / Samsung):</span>
                    </div>
                    <ol className="text-xs text-neutral-300 space-y-2 list-decimal list-inside leading-relaxed">
                      <li>
                        Se a janela automática não abrir, toque nos <strong className="text-white">três pontos (⋮)</strong> no canto superior do navegador.
                      </li>
                      <li>
                        Selecione a opção <strong className="text-[#e5c07b]">"Instalar aplicativo"</strong> ou{' '}
                        <strong className="text-[#e5c07b]">"Adicionar à tela inicial"</strong>.
                      </li>
                      <li>
                        Confirme clicando em <strong className="text-white">"Instalar"</strong> para colocar o atalho na grade de apps do celular.
                      </li>
                    </ol>
                  </div>
                )}

                {activeTab === 'pc' && (
                  /* INSTRUÇÕES PARA COMPUTADOR (PC / MAC) */
                  <div className="p-4 rounded-xl bg-[#151a26] border border-[#c69c59]/40 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Monitor className="w-4 h-4 text-amber-400" />
                      <span>Instalação no Computador (Windows / Mac / Linux):</span>
                    </div>
                    <ol className="text-xs text-neutral-300 space-y-2 list-decimal list-inside leading-relaxed">
                      <li>
                        No Google Chrome ou Microsoft Edge, clique no ícone de <strong className="text-[#e5c07b]">Instalar Aplicativo</strong>{' '}
                        (ícone de monitor com seta ou computador na barra de endereços).
                      </li>
                      <li>
                        Ou clique no menu <strong className="text-white">três pontos (⋮) → Salvar e Compartilhar → Instalar BANCO DE DADOS</strong>.
                      </li>
                      <li>
                        O atalho será colocado na sua <strong className="text-white">Área de Trabalho</strong> e abrirá em janela própria e veloz.
                      </li>
                    </ol>
                  </div>
                )}
              </div>

              {/* CARD DE CONEXÃO DIRETA COM O CELULAR: QR CODE + COPIAR LINK */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#121622] to-[#182030] border border-[#c69c59]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#e5c07b]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Acesso no Celular (Cloudflare D1 Integrado)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    D1 Sincronizado
                  </span>
                </div>

                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  O banco Cloudflare D1 já está configurado de fábrica: qualquer aparelho que abrir o link abaixo acessará os mesmos registros em tempo real.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#222b3d] hover:bg-[#2c374d] border border-[#c69c59]/50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Link Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#e5c07b]" />
                        <span>Copiar Link do App</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQrCode(!showQrCode)}
                    className="py-2 px-3 rounded-lg bg-[#222b3d] hover:bg-[#2c374d] border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#e5c07b]" />
                    <span>{showQrCode ? 'Ocultar QR' : 'QR Code'}</span>
                  </button>
                </div>

                {showQrCode && (
                  <div className="p-3 rounded-lg bg-black/60 border border-neutral-800 flex flex-col sm:flex-row items-center gap-3 animate-fadeIn">
                    <div className="p-1.5 bg-white rounded-lg shadow-md flex-shrink-0">
                      <img
                        src={qrCodeUrl}
                        alt="QR Code do Aplicativo"
                        className="w-28 h-28 object-contain"
                      />
                    </div>
                    <div className="text-left space-y-1">
                      <p className="text-xs font-bold text-white">Abra a câmera do celular</p>
                      <p className="text-[11px] text-neutral-400 leading-snug">
                        Aponte a câmera para o código ao lado. O navegador abrirá a tela completa com o banco Cloudflare D1 já ativo.
                      </p>
                      <p className="text-[10px] text-[#e5c07b] font-mono break-all pt-1">
                        {shareUrl}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* CAIXA DE DIÁLOGO / CHECKBOX: NÃO EXIBIR A MENSAGEM NOVAMENTE */}
          <div className="pt-2 border-t border-neutral-800/80">
            <label
              htmlFor="chk-dont-show-install"
              className="flex items-center gap-2.5 text-xs text-neutral-300 hover:text-white cursor-pointer select-none"
            >
              <input
                type="checkbox"
                id="chk-dont-show-install"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-amber-400 focus:ring-offset-neutral-900 cursor-pointer accent-[#c69c59]"
              />
              <span>Não exibir esta mensagem de instalação novamente</span>
            </label>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-[#121622] flex items-center justify-between">
          <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#c69c59]" />
            <span>PWA Oficial • BANCO DE DADOS</span>
          </span>

          <button
            type="button"
            id="btn-confirm-close-install"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
