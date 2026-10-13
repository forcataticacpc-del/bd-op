import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Globe,
  UploadCloud,
  Code,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { SuspectRecord } from '../types';
import { getSyncConfig, saveSyncConfig, saveSuspect, getDeletePassword } from '../utils/storage';
import {
  GOOGLE_APPS_SCRIPT_CODE,
  fetchSuspectsFromGoogleSheets,
  sendSuspectToGoogleSheets,
} from '../utils/googleSheetsApi';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suspects: SuspectRecord[];
  onImportRecords?: (imported: SuspectRecord[]) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  suspects,
  onImportRecords,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copiedTsv, setCopiedTsv] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);

  // Security / Creator authentication state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const config = getSyncConfig();
      setWebhookUrl(config.webhookUrl || '');
      setIsUnlocked(false);
      setPasswordInput('');
      setAuthError(null);
      setSyncStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Authenticate creator/editor with standard app password
  const handleAuthenticate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const standardPassword = getDeletePassword();

    if (passwordInput.trim() === standardPassword.trim()) {
      setIsUnlocked(true);
      setAuthError(null);
      setPasswordInput('');
      setSyncStatus('Acesso de editor liberado com sucesso! Agora você pode alterar e sincronizar a planilha.');
      setTimeout(() => setSyncStatus(null), 3500);
    } else {
      setAuthError('Senha incorreta! Acesso restrito exclusivamente ao criador e editor do aplicativo.');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setSyncStatus('Edição do Google Planilhas bloqueada novamente.');
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const handleSaveUrl = () => {
    if (!isUnlocked) {
      setAuthError('Digite a senha padrão do aplicativo para alterar ou salvar a URL da planilha.');
      return;
    }

    saveSyncConfig({
      webhookUrl: webhookUrl.trim(),
      autoSync: true,
      lastSync: new Date().toISOString(),
    });
    setSyncStatus('URL da Planilha salva com sucesso! Sincronização automática ativada.');
    setTimeout(() => setSyncStatus(null), 3000);
  };

  // POST: Enviar todos os dados para o Google Sheets via fetch (requer senha de editor)
  const handlePushAllToSheets = async () => {
    if (!isUnlocked) {
      setAuthError('Digite a senha padrão do aplicativo para enviar dados à planilha Google.');
      return;
    }

    if (!webhookUrl.trim()) {
      setSyncStatus('Por favor, informe a URL do Aplicativo da Web gerada no Google Apps Script.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Enviando dados para o Google Sheets via método POST...');

    try {
      saveSyncConfig({
        webhookUrl: webhookUrl.trim(),
        autoSync: true,
        lastSync: new Date().toISOString(),
      });

      const payload = {
        origem: 'Banco de Dados App',
        timestamp: new Date().toISOString(),
        total: suspects.length,
        abordados: suspects.map((s) => ({
          id: s.id,
          nome: s.nome,
          mae: s.mae,
          dataNasc: s.dataNasc,
          rg: s.rg,
          cpf: s.cpf,
          endereco: s.endereco,
          alcunha: s.alcunha,
          artigo: s.artigo,
          localAbordagem: s.localAbordagem,
          coordenadas: s.localAbordagemCoords
            ? `${s.localAbordagemCoords.lat.toFixed(6)}, ${s.localAbordagemCoords.lng.toFixed(6)}`
            : (s.coordenadas || ''),
          COORDENADAS_GPS: s.localAbordagemCoords
            ? `${s.localAbordagemCoords.lat.toFixed(6)}, ${s.localAbordagemCoords.lng.toFixed(6)}`
            : (s.coordenadas || ''),
          localAbordagemCoords: s.localAbordagemCoords,
          observacoes: s.observacoes,
          fotos: s.fotos || [],
          dataCriacao: s.dataCriacao,
        })),
      };

      let sent = false;
      try {
        const proxyRes = await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, webhookUrl: webhookUrl.trim() }),
        });
        if (proxyRes.ok) {
          sent = true;
        }
      } catch {
        // Fallback to direct fetch
      }

      if (!sent) {
        try {
          await fetch(webhookUrl.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            redirect: 'follow',
          });
        } catch (postErr) {
          // Fallback resiliente com no-cors e redirect: follow
          await fetch(webhookUrl.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            mode: 'no-cors',
            redirect: 'follow',
          });
        }
      }

      setSyncStatus(`Sucesso! ${suspects.length} registros enviados para a planilha Google via POST.`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Falha na requisição';
      setSyncStatus(`Erro ao enviar: ${errMsg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // GET: Puxar dados reais da planilha Google Sheets via fetch (requer senha de editor)
  const handlePullFromSheets = async () => {
    if (!isUnlocked) {
      setAuthError('Digite a senha padrão do aplicativo para puxar dados da planilha Google.');
      return;
    }

    if (!webhookUrl.trim()) {
      setSyncStatus('Por favor, informe a URL do Aplicativo da Web do Google Sheets.');
      return;
    }

    setIsPulling(true);
    setSyncStatus('Puxando dados reais da planilha Google Sheets via GET...');

    try {
      const result = await fetchSuspectsFromGoogleSheets(webhookUrl.trim());
      if (result.success && result.data && result.data.length > 0) {
        if (onImportRecords) {
          onImportRecords(result.data);
        }

        setSyncStatus(`Sucesso! ${result.data.length} registros puxados e integrados ao seu aplicativo.`);
      } else if (result.success && Array.isArray(result.data) && result.data.length === 0) {
        if (onImportRecords) {
          onImportRecords([]);
        }
        setSyncStatus('Planilha Google conectada com sucesso! A planilha está vazia (0 registros).');
      } else {
        setSyncStatus(result.message || 'Nenhum registro encontrado na planilha ou erro ao puxar.');
      }
    } catch (err) {
      setSyncStatus(`Erro ao puxar dados: ${err instanceof Error ? err.message : 'Erro de conexão'}`);
    } finally {
      setIsPulling(false);
    }
  };

  // Diagnóstico em tempo real da conexão com a nuvem e verificação da ponte
  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticsResult(null);

    try {
      const res = await fetch(`/api/diagnostics?url=${encodeURIComponent(webhookUrl.trim())}`);
      const data = await res.json();
      setDiagnosticsResult(data);
    } catch (e: any) {
      setDiagnosticsResult({
        success: false,
        error: e.message || 'Falha ao executar teste diagnóstico',
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  // Copiar TSV para colagem rápida
  const handleCopyTsv = () => {
    const headers = [
      'NOME',
      'MÃE',
      'DATA NASCIMENTO',
      'RG',
      'CPF',
      'ENDEREÇO',
      'ALCUNHA',
      'ARTIGO',
      'LOCAL DA ABORDAGEM',
      'COORDENADAS GPS',
      'OBSERVAÇÕES',
      'TOTAL FOTOS',
      'DATA REGISTRO',
    ];

    const rows = suspects.map((s) => [
      s.nome || '',
      s.mae || '',
      s.dataNasc || '',
      s.rg || '',
      s.cpf || '',
      s.endereco || '',
      s.alcunha || '',
      s.artigo || '',
      s.localAbordagem || '',
      s.localAbordagemCoords
        ? `${s.localAbordagemCoords.lat.toFixed(6)}, ${s.localAbordagemCoords.lng.toFixed(6)}`
        : (s.coordenadas || ''),
      (s.observacoes || '').replace(/\n/g, ' '),
      s.fotos?.length || 0,
      new Date(s.dataCriacao).toLocaleDateString('pt-BR'),
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent);
    setCopiedTsv(true);
    setTimeout(() => setCopiedTsv(false), 2500);
  };

  const handleDownloadCsv = () => {
    const headers = [
      'Nome',
      'Mãe',
      'Data de Nascimento',
      'RG',
      'CPF',
      'Endereço',
      'Alcunha',
      'Artigo',
      'Local Abordagem',
      'Observações',
      'Qtd Fotos',
      'Data Cadastro',
    ];

    const csvRows = suspects.map((s) => [
      `"${(s.nome || '').replace(/"/g, '""')}"`,
      `"${(s.mae || '').replace(/"/g, '""')}"`,
      `"${(s.dataNasc || '').replace(/"/g, '""')}"`,
      `"${(s.rg || '').replace(/"/g, '""')}"`,
      `"${(s.cpf || '').replace(/"/g, '""')}"`,
      `"${(s.endereco || '').replace(/"/g, '""')}"`,
      `"${(s.alcunha || '').replace(/"/g, '""')}"`,
      `"${(s.artigo || '').replace(/"/g, '""')}"`,
      `"${(s.localAbordagem || '').replace(/"/g, '""')}"`,
      `"${(s.observacoes || '').replace(/"/g, '""')}"`,
      s.fotos?.length || 0,
      `"${new Date(s.dataCriacao).toLocaleDateString('pt-BR')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `banco_de_dados_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div
        id="google-sheets-modal"
        className="relative w-full max-w-3xl my-auto bg-[#10141d] border border-[#c69c59]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-[#141a24]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-[#c69c59]" />
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#c69c59]">
                Integração Direta em Nuvem
              </span>
              <h2 className="text-base font-bold text-white uppercase tracking-tight">
                API Google Sheets (doPost & doGet)
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUnlocked ? (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/50 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Editor Liberado</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-600/40 text-amber-300">
                <Lock className="w-3.5 h-3.5" />
                <span>Edição Protegida</span>
              </span>
            )}
            <button
              type="button"
              id="btn-close-sheets-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Security Gate Card */}
          {!isUnlocked ? (
            <div className="p-4 rounded-xl bg-[#181308] border border-[#c69c59]/60 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#e5c07b] font-bold">
                  <KeyRound className="w-4 h-4 text-[#c69c59]" />
                  <span className="uppercase tracking-wider text-xs">
                    Área Restrita: Criador e Editor da Planilha
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-red-950/80 text-red-300 border border-red-800/80 px-2 py-0.5 rounded font-semibold">
                  Senha Obrigatória
                </span>
              </div>

              <p className="text-neutral-300 text-[11px] leading-relaxed">
                Para alterar a URL da planilha, salvar novas configurações ou enviar/sincronizar dados com o Google Planilhas, é necessário informar a <strong>senha padrão do aplicativo</strong> (a mesma senha utilizada para apagar posts).
              </p>

              <form onSubmit={handleAuthenticate} className="space-y-2.5 pt-1">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="input-sheets-auth-password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Digite a senha padrão de autorização..."
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#0b0f15] border border-neutral-700 focus:border-[#c69c59] text-white text-xs outline-none font-mono"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                      title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    id="btn-unlock-sheets"
                    className="px-5 py-2.5 rounded-xl bg-[#c69c59] hover:bg-[#d8ae68] text-neutral-950 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md whitespace-nowrap"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Liberar Edição</span>
                  </button>
                </div>

                {authError && (
                  <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-[11px] flex items-center gap-2 font-medium">
                    <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-600/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Modo Criador/Editor Ativo: Você possui autorização para alterar a integração.</span>
              </div>
              <button
                type="button"
                onClick={handleLock}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-600 text-xs font-medium flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-[#c69c59]" />
                <span>Bloquear Novamente</span>
              </button>
            </div>
          )}

          {/* Section 1: URL Configuration & Live Actions */}
          <div className="p-4 rounded-xl bg-[#161c28] border border-[#c69c59]/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold">
                <Globe className="w-4 h-4 text-[#c69c59]" />
                <span>URL do Aplicativo da Web (Google Apps Script)</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                POST & GET Habilitados
              </span>
            </div>

            <p className="text-neutral-400 text-[11px] leading-relaxed">
              Cole abaixo a URL gerada na implantação da sua planilha. Os novos cadastros serão enviados automaticamente via <strong>fetch (POST)</strong> e você também pode puxar dados da planilha via <strong>fetch (GET)</strong> a qualquer momento.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full">
                <input
                  type="url"
                  id="input-webhook-url"
                  value={webhookUrl}
                  disabled={!isUnlocked}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder={
                    isUnlocked
                      ? 'https://script.google.com/macros/s/.../exec'
                      : 'Desbloqueie acima com a senha para alterar a URL'
                  }
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none font-mono transition-all ${
                    isUnlocked
                      ? 'bg-[#0c1017] border-neutral-700 focus:border-[#c69c59] text-white cursor-text'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 cursor-not-allowed'
                  }`}
                />
                {!isUnlocked && (
                  <Lock className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveUrl}
                disabled={!isUnlocked}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all border active:scale-95 cursor-pointer ${
                  isUnlocked
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-600'
                    : 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed opacity-60'
                }`}
              >
                Salvar URL
              </button>
            </div>

            {/* Action Buttons: Puxar (GET) & Enviar (POST) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                id="btn-pull-from-sheets"
                onClick={handlePullFromSheets}
                disabled={!isUnlocked || isPulling}
                className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                  isUnlocked && !isPulling
                    ? 'bg-[#1c2a3f] hover:bg-[#253754] text-[#93c5fd] border border-[#3b82f6]/40 cursor-pointer'
                    : 'bg-neutral-900/80 text-neutral-500 border border-neutral-800 cursor-not-allowed opacity-60'
                }`}
              >
                {isPulling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Puxando Dados da Planilha...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4 text-sky-400" />
                    <span>Puxar Dados da Planilha (GET)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-push-all-to-sheets"
                onClick={handlePushAllToSheets}
                disabled={!isUnlocked || isSyncing}
                className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                  isUnlocked && !isSyncing
                    ? 'bg-[#2a2212] hover:bg-[#3d3119] text-[#e5c07b] border border-[#c69c59]/50 cursor-pointer'
                    : 'bg-neutral-900/80 text-neutral-500 border border-neutral-800 cursor-not-allowed opacity-60'
                }`}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Enviando Dados...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="w-4 h-4 text-[#e5a93b]" />
                    <span>Enviar Todos os Registros (POST)</span>
                  </>
                )}
              </button>
            </div>

            {/* Diagnóstico em tempo real da ponte */}
            <div className="p-3.5 rounded-xl bg-[#0e131b] border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 text-[#c69c59] ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Diagnóstico de Conexão da Nuvem
                  </span>
                </div>
                <button
                  type="button"
                  id="btn-run-diagnostics"
                  onClick={handleRunDiagnostics}
                  disabled={isRunningDiagnostics}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[#e5c07b] text-xs font-semibold border border-neutral-700 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isRunningDiagnostics ? 'Testando Ponte...' : 'Testar Conexão Agora'}
                </button>
              </div>

              {diagnosticsResult && (
                <div className="p-3 rounded-lg bg-black/60 border border-neutral-800 text-xs space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Status da Ponte:</span>
                    <span className={`font-bold ${diagnosticsResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {diagnosticsResult.success ? '● CONECTADO COM SUCESSO' : '● FALHA NA CONEXÃO'}
                    </span>
                  </div>
                  {diagnosticsResult.httpStatus && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Resposta HTTP:</span>
                      <span className="text-neutral-200 font-mono">{diagnosticsResult.httpStatus} OK ({diagnosticsResult.elapsedMs}ms)</span>
                    </div>
                  )}
                  {diagnosticsResult.responseSummary && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Abordados na Planilha:</span>
                      <span className="text-[#e5c07b] font-bold">
                        {diagnosticsResult.responseSummary.total ?? 0} registros
                      </span>
                    </div>
                  )}
                  {diagnosticsResult.serviceAccountNotice && (
                    <div className="pt-2 mt-2 border-t border-neutral-800/80 text-[11px] text-neutral-300 leading-relaxed">
                      💡 <strong>Esclarecimento técnico:</strong> {diagnosticsResult.serviceAccountNotice}
                    </div>
                  )}
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-200/90 leading-relaxed">
                <strong>Atenção sobre &apos;gserviceaccount&apos;:</strong> O aplicativo conecta à planilha através do <strong>Google Apps Script Web App</strong> da sua conta Google pessoal. Não há necessidade de cadastrar ou compartilhar a planilha com e-mails do tipo <em>@gserviceaccount.com</em>. Assegure-se apenas de que a implantação do Apps Script está com <em>&quot;Quem pode acessar&quot;</em> definido como <strong>&quot;Qualquer pessoa&quot;</strong>.
              </div>
            </div>

            {syncStatus && (
              <div className="p-3 rounded-lg bg-black/60 border border-[#c69c59]/40 text-[#e5c07b] text-[11px] flex items-center gap-2 animate-fadeIn font-medium">
                <div className="w-2 h-2 rounded-full bg-[#e5a93b] animate-pulse flex-shrink-0" />
                <span>{syncStatus}</span>
              </div>
            )}
          </div>

          {/* Section 2: Exact Google Apps Script Code with Copy Button */}
          <div className="p-4 rounded-xl bg-[#141822] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold">
                <Code className="w-4 h-4 text-[#c69c59]" />
                <span>Código Google Apps Script (.gs) para a sua Planilha</span>
              </div>
              <button
                type="button"
                id="btn-copy-apps-script"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 2500);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c69c59] hover:bg-[#d8ae68] text-neutral-950 font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Código Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Código (.gs)</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-neutral-400 text-[11px]">
              Este script contém as funções <strong>doPost(e)</strong> e <strong>doGet(e)</strong> completas com cabeçalho formatado, suporte a atualização por ID e retorno JSON.
            </p>

            <pre className="p-3 rounded-xl bg-black/80 text-[10px] text-neutral-300 font-mono overflow-x-auto max-h-48 border border-neutral-800 select-all leading-relaxed">
              {GOOGLE_APPS_SCRIPT_CODE}
            </pre>

            {/* Step by step guide */}
            <div className="p-3.5 rounded-xl bg-[#0c1017] border border-[#c69c59]/40 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-bold text-[#e5c07b] text-xs uppercase tracking-wide">
                  Passo a Passo (Nuvem 100% Integrada - Fotos no Drive e Senha Oculta ****):
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pb-1">
                <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-300">
                  <strong className="text-[#e5c07b] block mb-0.5">📁 Pasta por Abordado no Drive:</strong>
                  Cria uma pasta individual para cada abordado dentro de <code>BancoOperacional_Fotos</code> com o nome dele e armazena todas as fotos lá dentro.
                </div>
                <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-300">
                  <strong className="text-[#e5c07b] block mb-0.5">🔒 Senha do App na Nuvem:</strong>
                  Aba <code>Seguranca</code> criada na planilha armazenando a senha do app com status visual oculto representado por <code>****</code>.
                </div>
              </div>
              <ol className="list-decimal list-inside text-[11px] text-neutral-300 space-y-2 leading-relaxed font-sans">
                <li>Abra a sua planilha no <strong>Google Drive / Sheets</strong>.</li>
                <li>Clique no menu superior em <strong>Extensões</strong> → <strong>Apps Script</strong>.</li>
                <li>Apague todo o código existente e <strong>Cole o código copiado acima</strong>.</li>
                <li>
                  No topo, na barra de ferramentas onde diz a função a executar, selecione <strong>testarPermissoes</strong> e clique em <strong>Executar</strong> (▶️).
                  <br />
                  <span className="text-[#e5c07b] text-[10px] pl-4 block mt-0.5">
                    ↳ O Google solicitará permissão para acessar a Planilha (criação automática das abas e da aba Seguranca com status ****) e criar a pasta <strong>BancoOperacional_Fotos</strong> no seu Google Drive com pastas por abordado. Clique em Avançado → Acessar (seguro).
                  </span>
                </li>
                <li>Clique no disquete para <strong>Salvar</strong>.</li>
                <li>
                  Clique no botão azul superior <strong>Implantar</strong> → <strong>Gerenciar implantações</strong> (ou Nova Implantação) → clique no ícone de lápis ✏️ → em Versão escolha <strong>Nova versão</strong>.
                </li>
                <li>Em <em>&quot;Quem pode acessar&quot;</em>, certifique-se de que está: <strong>Qualquer pessoa (Anyone)</strong>.</li>
                <li>Clique em <strong>Implantar</strong> e copie a <strong>URL do aplicativo da Web</strong> (termina em <code className="text-[#e5c07b]">/exec</code>).</li>
                <li>Cole a URL no campo acima neste aplicativo e clique em <strong>Salvar URL</strong>! Pronto, todo mundo que acessar pelo link gravará e verá tudo direto na nuvem.</li>
              </ol>
            </div>
          </div>

          {/* Section 3: Alternativas de Exportação Rápida */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#141822] border border-neutral-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">Copiar Linhas (TSV)</span>
                <span className="text-[10px] text-neutral-400">Cole direto com Ctrl+V na planilha</span>
              </div>
              <button
                type="button"
                onClick={handleCopyTsv}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-all cursor-pointer"
              >
                {copiedTsv ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#141822] border border-neutral-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">Baixar Arquivo CSV</span>
                <span className="text-[10px] text-neutral-400">Compatível com Excel e Drive</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-all cursor-pointer"
              >
                Baixar
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-neutral-800 bg-[#141a24]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-md"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
