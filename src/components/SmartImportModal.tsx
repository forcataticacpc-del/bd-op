import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Upload,
  StickyNote,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  FolderOpen,
  ArrowRight,
  Database,
  ExternalLink,
} from 'lucide-react';
import { SuspectRecord } from '../types';
import { GoogleKeepBrowserModal } from './GoogleKeepBrowserModal';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtractedCandidates: (candidates: any[]) => void;
  onOpenRecordForm?: (prefill: Partial<SuspectRecord>) => void;
}

type ImportTab = 'keep' | 'text' | 'files';

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  onExtractedCandidates,
}) => {
  const [activeTab, setActiveTab] = useState<ImportTab>('keep');
  const [isKeepSubModalOpen, setIsKeepSubModalOpen] = useState(false);

  // Aba de Texto
  const [rawText, setRawText] = useState('');
  const [isProcessingText, setIsProcessingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  // Aba de Arquivos
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Processa texto colado (mensagens do WhatsApp, anotações de viatura, etc.)
  const handleProcessText = async () => {
    if (!rawText.trim()) {
      setTextError('Cole ao menos um texto ou anotação para a IA analisar.');
      return;
    }

    setIsProcessingText(true);
    setTextError(null);

    try {
      const response = await fetch('/api/ai/extract-suspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileContent: rawText.trim(),
          fileName: 'Anotações_Keep_WhatsApp.txt',
        }),
      });

      if (!response.ok) {
        throw new Error(`Falha no servidor (${response.status}).`);
      }

      const result = await response.json();
      if (result.status === 'success') {
        const suspectsList = result.suspects || (result.data ? [result.data] : []);
        if (suspectsList.length === 0) {
          throw new Error('A IA não identificou dados de abordados no texto fornecido.');
        }

        onExtractedCandidates(suspectsList);
        onClose();
      } else {
        throw new Error(result.message || 'Falha ao processar texto com a IA.');
      }
    } catch (err: any) {
      console.error('Erro na extração de texto:', err);
      setTextError(err.message || 'Erro ao processar as anotações pela IA.');
    } finally {
      setIsProcessingText(false);
    }
  };

  // Processa arquivos carregados (JSON, Takeout, imagens ou documentos)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileError(null);

    try {
      const isImage = file.type.startsWith('image/');
      let payload: any = { fileName: file.name };

      if (isImage) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        payload.imageBase64 = base64;
        payload.mimeType = file.type || 'image/jpeg';
      } else {
        const textContent = await file.text();
        payload.fileContent = textContent;
      }

      const response = await fetch('/api/ai/extract-suspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Falha no servidor (${response.status}).`);
      }

      const result = await response.json();
      if (result.status === 'success') {
        const suspectsList = result.suspects || (result.data ? [result.data] : []);
        if (suspectsList.length === 0) {
          throw new Error('Nenhum abordado pôde ser estruturado a partir deste arquivo.');
        }

        onExtractedCandidates(suspectsList);
        onClose();
      } else {
        throw new Error(result.message || 'Falha na leitura do arquivo pela IA.');
      }
    } catch (err: any) {
      console.error('Erro no upload de arquivo:', err);
      setFileError(err.message || 'Erro ao processar o arquivo selecionado.');
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn"
        onClick={onClose}
      >
        <div
          id="smart-import-modal"
          className="relative w-full max-w-2xl my-auto bg-[#10141d] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-[#141824]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <span>Importador Inteligente</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                    IA Ativa
                  </span>
                </h2>
                <span className="text-xs text-neutral-400 block">
                  Migre e converta anotações do Google Keep, textos e arquivos para o Banco de Dados Operacional
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-close-smart-import"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Aviso Obrigatório: Em Fase de Testes */}
          <div className="mx-4 mt-3 mb-1 p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2.5 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="leading-snug">
              <strong className="text-amber-300 font-bold uppercase tracking-wider text-[11px] mr-1.5">
                * Em fase de testes:
              </strong>
              Não garantimos o resultado, pois teremos que fazer vários testes ainda.
            </span>
          </div>

          {/* Abas */}
          <div className="flex items-center border-b border-neutral-800 bg-[#0d1017] px-4 pt-2 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('keep')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all cursor-pointer border-b-2 ${
                activeTab === 'keep'
                  ? 'border-amber-400 text-amber-300 bg-[#151924]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <StickyNote className="w-4 h-4 text-amber-400" />
              <span>Google Keep Integrado</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all cursor-pointer border-b-2 ${
                activeTab === 'text'
                  ? 'border-cyan-400 text-cyan-300 bg-[#151924]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Colar Textos em Massa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all cursor-pointer border-b-2 ${
                activeTab === 'files'
                  ? 'border-emerald-400 text-emerald-300 bg-[#151924]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Arquivos & Imagens</span>
            </button>
          </div>

          {/* Conteúdo das Abas */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* ABA 1: GOOGLE KEEP */}
            {activeTab === 'keep' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <StickyNote className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-amber-200">
                        Navegador & Extrator do Google Keep
                      </h3>
                      <p className="text-neutral-300 text-[11px] mt-1 leading-relaxed">
                        Acesse as notas salvas no Google Keep, visualize os cards com fotos de suspeitos e utilize o botão <strong>&quot;Extrair para Ficha por IA&quot;</strong> para cadastrar no Banco de Dados Operacional automaticamente.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      id="btn-open-keep-browser-inside"
                      onClick={() => setIsKeepSubModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Abrir Navegador do Google Keep</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#141824] border border-neutral-800 space-y-2 text-[11px] text-neutral-300">
                  <strong className="text-white block">💡 Métodos de Importação do Google Keep:</strong>
                  <ul className="list-disc list-inside space-y-1 text-neutral-400">
                    <li><strong className="text-amber-300">Arquivos do Keep (Takeout / HTML / JSON):</strong> Importe a exportação do Google Keep com todas as suas anotações e fotos anexadas de uma só vez.</li>
                    <li><strong className="text-amber-300">Colar Anotações:</strong> Copie o texto de qualquer nota do Keep no celular ou computador e cole diretamente para gerar o card.</li>
                    <li><strong className="text-amber-300">Prints de Cards com Fotos:</strong> Carregue capturas de tela do Keep — a IA recorta a foto do suspeito e preenche os campos automaticamente por OCR.</li>
                    <li><strong className="text-amber-300">Google Workspace:</strong> Usuários com conta corporativa sincronizam suas anotações via API oficial.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ABA 2: COLAR TEXTOS EM MASSA */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Cole abaixo anotações rápidas de viatura, mensagens de WhatsApp, relatórios de serviço ou blocos de notas. A IA identificará cada indivíduo e estruturará os cadastros:
                </p>

                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Exemplo de anotação de viatura:
NOME: JOÃO PEDRO SILVA DOS SANTOS
VULGO: PEDRINHO DA NORTE
RG: 12.345.678-9 SSP/SP
MÃE: MARIA DE LOURDES SILVA
NASC: 14/05/1998
ARTIGOS: 157, 180
ENDEREÇO: RUA DAS FLORES, 120 - JD. PAULISTA
OBS: ABORDADO COM MOTOCICLETA CLONADA, TATUAGEM DE CARPA NO BRAÇO DIREITO.`}
                  rows={8}
                  className="w-full p-3 rounded-xl bg-[#0d1017] border border-neutral-700 focus:border-cyan-400 text-neutral-100 font-mono text-xs leading-relaxed focus:outline-none resize-none"
                />

                {textError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{textError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setRawText('')}
                    className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
                  >
                    Limpar Texto
                  </button>

                  <button
                    type="button"
                    id="btn-process-bulk-text"
                    onClick={handleProcessText}
                    disabled={isProcessingText || !rawText.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessingText ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Estruturando por IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Extrair Abordados por IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ABA 3: ARQUIVOS & IMAGENS */}
            {activeTab === 'files' && (
              <div className="space-y-4">
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Envie fotos de documentos, mandados, fichas ou arquivos exportados do Google Takeout (JSON/HTML/TXT). A IA lerá o conteúdo visual e textual:
                </p>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-neutral-700 hover:border-emerald-500/80 rounded-2xl bg-[#0d1017] hover:bg-[#121622] flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.json,.html,.txt,.csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {isProcessingFile ? (
                    <div className="flex flex-col items-center gap-2 text-emerald-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="font-bold text-xs">Analisando arquivo com Gemini IA...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-white text-xs block">
                        Clique para selecionar ou arraste o arquivo aqui
                      </span>
                      <span className="text-[10px] text-neutral-400 mt-1 block">
                        Fotos de suspeitos (JPG, PNG), Takeout (JSON, HTML) ou relatórios de texto
                      </span>
                    </>
                  )}
                </div>

                {fileError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer com Aviso do Banco */}
          <div className="px-5 py-3 border-t border-neutral-800 bg-[#121622] flex items-center justify-between text-[11px] text-neutral-400">
            <div className="flex items-center gap-1.5 text-cyan-300">
              <Database className="w-3.5 h-3.5" />
              <span>Destino: Banco de Dados Operacional em Nuvem</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal do Google Keep Navegador quando acionado */}
      {isKeepSubModalOpen && (
        <GoogleKeepBrowserModal
          isOpen={isKeepSubModalOpen}
          onClose={() => setIsKeepSubModalOpen(false)}
          onSendPrintToAi={async (file: File) => {
            setIsKeepSubModalOpen(false);
            // Processa o print do card capturado direto na IA
            try {
              const reader = new FileReader();
              reader.onload = async () => {
                const base64 = reader.result as string;
                const response = await fetch('/api/ai/extract-suspect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    imageBase64: base64,
                    mimeType: file.type || 'image/jpeg',
                    fileName: file.name,
                  }),
                });
                if (response.ok) {
                  const result = await response.json();
                  if (result.status === 'success') {
                    const list = result.suspects || (result.data ? [result.data] : []);
                    if (list.length > 0) {
                      onExtractedCandidates(list);
                      onClose();
                    }
                  }
                }
              };
              reader.readAsDataURL(file);
            } catch (err) {
              console.error('Erro ao enviar print do Keep para IA:', err);
            }
          }}
        />
      )}
    </>
  );
};
