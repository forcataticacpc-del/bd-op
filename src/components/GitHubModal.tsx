import React, { useState, useEffect } from 'react';
import {
  X,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Send,
  Key,
  FolderGit2,
  Check,
  Copy,
  Terminal,
  Cloud,
  Zap,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast?: (message: string) => void;
}

const GITHUB_CONFIG_KEY = 'ft_github_sync_config';

export const GitHubModal: React.FC<GitHubModalProps> = ({
  isOpen,
  onClose,
  onToast,
}) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  // Status e execução
  const [repoStatus, setRepoStatus] = useState<{
    initialized: boolean;
    branch?: string;
    commitHash?: string;
    commitMessage?: string;
    commitDate?: string;
    remoteUrl?: string;
  } | null>(null);

  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    repoName?: string;
    isPrivate?: boolean;
  } | null>(null);

  const [pushResult, setPushResult] = useState<{
    success: boolean;
    message: string;
    commitHash?: string;
    logs?: string[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'sync' | 'tutorial'>('sync');

  // Carrega configurações salvas no localStorage
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(GITHUB_CONFIG_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.repoUrl) setRepoUrl(parsed.repoUrl);
          if (parsed.token) setToken(parsed.token);
        }
      } catch (_) {}

      fetchGitStatus();
    }
  }, [isOpen]);

  const fetchGitStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data = await res.json();
        setRepoStatus(data);
        if (data.remoteUrl && !repoUrl) {
          setRepoUrl(data.remoteUrl);
        }
      }
    } catch (err) {
      console.warn('Erro ao verificar status do Git:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const saveConfig = (newRepo = repoUrl, newToken = token) => {
    try {
      localStorage.setItem(
        GITHUB_CONFIG_KEY,
        JSON.stringify({ repoUrl: newRepo.trim(), token: newToken.trim() })
      );
    } catch (_) {}
  };

  const handleTestConnection = async () => {
    if (!repoUrl.trim()) {
      setTestResult({
        success: false,
        message: 'Preencha a URL do repositório no GitHub para testar.',
      });
      return;
    }

    saveConfig();
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/github/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: token.trim(),
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success && onToast) {
        onToast(`Conectado ao repositório ${data.repoName || 'do GitHub'}!`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Falha ao testar conexão com o GitHub.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePushToGitHub = async () => {
    if (!repoUrl.trim()) {
      setPushResult({
        success: false,
        message: 'Preencha a URL do repositório GitHub antes de enviar.',
      });
      return;
    }

    saveConfig();
    setIsPushing(true);
    setPushResult(null);

    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: token.trim(),
          commitMessage: commitMessage.trim() || undefined,
        }),
      });

      const data = await res.json();
      setPushResult(data);

      if (data.success) {
        setCommitMessage('');
        fetchGitStatus();
        if (onToast) {
          onToast('Código enviado para o GitHub com sucesso! O Cloudflare atualizará automaticamente.');
        }
      }
    } catch (err: any) {
      setPushResult({
        success: false,
        message: err.message || 'Erro inesperado ao realizar push para o GitHub.',
      });
    } finally {
      setIsPushing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0f141d] border border-[#c69c59]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header Tático */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#161c28] via-[#1a2233] to-[#161c28] border-b border-[#c69c59]/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 flex items-center justify-center shadow-lg text-white">
              <FolderGit2 className="w-5 h-5 text-[#c69c59]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  Integração GitHub & Deploy Automático
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  CI/CD
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Atualize o aplicativo na nuvem automaticamente a cada alteração
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-neutral-800 bg-[#131824] px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sync'
                ? 'border-[#c69c59] text-[#e5c07b]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publicar no GitHub</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tutorial')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tutorial'
                ? 'border-[#c69c59] text-[#e5c07b]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Como Ligar no Cloudflare (Passo a Passo)</span>
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {activeTab === 'sync' ? (
            <>
              {/* Card de Explicação do Fluxo Automático */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/30 via-[#101b1a] to-emerald-950/30 border border-emerald-500/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs font-black uppercase text-emerald-300 tracking-wider">
                    Como funciona a atualização automática?
                  </span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Quando o Cloudflare Pages está conectado ao seu GitHub, você só precisa clicar no botão <strong>"Enviar para o GitHub Agora"</strong> abaixo. O Cloudflare detecta a alteração e atualiza o site <strong>(bd-op.pages.dev)</strong> sozinho em cerca de 30 segundos — <strong>sem você precisar fazer download de ZIP nem mexer no painel do Cloudflare!</strong>
                </p>
              </div>

              {/* Status do Git Local */}
              <div className="p-3 rounded-xl bg-[#141923] border border-neutral-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[#c69c59]" />
                  <span className="text-neutral-300 font-mono">
                    Branch:{' '}
                    <strong className="text-white font-bold">
                      {repoStatus?.branch || 'main'}
                    </strong>
                  </span>
                  {repoStatus?.commitHash && (
                    <span className="text-[10px] font-mono text-[#e5c07b] bg-[#c69c59]/15 px-1.5 py-0.5 rounded border border-[#c69c59]/30">
                      Commit: {repoStatus.commitHash}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={fetchGitStatus}
                  disabled={isLoadingStatus}
                  className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                  title="Atualizar status"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isLoadingStatus ? 'animate-spin' : ''}`}
                  />
                  <span>Recarregar</span>
                </button>
              </div>

              {/* Formulário de Configuração do GitHub */}
              <div className="space-y-3.5 bg-[#121622] p-4 rounded-xl border border-neutral-800">
                {/* 1. URL do Repositório */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span>URL do Repositório GitHub</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <a
                      href="https://github.com/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#e5c07b] hover:underline flex items-center gap-0.5 font-mono"
                    >
                      <span>Criar Repositório Novo no GitHub</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/seu-usuario/banco-de-dados-op.git"
                    className="w-full px-3 py-2 rounded-lg bg-[#0e121a] border border-neutral-700 text-xs text-white placeholder:text-neutral-500 font-mono focus:border-[#c69c59] outline-none transition-colors"
                  />
                  <span className="text-[10px] text-neutral-500 mt-0.5 block">
                    Exemplo: https://github.com/forcataticacpc/banco-de-dados-op.git
                  </span>
                </div>

                {/* 2. Token de Acesso Pessoal (PAT) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>GitHub Personal Access Token (PAT)</span>
                    </label>
                    <a
                      href="https://github.com/settings/tokens/new?description=Banco+de+Dados+Operacional+Sync&scopes=repo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5 font-mono font-bold"
                      title="Gera um token com a permissão 'repo' já marcada"
                    >
                      <span>🔑 Gerar Token no GitHub (1 Clique)</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full pl-3 pr-20 py-2 rounded-lg bg-[#0e121a] border border-neutral-700 text-xs text-white placeholder:text-neutral-500 font-mono focus:border-[#c69c59] outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-white px-2 py-1 bg-neutral-800 rounded font-mono cursor-pointer"
                    >
                      {showToken ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                    💡 O token permite que o aplicativo envie o código diretamente para o seu GitHub sem pedir login de terminal. Ele é salvo com segurança apenas no seu navegador.
                  </p>
                </div>

                {/* 3. Mensagem de Commit (Opcional) */}
                <div>
                  <label className="text-xs font-bold text-neutral-200 uppercase tracking-wider block mb-1">
                    Mensagem da Atualização (Opcional)
                  </label>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Ex: Atualização do scan facial 5G e otimização de banda"
                    className="w-full px-3 py-2 rounded-lg bg-[#0e121a] border border-neutral-700 text-xs text-white placeholder:text-neutral-500 font-mono focus:border-[#c69c59] outline-none transition-colors"
                  />
                </div>

                {/* Botões de Ação */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || isPushing || !repoUrl.trim()}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-700"
                  >
                    {isTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePushToGitHub}
                    disabled={isPushing || isTesting || !repoUrl.trim()}
                    className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#c69c59] via-[#dfb66d] to-[#c69c59] hover:brightness-110 active:scale-98 disabled:opacity-50 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer"
                  >
                    {isPushing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-neutral-950" />
                        <span>Sincronizando com GitHub...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-neutral-950" />
                        <span>Enviar para o GitHub Agora (Push)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Resultado do Teste */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-600/50 text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <strong className="block font-bold">
                      {testResult.success ? 'Conexão Aprovada!' : 'Falha na Conexão'}
                    </strong>
                    <span>{testResult.message}</span>
                  </div>
                </div>
              )}

              {/* Resultado do Push e Logs */}
              {pushResult && (
                <div
                  className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                    pushResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-600/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {pushResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="block text-sm font-black">
                        {pushResult.success
                          ? '✅ Atualização Enviada com Sucesso para o GitHub!'
                          : 'Erro ao Enviar Atualização'}
                      </strong>
                      <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                        {pushResult.message}
                      </p>
                    </div>
                  </div>

                  {pushResult.logs && pushResult.logs.length > 0 && (
                    <div className="mt-2 p-2.5 rounded-lg bg-black/70 border border-neutral-800 font-mono text-[10px] space-y-1 text-neutral-300">
                      <div className="flex items-center gap-1.5 text-neutral-400 pb-1 border-b border-neutral-800">
                        <Terminal className="w-3 h-3 text-[#c69c59]" />
                        <span>Log de Operação Git:</span>
                      </div>
                      {pushResult.logs.map((log, i) => (
                        <div key={i} className="leading-tight">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {pushResult.success && (
                    <div className="p-2.5 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-200 text-[11px] flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span>
                        O Cloudflare Pages já começou a compilar e publicar a nova versão do seu app automaticamente!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* TAB: TUTORIAL PASSO A PASSO */
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-[#10192a] to-blue-950/40 border border-blue-500/40 space-y-1">
                <h3 className="text-xs font-black uppercase text-blue-300 tracking-wider flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <span>Como Ligar o Cloudflare Pages ao GitHub (Configuração Única)</span>
                </h3>
                <p className="text-[11px] text-neutral-300">
                  Depois de fazer isso uma única vez, você nunca mais precisará abrir o Cloudflare para atualizar as telas!
                </p>
              </div>

              {/* Etapas Ilustradas */}
              <div className="space-y-3">
                {/* Passo 1 */}
                <div className="p-3 rounded-xl bg-[#121622] border border-neutral-800 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#c69c59] text-neutral-950 font-black text-xs flex items-center justify-center">
                      1
                    </span>
                    <strong className="text-white text-xs font-bold uppercase">
                      Crie o repositório no GitHub e envie o código
                    </strong>
                  </div>
                  <p className="text-[11px] text-neutral-400 pl-7 leading-relaxed">
                    Acesse{' '}
                    <a
                      href="https://github.com/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#e5c07b] hover:underline"
                    >
                      github.com/new
                    </a>{' '}
                    e crie um repositório (pode ser Público ou Privado, ex: <code>banco-de-dados-op</code>). Depois, na aba <strong>"Publicar no GitHub"</strong> aqui do app, cole a URL e clique em <strong>"Enviar para o GitHub Agora"</strong>.
                  </p>
                </div>

                {/* Passo 2 */}
                <div className="p-3 rounded-xl bg-[#121622] border border-neutral-800 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#c69c59] text-neutral-950 font-black text-xs flex items-center justify-center">
                      2
                    </span>
                    <strong className="text-white text-xs font-bold uppercase">
                      Abra o Cloudflare Pages e conecte ao GitHub
                    </strong>
                  </div>
                  <p className="text-[11px] text-neutral-400 pl-7 leading-relaxed">
                    No painel do Cloudflare (
                    <a
                      href="https://dash.cloudflare.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#e5c07b] hover:underline"
                    >
                      dash.cloudflare.com
                    </a>
                    ):
                  </p>
                  <ol className="list-decimal pl-12 space-y-1 text-[11px] text-neutral-300 font-mono">
                    <li>Vá em <strong>Workers &amp; Pages</strong></li>
                    <li>Clique em <strong>Create application</strong> &gt; aba <strong>Pages</strong></li>
                    <li>Clique em <strong>Connect to Git</strong></li>
                    <li>Autorize e selecione o seu repositório do GitHub</li>
                  </ol>
                </div>

                {/* Passo 3 */}
                <div className="p-3 rounded-xl bg-[#121622] border border-neutral-800 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#c69c59] text-neutral-950 font-black text-xs flex items-center justify-center">
                      3
                    </span>
                    <strong className="text-white text-xs font-bold uppercase">
                      Configurações de Build no Cloudflare Pages
                    </strong>
                  </div>
                  <div className="pl-7 space-y-1.5 text-[11px] text-neutral-300">
                    <p>Preencha os campos exatamente assim:</p>
                    <div className="p-2.5 rounded-lg bg-black/60 border border-neutral-700/80 font-mono space-y-1 text-[11px]">
                      <div>
                        <span className="text-neutral-500">Framework preset:</span>{' '}
                        <strong className="text-amber-300">Vite</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Build command:</span>{' '}
                        <strong className="text-emerald-400">npm run build:pages</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Build output directory:</span>{' '}
                        <strong className="text-emerald-400">dist</strong>
                      </div>
                    </div>
                    <p className="pt-1">
                      Clique em <strong>Save and Deploy</strong>.
                    </p>
                  </div>
                </div>

                {/* Conclusão */}
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 space-y-1 text-xs">
                  <strong className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Concluído! Automação 100% Ativa</span>
                  </strong>
                  <p className="text-[11px] text-neutral-300">
                    A partir de agora, toda vez que fizer qualquer alteração aqui no AI Studio, você só precisa abrir esta tela e clicar em <strong>"Enviar para o GitHub Agora"</strong>. O Cloudflare receberá o aviso do GitHub e publicará a nova versão do seu app automaticamente em menos de 1 minuto!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-[#141822]">
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <GitBranch className="w-3 h-3 text-[#c69c59]" />
            GitHub CI/CD &bull; Cloudflare Pages Auto-Deploy
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
