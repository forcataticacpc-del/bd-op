import React, { useState, useRef } from 'react';
import { X, UserPlus, Camera, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { OrcrimMembro, OrcrimMembroFuncao } from '../types';

interface AddNovoMembroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (membro: OrcrimMembro) => void;
}

export const AddNovoMembroModal: React.FC<AddNovoMembroModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [nome, setNome] = useState('');
  const [alcunha, setAlcunha] = useState('');
  const [funcao, setFuncao] = useState<OrcrimMembroFuncao>('OPERACIONAL_SOLDADO');
  const [funcaoCustom, setFuncaoCustom] = useState('');
  const [rg, setRg] = useState('');
  const [cpf, setCpf] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [foto, setFoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) setFoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const newMembro: OrcrimMembro = {
      id: `membro-manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      suspectId: `manual-${Date.now()}`,
      nome: nome.trim().toUpperCase(),
      alcunha: alcunha.trim() || undefined,
      rg: rg.trim() || undefined,
      cpf: cpf.trim() || undefined,
      foto: foto || undefined,
      funcao,
      funcaoPersonalizada: funcaoCustom.trim() || undefined,
      dataVinculo: new Date().toISOString(),
      observacoes: observacoes.trim() || undefined,
      status: 'ATIVO',
    };

    onSave(newMembro);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg my-auto bg-[#0a0d14] border border-[#c69c59]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800 bg-[#0d111a]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#c69c59]" />
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Adicionar Novo Membro na Facção
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

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-neutral-300 text-[11px]">
            💡 <strong>Aviso Operacional:</strong> Use este cadastro quando sabemos quem é o indivíduo mas ainda não foi abordado. <em>A foto aqui é opcional.</em>
          </div>

          {/* Nome e Alcunha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Nome do Membro <span className="text-[#c69c59]">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: JOAO SILVA PEREIRA"
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white font-bold uppercase focus:border-[#c69c59] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Alcunha / Vulgo
              </label>
              <input
                type="text"
                value={alcunha}
                onChange={(e) => setAlcunha(e.target.value)}
                placeholder="Ex: Baiano, Coroa, Zé"
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-[#e5c07b] font-bold focus:border-[#c69c59] outline-none"
              />
            </div>
          </div>

          {/* Função na Hierarquia (Digitável / Customizável) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Nível Hierárquico Base
              </label>
              <select
                value={funcao}
                onChange={(e: any) => setFuncao(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none"
              >
                <option value="LIDER_GERAL">Nível 1: Líder Geral / Sintonia Geral</option>
                <option value="SUB_LIDER">Nível 1: Sub-Líder / Frente Geral</option>
                <option value="DISCIPLINA">Nível 2: Disciplina / Geral da Quebrada</option>
                <option value="GERENTE_FRENTE">Nível 2: Gerente de Ponto / Boca de Fumo</option>
                <option value="ARMEIRO_LOGISTICA">Nível 2: Armeiro / Logística</option>
                <option value="OPERACIONAL_SOLDADO">Nível 3: Operacional / Soldado</option>
                <option value="CONTATO_APOIO">Nível 3: Contato / Olheiro / Apoio</option>
                <option value="OUTRO">Outro Escalão</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Função Digitada (Condizente com a Realidade)
              </label>
              <input
                type="text"
                value={funcaoCustom}
                onChange={(e) => setFuncaoCustom(e.target.value)}
                placeholder="Ex: Frente da Favela, Piloto, Soldado da Pista..."
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-[#e5c07b] font-bold focus:border-[#c69c59] outline-none"
              />
            </div>
          </div>

          {/* Documentos Opcionais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                RG (Se houver)
              </label>
              <input
                type="text"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                placeholder="Ex: MG-18.421.902"
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                CPF (Se houver)
              </label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white font-mono outline-none"
              />
            </div>
          </div>

          {/* Foto Opcional */}
          <div className="p-3 rounded-xl bg-[#111622] border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-300 uppercase">
                Foto do Membro (Opcional)
              </span>
              {foto && (
                <button
                  type="button"
                  onClick={() => setFoto(null)}
                  className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remover</span>
                </button>
              )}
            </div>

            {foto ? (
              <div className="w-24 h-28 rounded-xl overflow-hidden border border-[#c69c59] mx-auto bg-black">
                <img src={foto} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-[#182030] hover:bg-[#202c44] border border-neutral-700 text-neutral-200 font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#c69c59]" />
                  <span>Selecionar Foto (Se houver)</span>
                </button>
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
              Observações Operacionais
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais..."
              className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#c69c59] hover:bg-[#d8ab62] text-neutral-950 font-bold shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-neutral-950" />
              <span>Adicionar Membro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
