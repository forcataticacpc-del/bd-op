import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  KeyRound,
  ShieldAlert,
  X,
  BadgeCheck,
} from 'lucide-react';
import {
  authenticateUser,
  changeUserPassword,
  getCurrentSession,
  saveSession,
  clearSession,
  UserSession,
  AppUser,
} from '../utils/userAuth';

interface AuthFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (session: UserSession) => void;
  defaultMode?: 'login' | 'first_access';
  isStandalone?: boolean;
}

export const AuthFlowModal: React.FC<AuthFlowModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  defaultMode = 'login',
  isStandalone = false,
}) => {
  // Passos do fluxo:
  // 'login' (01 - tela de login)
  // 'change_pwd' (02 - tela de mudança obrigatória no 1º acesso)
  // 'success' (03 - tela de senha alterada com sucesso)
  const [step, setStep] = useState<'login' | 'change_pwd' | 'success'>('login');

  // Login inputs
  const [loginInput, setLoginInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Primeiro acesso / Alteração de senha obrigatória inputs
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);

  // Estados de carregamento e feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsLoading(false);
      setLoginInput('');
      setSenhaInput('');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setStep(defaultMode === 'first_access' ? 'change_pwd' : 'login');
    }
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  // Validação em tempo real dos requisitos da nova senha (Tela 02)
  const isMinLength = novaSenha.length >= 6;
  const isDiffFromLogin =
    currentUser ? novaSenha.trim() !== currentUser.login.trim() : novaSenha.length >= 6;
  const isMatching = novaSenha.length > 0 && novaSenha === confirmarSenha;
  const isFormValid = isMinLength && isDiffFromLogin && isMatching;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loginInput.trim() || !senhaInput.trim()) {
      setErrorMsg('Preencha seu número funcional e a senha de acesso.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authenticateUser(loginInput, senhaInput);
      if (!res.success || !res.user) {
        setErrorMsg(res.message || 'Credenciais inválidas. Tente novamente.');
        setIsLoading(false);
        return;
      }

      setCurrentUser(res.user);

      // Se for primeiro acesso ou se a flag de mudança de senha estiver ativa (Tela 02)
      if (res.mustChangePassword) {
        setSenhaAtual(senhaInput);
        setStep('change_pwd');
        setIsLoading(false);
        return;
      }

      // Senha já alterada anteriormente: salva sessão e entra
      const session = saveSession(res.user, rememberMe);
      onLoginSuccess(session);
      if (!isStandalone) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha na comunicação de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentUser) {
      setErrorMsg('Sessão expirada. Faça login novamente.');
      setStep('login');
      return;
    }

    if (!isMinLength) {
      setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (!isDiffFromLogin) {
      setErrorMsg('A nova senha não pode ser igual ao seu número funcional.');
      return;
    }

    if (!isMatching) {
      setErrorMsg('A confirmação da nova senha não confere.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await changeUserPassword(currentUser.login, novaSenha);
      if (!res.success) {
        setErrorMsg(res.message);
        setIsLoading(false);
        return;
      }

      // Sucesso: passa para a Tela 03 (Tela de Sucesso)
      setStep('success');
    } catch (err: any) {
      setErrorMsg('Erro ao atualizar a senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishAccess = () => {
    if (currentUser) {
      const session = saveSession(currentUser, rememberMe);
      onLoginSuccess(session);
    }
    if (!isStandalone) {
      onClose();
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isStandalone ? 'bg-transparent' : 'bg-black/85 backdrop-blur-md'} animate-fadeIn`}>
      <div
        id="auth-flow-container"
        className={`relative w-full max-w-md bg-[#0e1219] ${isStandalone ? 'border border-[#c69c59]/50 shadow-[0_0_50px_rgba(198,156,89,0.15)]' : 'border border-neutral-800 shadow-2xl'} rounded-3xl overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão de Fechar: Apenas quando não for modo standalone obrigatório */}
        {!isStandalone && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors z-10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ========================================================
            TELA 01: TELA DE LOGIN (01 - tela de login.PNG)
           ======================================================== */}
        {step === 'login' && (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Header com Novo Logo de Banco de Dados */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1b2230] to-[#0f141f] border border-[#c69c59]/50 shadow-lg shadow-[#c69c59]/10 mb-1 overflow-hidden p-2">
                <img
                  src="/banco_de_dados_logo.svg"
                  alt="BANCO DE DADOS"
                  className="w-full h-full object-contain"
                />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                BANCO DE DADOS
              </h2>
              <p className="text-xs text-[#e5c07b] font-semibold tracking-wide uppercase">
                Sistema Operacional de Abordagens
              </p>
              <div className="inline-block px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 font-mono">
                Acesso Restrito • Militares Autorizados
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/80 text-red-200 text-xs flex items-center gap-2.5 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Usuário / Matrícula */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                  Número Funcional / Matrícula
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    <User className="w-4 h-4 text-[#c69c59]" />
                  </div>
                  <input
                    type="text"
                    id="input-login-funcional"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="Ex: 1779958"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors font-mono uppercase"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                    Senha de Acesso
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    <Lock className="w-4 h-4 text-[#c69c59]" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="input-login-senha"
                    value={senhaInput}
                    onChange={(e) => setSenhaInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Lembrar e Primeiro Acesso */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-neutral-400 hover:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-[#141923] border-neutral-700 text-[#c69c59] focus:ring-0"
                  />
                  <span className="text-[11px]">Manter conectado (24h)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('No primeiro acesso, digite sua matrícula no campo de senha para iniciar a ativação.');
                  }}
                  className="text-[11px] text-[#e5c07b] hover:underline cursor-pointer"
                >
                  Primeiro acesso?
                </button>
              </div>

              {/* Atalho para credencial padrão Master */}
              <div className="flex items-center justify-between px-1 text-[11px]">
                <span className="text-neutral-500">Credencial de acesso:</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginInput('1779958');
                    setSenhaInput('1779958');
                    setErrorMsg(null);
                  }}
                  className="text-amber-400 hover:text-amber-300 font-mono underline cursor-pointer"
                >
                  Preencher SD TEIXEIRA (1779958)
                </button>
              </div>

              {/* Botão Entrar */}
              <button
                type="submit"
                id="btn-login-submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] active:scale-[0.98] text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Autenticando...</span>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-neutral-800/80">
              <span className="text-[10px] text-neutral-500">
                Segurança Tática • Criptografia e Registro de Acesso Ativos
              </span>
            </div>
          </div>
        )}

        {/* ========================================================
            TELA 02: PRIMEIRO ACESSO - REDEFINIÇÃO OBRIGATÓRIA DE SENHA
            (02 - TELA DE MUDANÇA DE SENHA DO PRIMEIRO ACESSO OBRIGATÓRIOA.PNG)
           ======================================================== */}
        {step === 'change_pwd' && (
          <div className="p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-400 mb-1">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                Primeiro Acesso Obrigatório
              </h2>
              <p className="text-xs text-neutral-400 leading-snug">
                Por diretriz de segurança, altere sua senha provisória para habilitar seu acesso completo.
              </p>
              {currentUser && (
                <div className="px-3 py-1.5 rounded-lg bg-[#141923] border border-neutral-800 text-[11px] text-[#e5c07b] font-semibold mt-2">
                  Militar: {currentUser.nome} ({currentUser.login})
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/80 text-red-200 text-xs flex items-center gap-2.5 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              {/* Senha Provisória / Atual */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                  Senha Provisória (Matrícula)
                </label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Senha atual"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 text-white text-xs outline-none"
                  required
                />
              </div>

              {/* Nova Senha */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                  Nova Senha de Segurança
                </label>
                <div className="relative">
                  <input
                    type={showNovaSenha ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 dígitos"
                    className="w-full px-3 pr-10 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Nova Senha */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                  Confirmar Nova Senha
                </label>
                <input
                  type={showNovaSenha ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none"
                  required
                />
              </div>

              {/* Requisitos de Segurança com Indicadores Visuais */}
              <div className="p-3 rounded-xl bg-[#121620] border border-neutral-800 space-y-1.5 text-[11px]">
                <div className="text-[10px] font-bold uppercase text-neutral-400">
                  Requisitos Obrigatórios:
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                      isMinLength ? 'bg-emerald-500 text-black font-bold' : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    ✓
                  </div>
                  <span className={isMinLength ? 'text-emerald-300 font-semibold' : 'text-neutral-400'}>
                    Mínimo de 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                      isDiffFromLogin ? 'bg-emerald-500 text-black font-bold' : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    ✓
                  </div>
                  <span className={isDiffFromLogin ? 'text-emerald-300 font-semibold' : 'text-neutral-400'}>
                    Diferente da sua matrícula funcional
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                      isMatching ? 'bg-emerald-500 text-black font-bold' : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    ✓
                  </div>
                  <span className={isMatching ? 'text-emerald-300 font-semibold' : 'text-neutral-400'}>
                    Confirmação idêntica à nova senha
                  </span>
                </div>
              </div>

              {/* Botão Salvar e Ativar */}
              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full py-3.5 px-4 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] active:scale-[0.98] text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Salvando Senha...</span>
                ) : (
                  <>
                    <span>Confirmar Redefinição</span>
                    <BadgeCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================
            TELA 03: SENHA ALTERADA COM SUCESSO!
            (03 - TELA DE SENHA ALTERADA COM SUCESSO.PNG)
           ======================================================== */}
        {step === 'success' && (
          <div className="p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/60 text-emerald-400 shadow-xl shadow-emerald-500/10 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                Senha Alterada com Sucesso!
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed max-w-sm mx-auto">
                Sua credencial de acesso foi redefinida com segurança. Seu dispositivo e login agora estão autorizados para uso operacional.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[#141923] border border-neutral-800 text-xs text-neutral-300 space-y-1 text-left">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-400">Operador:</span>
                <span className="font-bold text-white uppercase">{currentUser?.nome}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-400">Matrícula:</span>
                <span className="font-mono text-[#e5c07b] font-bold">{currentUser?.login}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-400">Status:</span>
                <span className="text-emerald-400 font-bold">ACESSO ATIVADO</span>
              </div>
            </div>

            <button
              type="button"
              id="btn-access-system-success"
              onClick={handleFinishAccess}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <span>Acessar o Sistema Operacional</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
