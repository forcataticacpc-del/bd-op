import React, { useState } from 'react';
import { X, User, MapPin, FileText, CreditCard, Copy, Check, Edit3, Trash2 } from 'lucide-react';
import { VinculoPessoaRecord } from '../types';

interface VinculoPessoaDetailModalProps {
  vinculo: VinculoPessoaRecord | null;
  onClose: () => void;
  onEdit: (vinculo: VinculoPessoaRecord) => void;
  onDelete: (id: string) => void;
}

export const VinculoPessoaDetailModal: React.FC<VinculoPessoaDetailModalProps> = ({
  vinculo,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!vinculo) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md my-auto bg-[#0d111a] border border-[#c69c59]/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-[#121622]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <User className="w-4 h-4 text-[#c69c59]" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 font-mono block">VÍNCULO DE PESSOA</span>
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white">
                {vinculo.nome}
              </h3>
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
        <div className="p-5 space-y-3.5 text-xs">
          {/* Grau de Parentesco / Relação */}
          <div className="p-3 rounded-2xl bg-[#141822] border border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-400 font-semibold uppercase text-[10px]">Relação / Parentesco:</span>
            <span className="px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-[#f5d799] font-black text-xs uppercase tracking-wider">
              {vinculo.grauParentesco}
            </span>
          </div>

          {/* Documentos RG e CPF */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-[#141822] border border-neutral-800 space-y-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">RG:</span>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white text-xs">{vinculo.rg || 'Não informado'}</span>
                {vinculo.rg && (
                  <button
                    type="button"
                    onClick={() => handleCopy(vinculo.rg!, 'rg')}
                    className="p-1 text-neutral-400 hover:text-[#c69c59] cursor-pointer"
                  >
                    {copiedField === 'rg' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#141822] border border-neutral-800 space-y-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">CPF:</span>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white text-xs">{vinculo.cpf || 'Não informado'}</span>
                {vinculo.cpf && (
                  <button
                    type="button"
                    onClick={() => handleCopy(vinculo.cpf!, 'cpf')}
                    className="p-1 text-neutral-400 hover:text-[#c69c59] cursor-pointer"
                  >
                    {copiedField === 'cpf' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="p-3.5 rounded-xl bg-[#141822] border border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#c69c59]" />
                <span>Endereço Residencial / Ponto de Fuga:</span>
              </span>
              {vinculo.endereco && (
                <button
                  type="button"
                  onClick={() => handleCopy(vinculo.endereco!, 'end')}
                  className="p-1 text-neutral-400 hover:text-[#c69c59] cursor-pointer"
                >
                  {copiedField === 'end' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
            <p className="text-white font-semibold text-xs leading-relaxed">
              {vinculo.endereco || 'Endereço não cadastrado.'}
            </p>
          </div>

          {/* Observações */}
          <div className="p-3.5 rounded-xl bg-[#141822] border border-neutral-800 space-y-1.5">
            <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
              <FileText className="w-3 h-3 text-blue-400" />
              <span>Observações Operacionais:</span>
            </span>
            <p className="text-neutral-200 text-xs leading-relaxed bg-[#0e1219] p-2.5 rounded-lg border border-neutral-800 whitespace-pre-wrap">
              {vinculo.observacoes || 'Sem observações adicionais registradas.'}
            </p>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => onDelete(vinculo.id)}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(vinculo)}
                className="px-4 py-2 rounded-xl bg-[#182030] hover:bg-[#202c44] text-[#e5c07b] border border-[#c69c59]/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
