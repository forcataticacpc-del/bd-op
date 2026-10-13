import React from 'react';
import { Plus, ScanFace } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
  onOpenFacialScan?: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  onOpenFacialScan,
}) => {
  return (
    <div className="fixed bottom-6 right-5 sm:right-6 z-40 flex flex-col items-end gap-2">
      {/* Botão flutuante pequeno e discreto de Scan Facial IA */}
      {onOpenFacialScan && (
        <button
          type="button"
          id="btn-fab-facial-scan"
          onClick={onOpenFacialScan}
          className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#161d2b]/95 hover:bg-[#1f283d] text-amber-300 font-bold text-xs shadow-lg shadow-black/50 border border-[#c69c59]/50 hover:border-amber-400 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-md"
          title="Scan Facial por IA (Câmera / Foto do Abordado)"
        >
          <ScanFace className="w-4 h-4 text-[#e5c07b] group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-semibold text-neutral-200 group-hover:text-amber-200 tracking-wide">
            Scan Facial
          </span>
        </button>
      )}

      {/* Botão flutuante principal: + Novo Registro */}
      <button
        type="button"
        id="btn-fab-new-record"
        onClick={onClick}
        className="group relative flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-[#c69c59] hover:bg-[#d4af37] active:scale-95 text-neutral-950 font-extrabold text-sm shadow-[0_8px_25px_rgba(198,156,89,0.4)] transition-all duration-200 border border-amber-300/40 cursor-pointer"
        title="Cadastrar Novo Registro de Abordado"
      >
        <Plus className="w-5 h-5 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />
        <span className="tracking-wide">Novo Registro</span>
      </button>
    </div>
  );
};
