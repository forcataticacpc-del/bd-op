import React, { useState } from 'react';
import { ShieldAlert, Lock, X, Eye, EyeOff, KeyRound } from 'lucide-react';
import { SuspectRecord } from '../types';
import { getDeletePassword } from '../utils/storage';

interface DeleteAuthModalProps {
  suspect: SuspectRecord | null;
  onClose: () => void;
  onConfirmDelete: (id: string) => Promise<boolean> | boolean | void;
}

export const MASTER_DELETE_PASSWORD = '1252300';

export const DeleteAuthModal: React.FC<DeleteAuthModalProps> = ({
  suspect,
  onClose,
  onConfirmDelete,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!suspect) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDeleting) return;

    const cleanPass = password.trim();
    if (!cleanPass) {
      setError('Por favor, informe a Senha Master para confirmar a exclusão.');
      return;
    }

    const storedPwd = getDeletePassword();
    const isValid = cleanPass === MASTER_DELETE_PASSWORD || (storedPwd && cleanPass === storedPwd.trim());

    if (!isValid) {
      setError('Senha incorreta. Apenas a Senha Master autoriza a exclusão definitiva.');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const success = await onConfirmDelete(suspect.id);
      if (success === false) {
        setError('A exclusão falhou no banco de dados em nuvem. O registro foi mantido intacto.');
        setIsDeleting(false);
      } else {
        setIsDeleting(false);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Falha na conexão com o banco de dados em nuvem.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div
        id="delete-auth-modal"
        className="relative w-full max-w-md bg-[#12161c] border border-red-800/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-red-950/50 border-b border-red-900/40">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-bold text-red-200 uppercase tracking-wider">
              Autorização de Exclusão
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-neutral-300 leading-relaxed">
              Você está prestes a apagar permanentemente do banco de dados o registro de:
            </p>

            <div className="p-3 rounded-xl bg-[#161b22] border border-neutral-800">
              <span className="block font-bold text-white text-sm uppercase">
                {suspect.nome || 'ABORDADO'}
              </span>
              <span className="text-neutral-400 block text-[11px] mt-0.5">
                RG: {suspect.rg || '-'} • CPF: {suspect.cpf || '-'} • ALCUNHA: {suspect.alcunha || '-'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-200 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span>Senha Master para Autorização:</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a Senha Master"
                  required
                  autoFocus
                  className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-white text-xs focus:outline-none focus:border-red-500 placeholder:text-neutral-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px]">
                <span className="text-neutral-500">
                  Proteção de integridade.
                </span>
                <button
                  type="button"
                  onClick={() => setPassword(MASTER_DELETE_PASSWORD)}
                  className="text-amber-400 hover:text-amber-300 underline font-mono cursor-pointer flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Preencher padrão (1252300)</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/80 text-red-300 text-xs font-medium animate-fadeIn">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold uppercase transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
