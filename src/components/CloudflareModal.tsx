import React, { useState, useEffect } from 'react';
import {
  Cloud,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Zap,
  UploadCloud,
  Server,
  Database,
  Check,
  RefreshCw,
  ExternalLink,
  Download,
  FolderGit2,
} from 'lucide-react';
import {
  getCloudflareConfig,
  saveCloudflareConfig,
  testCloudflareConnection,
  syncAllToCloudflare,
  BackendProvider,
  getActiveBackendProvider,
  setActiveBackendProvider,
} from '../utils/cloudflareApi';
import { SuspectRecord } from '../types';

interface CloudflareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSuspects: SuspectRecord[];
  onRefreshData: () => Promise<void> | void;
  onOpenGitHubModal?: () => void;
}

export const CloudflareModal: React.FC<CloudflareModalProps> = ({
  isOpen,
  onClose,
  currentSuspects,
  onRefreshData,
  onOpenGitHubModal,
}) => {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [activeProvider, setActiveProvider] = useState<BackendProvider>('cloudflare');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    message: string;
    data?: any;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [isDownloadingPages, setIsDownloadingPages] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getCloudflareConfig();
      setUrl(cfg.url);
      setApiKey(cfg.apiKey);
      setActiveProvider(getActiveBackendProvider());
      setTestResult(null);
      setSyncResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    saveCloudflareConfig({
      url: url.trim(),
      apiKey: apiKey.trim(),
      enabled: activeProvider === 'cloudflare',
    });

    setTesting(true);
    setTestResult(null);
    const result = await testCloudflareConnection(url.trim());
    setTesting(false);
    setTestResult(result);
  };

  const handleToggleProvider = (provider: BackendProvider) => {
    setActiveProvider(provider);
    setActiveBackendProvider(provider);
    saveCloudflareConfig({
      url: url.trim(),
      apiKey: apiKey.trim(),
      enabled: provider === 'cloudflare',
    });
  };

  const handleSyncAll = async () => {
    if (!url.trim()) {
      setSyncResult('⚠️ Preencha a URL do Cloudflare Worker antes de sincronizar.');
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    const res = await syncAllToCloudflare(currentSuspects);
    setSyncing(false);
    if (res.success) {
      setSyncResult(`✅ Sucesso: ${res.message || 'Todos os registros foram migrados para o Cloudflare D1!'}`);
      onRefreshData();
    } else {
      setSyncResult(`❌ Erro: ${res.message}`);
    }
  };

  const handleCopyWorkerCode = async () => {
    try {
      const res = await fetch('/cloudflare-worker/src/index.ts');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedIndex(true);
      setTimeout(() => setCopiedIndex(false), 2500);
    } catch {
      setCopiedIndex(true);
      setTimeout(() => setCopiedIndex(false), 2500);
    }
  };

  const handleCopySchema = async () => {
    try {
      const res = await fetch('/cloudflare-worker/schema.sql');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2500);
    } catch {
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2500);
    }
  };

  const handleDownloadPagesZip = async () => {
    setIsDownloadingPages(true);
    try {
      const res = await fetch('/api/download-pages-zip-base64');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const binaryString = window.atob(json.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/zip' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'cloudflare-pages-dist.zip';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          return;
        }
      }
      const binRes = await fetch('/api/download-pages-zip');
      const blob = await binRes.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cloudflare-pages-dist.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao baixar Pages zip:', e);
    } finally {
      setIsDownloadingPages(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl my-auto bg-[#10141d] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-[#141822]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                Comunicação com Cloudflare
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                  Opção A: D1 + R2
                </span>
              </h2>
              <span className="text-[10px] text-neutral-400 block">
                API REST de Baixa Latência e Alta Disponibilidade na Nuvem
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs text-neutral-300">
          {/* Seletor de Provedor Ativo */}
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c69c59] mb-2">
              Provedor de Dados Ativo:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleToggleProvider('cloudflare')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border font-bold text-xs transition-all cursor-pointer ${
                  activeProvider === 'cloudflare'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md'
                    : 'bg-[#141822] border-neutral-700/70 text-neutral-400 hover:text-white hover:border-neutral-600'
                }`}
              >
                <Cloud className="w-4 h-4" />
                <span>Cloudflare (D1/R2)</span>
                {activeProvider === 'cloudflare' && <Check className="w-3.5 h-3.5 ml-1" />}
              </button>

              <button
                type="button"
                onClick={() => handleToggleProvider('google_sheets')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border font-bold text-xs transition-all cursor-pointer ${
                  activeProvider === 'google_sheets'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md'
                    : 'bg-[#141822] border-neutral-700/70 text-neutral-400 hover:text-white hover:border-neutral-600'
                }`}
              >
                <Server className="w-4 h-4" />
                <span>Google Sheets</span>
                {activeProvider === 'google_sheets' && <Check className="w-3.5 h-3.5 ml-1" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
              Você pode alternar entre Cloudflare e Google Sheets a qualquer momento.
            </p>
          </div>

          {/* Configurações da API Cloudflare */}
          <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1">
                URL do Cloudflare Worker:
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://banco-de-dados-api.seu-subdominio.workers.dev"
                className="w-full px-3 py-2 bg-[#141822] border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-neutral-400 block mt-1">
                Exemplo: https://banco-de-dados-api.meu-usuario.workers.dev
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white mb-1">
                Chave de Autenticação / Token Secreto (Opcional):
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Token de segurança do Worker"
                className="w-full px-3 py-2 bg-[#141822] border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveAndTest}
                disabled={testing}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testando Conexão...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Salvar e Testar Conexão</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncing || currentSuspects.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#1c2230] hover:bg-[#252d3d] border border-neutral-700 text-neutral-200 font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                title="Migrar dados atuais para o Cloudflare D1"
              >
                <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                <span>{syncing ? 'Enviando...' : `Migrar (${currentSuspects.length})`}</span>
              </button>
            </div>

            {/* Test Result Box */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/50 text-red-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{testResult.message}</span>
                    {testResult.latencyMs > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
                        {testResult.latencyMs} ms
                      </span>
                    )}
                  </div>
                  {testResult.data && (
                    <div className="mt-2 text-[11px] text-neutral-300 space-y-1 bg-black/30 p-2.5 rounded-lg border border-emerald-500/20">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Banco D1: {testResult.data.database || 'Conectado'}</span>
                      </div>
                      <div className="text-neutral-200">
                        Total de abordados no D1: <strong className="text-amber-300 font-mono">{testResult.data.totalSuspects ?? 0} registros</strong>
                      </div>
                      <div className="text-neutral-300 text-[10px]">
                        Fotos: <span className="text-emerald-400 font-medium">Base64 Direto no D1</span> (Totalmente funcional, sem depender de R2 externo)
                      </div>
                    </div>
                  )}
                  {testResult.success && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await onRefreshData();
                          setSyncResult('✅ Dados sincronizados do Cloudflare D1 para a tela com sucesso!');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Carregar estes registros na tela agora</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {syncResult && (
              <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/40 text-blue-200 text-xs">
                {syncResult}
              </div>
            )}
          </div>

          {/* Seção de Códigos Prontos para Copiar */}
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#c69c59]">
              Códigos Prontos do Cloudflare (Opção A)
            </h3>
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Se você está configurando o Cloudflare Worker agora, copie os códigos gerados prontos:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyWorkerCode}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-[#141822] hover:bg-[#1a202c] border border-neutral-700/80 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                {copiedIndex ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copiar Worker (src/index.ts)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopySchema}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-[#141822] hover:bg-[#1a202c] border border-neutral-700/80 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                {copiedSchema ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copiar Schema SQL (D1)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* NOVO: Link Direto com GitHub para Atualização 100% Automática */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-[#101b1a] to-emerald-950/40 border border-emerald-500/50 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Atualização Automática sem Baixar ZIP (Recomendado)
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                AUTO-DEPLOY
              </span>
            </div>

            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Vincule o aplicativo ao <strong>GitHub</strong>! Toda vez que fizer atualizações aqui, você clica em <em>Publicar</em> e o <strong>Cloudflare Pages compila e atualiza o site sozinho em ~30 segundos</strong>, sem precisar baixar zip nem mexer no painel toda hora.
            </p>

            <button
              type="button"
              onClick={() => {
                if (onOpenGitHubModal) {
                  onClose();
                  onOpenGitHubModal();
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow active:scale-95"
            >
              <FolderGit2 className="w-4 h-4" />
              <span>Configurar Atualização Automática com o GitHub</span>
            </button>
          </div>

          {/* Seção Nova: Publicar Telas no Cloudflare Pages (bd-op.pages.dev) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-[#10192a] to-blue-950/40 border border-blue-500/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-300">
                  Publicar Telas no Cloudflare Pages (bd-op.pages.dev)
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                PASSO FINAL
              </span>
            </div>

            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Para concluir a tela <strong>"Upload your project assets"</strong> no Cloudflare: baixe o pacote abaixo, descompacte o arquivo ZIP no computador e arraste a pasta (ou clique em <em>folder</em>) para o retângulo tracejado do Cloudflare!
            </p>

            <button
              type="button"
              onClick={handleDownloadPagesZip}
              disabled={isDownloadingPages}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer shadow active:scale-95 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>
                {isDownloadingPages
                  ? 'Preparando e baixando pacote...'
                  : 'Baixar Pacote do Cloudflare Pages (dist - 3.94 MB)'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-[#141822]">
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Cloud className="w-3 h-3 text-amber-400" />
            Cloudflare D1 SQL + R2 Storage
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
