import React, { useState } from 'react';
import { ClipboardPaste, Check, X, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { parseRawSuspectText, ParsedRecordData } from '../utils/textParser';

interface ParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (parsed: ParsedRecordData) => void;
}

export const ParserModal: React.FC<ParserModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState<ParsedRecordData | null>(null);

  if (!isOpen) return null;

  const handleProcess = () => {
    if (!rawText.trim()) return;
    const result = parseRawSuspectText(rawText);
    setPreview(result);
  };

  const handleApply = () => {
    const result = preview || parseRawSuspectText(rawText);
    onApply(result);
    setRawText('');
    setPreview(null);
    onClose();
  };

  const handleInsertExampleWithTags = () => {
    setRawText(`NOME: CARLOS EDUARDO SILVA
ALCUNHA: DUDA
MAE: REGINA APARECIDA SILVA
NASC: 15/08/1996
RG: MG-14.882.102
CPF: 104.823.991-00
END: RUA RIO DE JANEIRO, 340 - CENTRO
ART: 157, 33
OBS: Conhecido na região por envolvimento com roubo de carga.`);
    setPreview(null);
  };

  const handleInsertExampleFreeText = () => {
    setRawText(`RUAN PABLO DOS SANTOS NASCIMENTO 
maria de fatima toledo
05/05/2007
Cpf: 19194864616
RG 23982029
JAIME SALSE, 549.
Trafico art 33
Trafico no madre gertudes, (pista)`);
    setPreview(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#111622] border border-[#c69c59]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#161c2b] border-b border-[#c69c59]/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c69c59]/20 border border-[#c69c59]/50 flex items-center justify-center text-[#e5c07b]">
              <ClipboardPaste className="w-4 h-4 text-[#c69c59]" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Preenchimento Inteligente de Texto
              </h3>
              <span className="text-[10px] text-[#c69c59] block">
                Tags (NOME, MAE, RG, CPF) ou Texto Livre
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-neutral-400">
            <span>Cole o texto bruto da ficha policial recebida via mensagem:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleInsertExampleWithTags}
                className="text-[10px] text-[#e5c07b] hover:underline cursor-pointer"
              >
                Exemplo com tags
              </button>
              <span className="text-neutral-600">•</span>
              <button
                type="button"
                onClick={handleInsertExampleFreeText}
                className="text-[10px] text-[#e5c07b] hover:underline cursor-pointer"
              >
                Exemplo livre
              </button>
            </div>
          </div>

          <textarea
            rows={7}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setPreview(null);
            }}
            placeholder="Cole o texto aqui com ou sem tags. Exemplo:&#10;RUAN PABLO DOS SANTOS NASCIMENTO&#10;maria de fatima toledo&#10;05/05/2007&#10;Cpf: 19194864616&#10;RG 23982029&#10;JAIME SALSE, 549.&#10;Trafico art 33&#10;Trafico no madre gertudes, (pista)"
            className="w-full p-3 rounded-xl bg-[#0c1017] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors resize-none font-mono placeholder:text-neutral-600 leading-relaxed"
            autoFocus
          />

          {/* Visualização dos campos detectados */}
          {preview && (
            <div className="p-3 rounded-xl bg-[#161d2b] border border-neutral-700 space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-[#e5c07b] font-bold text-[11px] uppercase pb-1 border-b border-neutral-700/60">
                <Sparkles className="w-3.5 h-3.5 text-[#c69c59]" />
                <span>Dados Identificados pelo Parser:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div>
                  <span className="text-neutral-400">Nome: </span>
                  <strong className="text-white uppercase">{preview.nome || '(não detectado)'}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">Mãe: </span>
                  <strong className="text-white uppercase">{preview.mae || '(não detectada)'}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">Alcunha: </span>
                  <strong className="text-[#e5c07b]">{preview.alcunha || '-'}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">Nascimento: </span>
                  <strong className="text-white">{preview.dataNasc || '-'}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">RG: </span>
                  <strong className="text-white">{preview.rg || '-'}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">CPF: </span>
                  <strong className="text-white">{preview.cpf || '-'}</strong>
                </div>
                <div className="sm:col-span-2 truncate">
                  <span className="text-neutral-400">Endereço: </span>
                  <strong className="text-white">{preview.enderecos[0] || '-'}</strong>
                </div>
                {preview.artigo && (
                  <div className="sm:col-span-2">
                    <span className="text-neutral-400">Artigos Penais: </span>
                    <strong className="text-[#e5c07b]">{preview.artigo}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-[#141824] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {!preview ? (
              <button
                type="button"
                onClick={handleProcess}
                disabled={!rawText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1d2636] hover:bg-[#253248] text-[#e5c07b] border border-[#c69c59]/50 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#c69c59]" />
                <span>Processar Prévia</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleApply}
              disabled={!rawText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4 text-neutral-950" />
              <span>Distribuir nos Campos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
