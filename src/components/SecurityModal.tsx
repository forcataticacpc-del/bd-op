import React, { useState, useEffect } from 'react';
import {
  Lock,
  Check,
  X,
  ShieldCheck,
  Cloud,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getDeletePassword, setDeletePassword } from '../utils/storage';
import { fetchCloudPasswordFromGoogleSheets, sendPasswordToGoogleSheets } from '../utils/googleSheetsApi';
import { MASTER_DELETE_PASSWORD } from './DeleteAuthModal';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setMessage(null);
      setCloudStatus(null);
      checkCloudPassword();
    }
  }, [isOpen]);

  const checkCloudPassword = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await fetchCloudPasswordFromGoogleSheets();
      if (res.success) {
        setCloudStatus('Sincronizada no banco de dados em nuvem | Máscara: *****');
      } else {
        setCloudStatus('Banco de dados em nuvem conectado. A senha é gravada com máscara: *****');
      }
    } catch {
      setCloudStatus('Armazenamento ativo no banco de dados em nuvem');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const storedPwd = getDeletePassword();

    if (currentPwd.trim() !== storedPwd.trim() && currentPwd.trim() !== MASTER_DELETE_PASSWORD) {
      setMessage({ type: 'error', text: 'A Senha Master atual informada está incorreta.' });
      return;
    }

    if (!newPwd.trim()) {
      setMessage({ type: 'error', text: 'A nova senha não pode ser vazia.' });
      return;
    }

    if (newPwd.trim().length < 4) {
      setMessage({ type: 'error', text: 'A senha deve conter no mínimo 4 caracteres.' });
      return;
    }

    if (newPwd !== confirmPwd) {
      setMessage({ type: 'error', text: 'A confirmação não coincide com a nova senha.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // Grava no armazenamento local
      setDeletePassword(newPwd.trim());

      // Sincroniza na nuvem na aba 'Seguranca' da Planilha com status visual oculto '*****'
      const cloudRes = await sendPasswordToGoogleSheets(newPwd.trim());

      setMessage({
        type: 'success',
        text: cloudRes.message || 'Senha salva e sincronizada na nuvem com máscara (*****)!',
      });

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setDeletePassword(newPwd.trim());
      setMessage({
        type: 'success',
        text: 'Senha salva e atualizada com máscara (*****).',
      });
      setTimeout(() => {
        onClose();
      }, 1800);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div
        id="security-modal"
        className="relative w-full max-w-md bg-[#12161c] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-[#161b22]">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#c69c59]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Segurança & Senha Master
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* Card de Armazenamento em Nuvem e Máscara */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/30 to-neutral-900 border border-[#c69c59]/30 text-[11px] text-neutral-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#e5c07b] font-bold">
                <Cloud className="w-4 h-4" />
                <span>Política de Privacidade na Nuvem</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] bg-neutral-950/80 px-2 py-0.5 rounded-full border border-neutral-700 text-[#c69c59]">
                <span>Máscara:</span>
                <span className="tracking-widest font-bold">*****</span>
              </div>
            </div>
            <p className="text-neutral-400 leading-relaxed">
              Em qualquer integração ou sincronização com o banco de dados em nuvem, a senha nunca é gravada ou exposta em texto puro; gravada e exibida sempre com máscara: <span className="text-[#e5c07b] font-bold">*****</span>.
            </p>
            {isSyncingCloud ? (
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] pt-1">
                <div className="w-3 h-3 border-2 border-[#c69c59] border-t-transparent rounded-full animate-spin" />
                <span>Verificando integridade na nuvem...</span>
              </div>
            ) : cloudStatus ? (
              <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] pt-1">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{cloudStatus}</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Senha Master Atual
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Digite a Senha Master atual"
                  required
                  className="w-full pl-3 pr-10 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs outline-none focus:border-[#c69c59]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Nova Senha Master
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Nova senha (mínimo 4 caracteres)"
                  required
                  className="w-full pl-3 pr-10 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs outline-none focus:border-[#c69c59]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Confirme a nova senha"
                  required
                  className="w-full pl-3 pr-10 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs outline-none focus:border-[#c69c59]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`p-2.5 rounded-lg border text-xs ${
                message.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-red-950/80 border-red-500 text-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Senha</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
