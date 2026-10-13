import React, { useState, useEffect } from 'react';
import { X, UserPlus, User, FileText, MapPin, Check, Trash2, Edit } from 'lucide-react';
import { VinculoPessoaRecord } from '../types';

interface VinculoPessoaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: VinculoPessoaRecord) => void;
  onDelete?: (id: string) => void;
  initialData?: VinculoPessoaRecord | null;
}

const SUGESTOES_PARENTESCO = [
  'Mãe',
  'Pai',
  'Irmão',
  'Irmã',
  'Primo',
  'Tio',
  'Tia',
  'Esposa / Companheira',
  'Namorada',
  'Filho / Filha',
  'Comparsa',
  'Amigo Próximo',
];

export const VinculoPessoaModal: React.FC<VinculoPessoaModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}) => {
  const [nome, setNome] = useState('');
  const [grauParentesco, setGrauParentesco] = useState('');
  const [rg, setRg] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setNome(initialData.nome || '');
        setGrauParentesco(initialData.grauParentesco || '');
        setRg(initialData.rg || '');
        setCpf(initialData.cpf || '');
        setEndereco(initialData.endereco || '');
        setObservacoes(initialData.observacoes || '');
      } else {
        setNome('');
        setGrauParentesco('Mãe');
        setRg('');
        setCpf('');
        setEndereco('');
        setObservacoes('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !grauParentesco.trim()) {
      setErrorMsg('Preencha o nome e o grau de parentesco / relação.');
      return;
    }
    setErrorMsg('');

    const record: VinculoPessoaRecord = {
      id: initialData?.id || `vinculo-p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      nome: nome.trim().toUpperCase(),
      grauParentesco: grauParentesco.trim(),
      rg: rg.trim() || undefined,
      cpf: cpf.trim() || undefined,
      endereco: endereco.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      dataCriacao: initialData?.dataCriacao || new Date().toISOString(),
    };

    onSave(record);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg my-auto bg-[#0d111a] border border-[#c69c59]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-[#121622]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c69c59]/15 border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b]">
              <UserPlus className="w-4 h-4 text-[#c69c59]" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {initialData ? 'Editar Vínculo de Pessoa' : 'Adicionar Vínculo de Pessoa'}
              </h3>
              <span className="text-[10px] text-neutral-400 block">
                Parentesco, comparsas e pontos estratégicos para busca em fuga
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Nome Completo / Conhecido */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
              Nome da Pessoa / Conhecido <span className="text-[#c69c59]">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: MARIA DE FÁTIMA DOS SANTOS"
              className="w-full px-3 py-2.5 rounded-xl bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase font-bold"
              required
            />
          </div>

          {/* Grau de Parentesco / Relação (Digitável) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
              Grau de Parentesco / Vínculo (Digitável) <span className="text-[#c69c59]">*</span>
            </label>
            <input
              type="text"
              value={grauParentesco}
              onChange={(e) => setGrauParentesco(e.target.value)}
              placeholder="Ex: Mãe, Irmão, Primo, Tio, Esposa, Comparsa..."
              className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-[#e5c07b] text-xs outline-none font-bold mb-1.5"
              required
            />

            {/* Sugestões rápidas em chips clicáveis */}
            <div className="flex flex-wrap gap-1 pt-1">
              {SUGESTOES_PARENTESCO.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => setGrauParentesco(sugestao)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer border ${
                    grauParentesco.toLowerCase() === sugestao.toLowerCase()
                      ? 'bg-[#c69c59] text-neutral-950 border-[#c69c59]'
                      : 'bg-[#10141d] text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>

          {/* RG e CPF se houver */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
                RG (Identidade) <span className="text-neutral-500 text-[10px]">(se houver)</span>
              </label>
              <input
                type="text"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                placeholder="Ex: MG-19.452.890"
                className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
                CPF <span className="text-neutral-500 text-[10px]">(se houver)</span>
              </label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none font-mono"
              />
            </div>
          </div>

          {/* Endereço (Texto puro sem Google Maps) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
              Endereço Residencial / Ponto de Fuga
            </label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro, cidade, referências..."
              className="w-full px-3 py-2.5 rounded-xl bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase"
            />
            <span className="text-[10px] text-neutral-500 mt-1 block">
              Endereço de campo preenchido diretamente pela inteligência sem mapas.
            </span>
          </div>

          {/* Observações Regulável */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
              Observações (Campo Regulável para Leitura)
            </label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Descreva detalhes do vínculo, histórico de fuga, veículos usados, apelidos..."
              className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors resize-y min-h-[90px]"
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-neutral-800">
            <div>
              {initialData && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Deseja realmente excluir este vínculo de pessoa?')) {
                      onDelete(initialData.id);
                      onClose();
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Vínculo</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-black text-xs uppercase tracking-wider shadow-md shadow-[#c69c59]/20 transition-all cursor-pointer"
              >
                {initialData ? 'Atualizar Vínculo' : 'Salvar Vínculo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
