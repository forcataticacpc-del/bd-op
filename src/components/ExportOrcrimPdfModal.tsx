import React, { useState } from 'react';
import { X, FileDown, CheckSquare, Square, ShieldAlert } from 'lucide-react';
import { OrcrimRecord } from '../types';
import { generateOrcrimPdf, OrcrimPdfOptions, DEFAULT_PDF_OPTIONS } from '../utils/orcrimPdfExport';

interface ExportOrcrimPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  orcrim: OrcrimRecord;
}

export const ExportOrcrimPdfModal: React.FC<ExportOrcrimPdfModalProps> = ({
  isOpen,
  onClose,
  orcrim,
}) => {
  const [options, setOptions] = useState<OrcrimPdfOptions>(DEFAULT_PDF_OPTIONS);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const toggleOption = (key: keyof OrcrimPdfOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async () => {
    setIsGenerating(true);
    try {
      await generateOrcrimPdf(orcrim, options);
      onClose();
    } catch (e) {
      console.error('Erro ao gerar PDF da ORCRIM:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const fields: Array<{ key: keyof OrcrimPdfOptions; label: string }> = [
    { key: 'nome', label: 'Nome do Integrante' },
    { key: 'mae', label: 'Nome da Mãe' },
    { key: 'dataNascimento', label: 'Data de Nascimento' },
    { key: 'rg', label: 'RG (Identidade)' },
    { key: 'cpf', label: 'CPF' },
    { key: 'endereco', label: 'Endereço Residencial' },
    { key: 'alcunha', label: 'Alcunha / Vulgo' },
    { key: 'observacoes', label: 'Observações de Inteligência' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md my-auto bg-[#0a0d14] border border-[#c69c59]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800 bg-[#0d111a]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#c69c59]" />
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Exportar Ficha da Facção para PDF
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 text-xs">
          <div>
            <p className="text-neutral-300 font-semibold mb-1">
              Selecione quais dados dos integrantes deverão ser exportados:
            </p>
            <p className="text-[11px] text-neutral-400">
              Você pode ligar ou desligar qualquer campo abaixo de acordo com sua necessidade de inteligência.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#121622] p-3 rounded-xl border border-neutral-800">
            {fields.map(({ key, label }) => {
              const isChecked = options[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOption(key)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all cursor-pointer border ${
                    isChecked
                      ? 'bg-[#182030] border-[#c69c59]/60 text-white'
                      : 'bg-[#0d1118] border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-[#e5c07b] flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-600 flex-shrink-0" />
                  )}
                  <span className="text-[11px] font-bold">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleExport}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-bold shadow-md shadow-[#c69c59]/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <FileDown className="w-4 h-4 text-neutral-950" />
              <span>{isGenerating ? 'Gerando PDF...' : 'Gerar e Baixar PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
