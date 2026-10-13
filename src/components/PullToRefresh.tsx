import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 65; // pixels para disparar o refresh
const MAX_PULL = 95; // limite máximo de deslocamento visual

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  isRefreshing,
  children,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5 && !isRefreshing) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing) return;

    if (window.scrollY <= 5) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0) {
        // Resistência elástica natural
        const distance = Math.min(MAX_PULL, diff * 0.45);
        setPullDistance(distance);
        setIsPulling(true);
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
      isDraggingRef.current = false;
    }
  };

  const handleTouchEnd = async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  // Reseta a distância quando a sincronização terminar
  useEffect(() => {
    if (!isRefreshing && !isPulling) {
      setPullDistance(0);
    }
  }, [isRefreshing, isPulling]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const readyToTrigger = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full flex-1 flex flex-col"
    >
      {/* Indicador visual de puxar para atualizar (Pull-to-refresh) */}
      <div
        id="pull-to-refresh-indicator"
        style={{
          height: isRefreshing ? `${PULL_THRESHOLD}px` : `${pullDistance}px`,
          opacity: pullDistance > 8 || isRefreshing ? 1 : 0,
          transition: isPulling ? 'none' : 'height 0.25s ease-out, opacity 0.2s ease-out',
        }}
        className="w-full overflow-hidden flex items-center justify-center bg-[#10141d] border-b border-[#c69c59]/20 shadow-inner select-none pointer-events-none"
      >
        <div className="flex items-center gap-2.5 px-4 py-2">
          {isRefreshing ? (
            <div className="w-8 h-8 rounded-full bg-[#1b202e] border border-[#c69c59] flex items-center justify-center text-[#e5c07b]">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                readyToTrigger
                  ? 'bg-[#c69c59] text-black scale-110 shadow-lg shadow-[#c69c59]/30'
                  : 'bg-[#1b202e] text-[#c69c59] border border-[#c69c59]/40'
              }`}
              style={{
                transform: `rotate(${progress * 180}deg)`,
              }}
            >
              <ArrowDown className="w-4 h-4 stroke-[2.5]" />
            </div>
          )}

          <div className="flex flex-col text-left">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                readyToTrigger || isRefreshing ? 'text-[#e5c07b]' : 'text-neutral-300'
              }`}
            >
              {isRefreshing
                ? 'Atualizando App e Banco de Dados...'
                : readyToTrigger
                ? 'Solte para Atualizar Tudo'
                : 'Puxe para Atualizar App e Dados'}
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {isRefreshing
                ? 'Sincronizando nuvem, cache e versão do app'
                : 'Atualiza o aplicativo e recarrega o banco de dados em nuvem'}
            </span>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      {children}
    </div>
  );
};
