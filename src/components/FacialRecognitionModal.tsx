import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Camera,
  Upload,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ScanLine,
  UserCheck,
  Eye,
  FileText,
  Copy,
  Check,
  Sparkles,
  Search,
  Filter,
  SwitchCamera,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  ShieldCheck,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { SuspectRecord } from '../types';
import { extractSuspectPhotos, formatPhotoUrl } from '../utils/googleSheetsApi';
import {
  compareFacesWithAI,
  scanAllDatabaseProgressive,
  compressImageForBiometrics,
  FacialMatchResult,
  CompatibilidadeNivel,
} from '../utils/facialAiApi';

interface FacialRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allSuspects: SuspectRecord[];
  onSelectSuspectForDetail?: (suspect: SuspectRecord) => void;
  onStartAbordagemWithSuspect?: (suspect: SuspectRecord) => void;
  initialSuspect?: SuspectRecord | null; // Caso venha de um 1:1 direto
}

export const FacialRecognitionModal: React.FC<FacialRecognitionModalProps> = ({
  isOpen,
  onClose,
  allSuspects,
  onSelectSuspectForDetail,
  onStartAbordagemWithSuspect,
  initialSuspect = null,
}) => {
  // Estado da foto capturada
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<'camera' | 'upload' | null>(null);

  // Câmera ao vivo
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Modo de comparação: 'all' (varredura banco completo) | 'batch' (lote tático 10) | 'single' (1:1 específico)
  const [comparisonMode, setComparisonMode] = useState<'all' | 'batch' | 'single'>(
    initialSuspect ? 'single' : 'all'
  );
  const [selectedSingleSuspectId, setSelectedSingleSuspectId] = useState<string>(
    initialSuspect?.id || ''
  );
  const [searchTermSingle, setSearchTermSingle] = useState('');
  const [isChangingSuspect, setIsChangingSuspect] = useState(false);

  // Processamento e resultados
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<string | null>(null);
  const [results, setResults] = useState<FacialMatchResult[] | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Controle de cancelamento e progresso da varredura progressiva 5G
  const abortControllerRef = useRef<AbortController | null>(null);
  const [scanProgress, setScanProgress] = useState<{
    processedCount: number;
    totalCount: number;
    currentBatch: number;
    totalBatches: number;
    percent: number;
  } | null>(null);

  // Paginação e escopo em lote para varredura do banco (otimizado para rede 5G)
  const [batchOffset, setBatchOffset] = useState<number>(0);
  const [filterMarcador, setFilterMarcador] = useState<string>('TODOS');
  const BATCH_SIZE = 10;

  // Termo aceito / visualizado
  const [hasAcknowledgedDisclaimer, setHasAcknowledgedDisclaimer] = useState(false);

  // Filtra suspeitos que possuem fotos válidas
  const suspectsWithPhotos = useMemo(() => {
    return allSuspects.filter((s) => {
      const photos = extractSuspectPhotos(s);
      return photos.length > 0;
    });
  }, [allSuspects]);

  // Filtra por marcador operacional se selecionado (ex: focar em Alvos Prioritários ou Foragidos primeiro)
  const scopedSuspectsWithPhotos = useMemo(() => {
    if (filterMarcador === 'TODOS') return suspectsWithPhotos;
    return suspectsWithPhotos.filter(
      (s) => (s.marcador || '').toUpperCase() === filterMarcador
    );
  }, [suspectsWithPhotos, filterMarcador]);

  // Lote de candidatos a confrontar (10 por lote para resposta rápida em viatura 5G/4G)
  const currentBatchCandidates = useMemo(() => {
    return scopedSuspectsWithPhotos.slice(batchOffset, batchOffset + BATCH_SIZE);
  }, [scopedSuspectsWithPhotos, batchOffset]);

  const totalBatches = Math.max(1, Math.ceil(scopedSuspectsWithPhotos.length / BATCH_SIZE));
  const currentBatchNum = Math.floor(batchOffset / BATCH_SIZE) + 1;

  // Lista de suspeitos para o dropdown de comparação 1:1
  const filteredSingleCandidates = useMemo(() => {
    if (!searchTermSingle.trim()) return suspectsWithPhotos.slice(0, 30);
    const term = searchTermSingle.toLowerCase();
    return suspectsWithPhotos
      .filter(
        (s) =>
          (s.nome && s.nome.toLowerCase().includes(term)) ||
          (s.alcunha && s.alcunha.toLowerCase().includes(term)) ||
          (s.rg && s.rg.toLowerCase().includes(term))
      )
      .slice(0, 30);
  }, [suspectsWithPhotos, searchTermSingle]);

  // Suspeito selecionado no modo 1:1
  const selectedSingleSuspect = useMemo(() => {
    return allSuspects.find((s) => s.id === selectedSingleSuspectId) || null;
  }, [allSuspects, selectedSingleSuspectId]);

  // Se o modo for 1:1 e nenhum suspeito estiver selecionado, seleciona o primeiro com foto
  useEffect(() => {
    if (comparisonMode === 'single' && !selectedSingleSuspectId && suspectsWithPhotos.length > 0) {
      setSelectedSingleSuspectId(suspectsWithPhotos[0].id);
    }
  }, [comparisonMode, selectedSingleSuspectId, suspectsWithPhotos]);

  // Reset de paginação ao trocar o filtro de marcador
  useEffect(() => {
    setBatchOffset(0);
    setResults(null);
  }, [filterMarcador]);

  // Melhor resultado da análise
  const topMatch = useMemo(() => {
    if (!results || results.length === 0) return null;
    return results[0];
  }, [results]);

  // Inicialização quando o modal abre
  useEffect(() => {
    if (isOpen) {
      if (initialSuspect) {
        setComparisonMode('single');
        setSelectedSingleSuspectId(initialSuspect.id);
      }
      setHasAcknowledgedDisclaimer(true);
    } else {
      stopCamera();
      setCapturedPhoto(null);
      setResults(null);
      setAnalysisError(null);
      setAnalysisStage(null);
    }
  }, [isOpen, initialSuspect]);

  // Gerenciamento do stream de câmera
  const startCamera = async (mode = facingMode) => {
    setCameraError(null);
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      setFacingMode(mode);
    } catch (err: any) {
      console.error('Erro ao acessar câmera:', err);
      setCameraError(
        'Não foi possível inicializar a câmera. Verifique as permissões de acesso do navegador ou envie uma foto pela galeria.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  };

  // Captura da câmera com otimização biométrica direta para 5G (máx 512px, ~35KB)
  const handleCaptureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const maxDim = 512;
    let w = video.videoWidth || 640;
    let h = video.videoHeight || 480;

    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

    setCapturedPhoto(dataUrl);
    setPhotoSource('camera');
    stopCamera();
    setResults(null);
    setAnalysisError(null);
    setScanProgress(null);
  };

  // Upload de foto da galeria com compressão prévia no cliente para evitar erros em redes 5G/4G
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageForBiometrics(file, 512, 0.75);
      setCapturedPhoto(compressed);
      setPhotoSource('upload');
      stopCamera();
      setResults(null);
      setAnalysisError(null);
      setScanProgress(null);
    } catch (err) {
      console.warn('Erro ao comprimir imagem da galeria:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedPhoto(reader.result as string);
        setPhotoSource('upload');
        stopCamera();
        setResults(null);
        setAnalysisError(null);
        setScanProgress(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Interrompe a varredura progressiva a qualquer momento
  const handleStopScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    setAnalysisStage(null);
  };

  // Executa a comparação por IA com proteção para rede 5G e feedback de progresso contínuo
  const handleRunComparison = async () => {
    if (!capturedPhoto) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setResults(null);
    setScanProgress(null);
    setAnalysisStage('Iniciando análise biométrica...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (comparisonMode === 'single') {
        // CONFRONTO 1:1 DIRETO
        const found = suspectsWithPhotos.find((s) => s.id === selectedSingleSuspectId);
        if (!found) {
          setAnalysisError('Selecione um indivíduo cadastrado para comparar 1:1.');
          setIsAnalyzing(false);
          setAnalysisStage(null);
          return;
        }

        const photos = extractSuspectPhotos(found);
        const formatted = [
          {
            id: found.id,
            nome: found.nome || 'Sem Nome',
            alcunha: found.alcunha || '',
            rg: found.rg || '',
            photo: photos[0] || '',
          },
        ];

        const response = await compareFacesWithAI(
          capturedPhoto,
          formatted,
          (stage) => setAnalysisStage(stage),
          controller.signal
        );

        if (response.status === 'success' && response.matches) {
          setResults(response.matches);
        } else {
          setAnalysisError(
            response.message || 'Não foi possível concluir a análise de comparação fisionômica.'
          );
        }
      } else if (comparisonMode === 'batch') {
        // LOTE TÁTICO ATUAL (10 registros filtrados)
        const candidatesList = currentBatchCandidates;
        if (candidatesList.length === 0) {
          setAnalysisError(
            'Nenhum suspeito com foto cadastrada foi encontrado no lote atual selecionado.'
          );
          setIsAnalyzing(false);
          setAnalysisStage(null);
          return;
        }

        const formattedCandidates = candidatesList.map((s) => {
          const photos = extractSuspectPhotos(s);
          return {
            id: s.id,
            nome: s.nome || 'Sem Nome',
            alcunha: s.alcunha || '',
            rg: s.rg || '',
            photo: photos[0] || '',
          };
        });

        const response = await compareFacesWithAI(
          capturedPhoto,
          formattedCandidates,
          (stage) => setAnalysisStage(stage),
          controller.signal
        );

        if (response.status === 'success' && response.matches) {
          setResults(response.matches);
        } else {
          setAnalysisError(
            response.message || 'Não foi possível concluir a análise de comparação fisionômica.'
          );
        }
      } else {
        // VARREDURA COMPLETA DO BANCO (Todos os cadastros com foto em micro-lotes progressivos)
        const candidatesList = scopedSuspectsWithPhotos;
        if (candidatesList.length === 0) {
          setAnalysisError('Nenhum indivíduo com foto cadastrada no banco de dados para varredura.');
          setIsAnalyzing(false);
          setAnalysisStage(null);
          return;
        }

        const formattedAll = candidatesList.map((s) => {
          const photos = extractSuspectPhotos(s);
          return {
            id: s.id,
            nome: s.nome || 'Sem Nome',
            alcunha: s.alcunha || '',
            rg: s.rg || '',
            photo: photos[0] || '',
          };
        });

        const response = await scanAllDatabaseProgressive(
          capturedPhoto,
          formattedAll,
          (prog) => {
            setAnalysisStage(prog.stageMessage);
            setScanProgress({
              processedCount: prog.processedCount,
              totalCount: prog.totalCount,
              currentBatch: prog.currentBatch,
              totalBatches: prog.totalBatches,
              percent: Math.min(100, Math.round((prog.processedCount / prog.totalCount) * 100)),
            });
            if (prog.partialMatches.length > 0) {
              setResults(prog.partialMatches);
            }
          },
          controller.signal,
          8 // 8 candidatos por micro-lote: ideal para redes 5G
        );

        if (response.success && response.matches) {
          setResults(response.matches);
        } else if (response.message) {
          setAnalysisError(response.message);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Erro na comparação facial:', err);
        setAnalysisError(err.message || 'Erro inesperado durante a verificação biométrica.');
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage(null);
      abortControllerRef.current = null;
    }
  };

  const copyMatchReport = (match: FacialMatchResult) => {
    const text = `[BANCO DE DADOS OPERACIONAL - IDENTIFICAÇÃO FACIAL TÁTICA POR IA]
Abordado Confrontado: ${match.candidateNome} (${match.candidateAlcunha || 'Sem vulgo'})
RG: ${match.candidateRg || 'Não consta'}
Índice de Compatibilidade: ${match.percentual}% (${match.nivel})
Diagnóstico Biométrico: ${match.resumoDiagnostico}
Pontos Coincidentes: ${match.pontosCoincidentes.join(', ')}
Divergências Observadas: ${match.pontosDivergentes.join(', ')}
Recomendação Tática: ${match.recomendacaoTatica}

TERMO DE RESGUARDO OBRIGATÓRIO:
${match.avisoResguardo}
(A confirmação da identidade civil DEVE ser realizada obrigatoriamente pelo agente in loco).`;

    navigator.clipboard.writeText(text);
    setCopiedId(match.candidateId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0f141d] border border-[#c69c59]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header Tático */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#161c28] via-[#1a2233] to-[#161c28] border-b border-[#c69c59]/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#c69c59] to-[#8a682c] flex items-center justify-center shadow-lg shadow-[#c69c59]/20 text-neutral-950">
              <ScanLine className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  Identificação Facial Tática por IA
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-[#c69c59]/20 text-[#e5c07b] border border-[#c69c59]/40">
                  BIOMETRIA MULTIMODAL
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Confronto fisionômico do abordado com os cadastros do banco de dados
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

        {/* Corpo do Modal */}
        <div className="p-3 sm:p-6 overflow-y-auto space-y-4">
          {/* 1. SELETOR DE MODO DE CONFRONTO */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#141923] p-2.5 sm:p-3 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-[#c69c59]" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Escopo do Confronto:
              </span>
              <span className="text-[10px] font-mono text-[#e5c07b] bg-[#c69c59]/15 px-2 py-0.5 rounded border border-[#c69c59]/30">
                {suspectsWithPhotos.length} cadastros com foto
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-[#0e121a] p-1 rounded-xl border border-neutral-800 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setComparisonMode('all');
                  setResults(null);
                  setIsChangingSuspect(false);
                }}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  comparisonMode === 'all'
                    ? 'bg-[#c69c59] text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Varredura de todos os cadastros com foto do banco"
              >
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Banco Completo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setComparisonMode('batch');
                  setResults(null);
                  setIsChangingSuspect(false);
                }}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  comparisonMode === 'batch'
                    ? 'bg-[#c69c59] text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Confronto apenas do lote atual de 10 cadastros"
              >
                <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Lote Tático (10)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setComparisonMode('single');
                  setResults(null);
                }}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  comparisonMode === 'single'
                    ? 'bg-[#c69c59] text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Confronto direto 1:1 com suspeito específico"
              >
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Alvo Único (1:1)</span>
              </button>
            </div>
          </div>

          {/* 2. CÂMERA AO VIVO (QUANDO ATIVA) */}
          {isCameraActive && (
            <div className="bg-[#141923] border border-[#c69c59]/50 rounded-xl p-3 sm:p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#c69c59]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Câmera Tática - Enquadre o Abordado
                  </span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 animate-pulse flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" /> AO VIVO
                </span>
              </div>

              <div className="relative w-full aspect-[4/3] max-h-[360px] bg-black rounded-xl overflow-hidden border border-neutral-700/80 flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* HUD / Retículo Tático de Enquadramento */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-36 sm:w-44 h-48 sm:h-56 border-2 border-dashed border-[#c69c59]/90 rounded-[50%] flex items-center justify-center shadow-[0_0_25px_rgba(198,156,89,0.35)]">
                    <div className="w-full h-0.5 bg-[#c69c59]/40" />
                  </div>
                  <span className="mt-2 text-[10px] font-mono font-black text-[#e5c07b] bg-black/80 px-2.5 py-0.5 rounded backdrop-blur border border-[#c69c59]/40 uppercase tracking-wider">
                    Posicione o Rosto do Abordado
                  </span>
                </div>

                {/* Controles de Câmera */}
                <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={toggleCameraFacingMode}
                    className="p-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 backdrop-blur cursor-pointer text-xs flex items-center gap-1 active:scale-95 transition-all shadow"
                    title="Alternar Câmera Traseira/Frontal"
                  >
                    <SwitchCamera className="w-4 h-4 text-[#c69c59]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCaptureFromCamera}
                    className="flex-1 max-w-xs py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#ffd700] hover:brightness-110 text-neutral-950 font-black text-xs shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4 text-neutral-950" />
                    <span>Capturar Foto Agora</span>
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 backdrop-blur cursor-pointer active:scale-95 transition-all shadow"
                    title="Cancelar Câmera"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-600/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* 3. CENÁRIO DE CONFRONTO TÁTICO ADAPTADO PARA CELULAR E WEB */}
          {!isCameraActive && (
            <div className="space-y-3">
              {comparisonMode === 'single' ? (
                /* MODO 1:1 - CONFRONTO DIRETO LADO A LADO NO CELULAR E WEB */
                <div className="bg-[#141923] border border-neutral-800 rounded-xl p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#c69c59]" />
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        Confronto Biométrico Direto (1:1)
                      </h3>
                    </div>
                    {results && topMatch && (
                      <span
                        className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                          topMatch.nivel === 'ALTA'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : topMatch.nivel === 'MODERADA'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {topMatch.percentual}% • {topMatch.nivel}
                      </span>
                    )}
                  </div>

                  {/* FOTOS LADO A LADO (RUA VS BANCO) - TOTALMENTE PRÓXIMAS NO CELULAR */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 items-stretch">
                    {/* CARD 1: FOTO DO ABORDADO (RUA) */}
                    <div className="flex flex-col bg-[#0e121a] rounded-xl border border-neutral-800 p-2 sm:p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-[#c69c59] uppercase tracking-wider flex items-center gap-1">
                          <Camera className="w-3 h-3" /> Abordado (Rua)
                        </span>
                        {capturedPhoto && (
                          <span className="text-[9px] font-mono text-emerald-400">Pronta</span>
                        )}
                      </div>

                      {/* Visualizador da foto */}
                      <div className="relative w-full aspect-square sm:aspect-[4/3] bg-black/80 rounded-lg overflow-hidden border border-neutral-700/80 flex items-center justify-center group">
                        {capturedPhoto ? (
                          <>
                            <img
                              src={capturedPhoto}
                              alt="Foto do abordado"
                              className="w-full h-full object-cover"
                            />

                            {/* TARJA LIMPA DE COMPATIBILIDADE NA PRÓPRIA FOTO DO ABORDADO */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-1.5 pt-3">
                              {isAnalyzing ? (
                                <div className="text-[10px] font-mono text-[#e5c07b] flex items-center justify-center gap-1 animate-pulse">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                  <span>Escaneando...</span>
                                </div>
                              ) : results && topMatch ? (
                                <div
                                  className={`text-center py-0.5 px-1 rounded text-[10px] font-black tracking-wider uppercase flex items-center justify-center gap-1 border ${
                                    topMatch.nivel === 'ALTA'
                                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 shadow-lg'
                                      : topMatch.nivel === 'MODERADA'
                                      ? 'bg-amber-950/90 text-amber-300 border-amber-500/60 shadow-lg'
                                      : 'bg-rose-950/90 text-rose-300 border-rose-500/60 shadow-lg'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      topMatch.nivel === 'ALTA'
                                        ? 'bg-emerald-400'
                                        : topMatch.nivel === 'MODERADA'
                                        ? 'bg-amber-400'
                                        : 'bg-rose-400'
                                    }`}
                                  />
                                  <span>
                                    {topMatch.nivel === 'ALTA'
                                      ? `Compatível • ${topMatch.percentual}%`
                                      : topMatch.nivel === 'MODERADA'
                                      ? `Moderada • ${topMatch.percentual}%`
                                      : `Baixa • ${topMatch.percentual}%`}
                                  </span>
                                </div>
                              ) : results && results.length === 0 ? (
                                <div className="text-center py-0.5 px-1 rounded text-[9px] font-bold uppercase bg-neutral-900/90 text-neutral-300 border border-neutral-700">
                                  Não Localizado
                                </div>
                              ) : (
                                <div className="text-center text-[9px] font-mono text-neutral-400">
                                  Foto Carregada
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center">
                            <Camera className="w-6 h-6 text-[#c69c59]/70 mb-1" />
                            <span className="text-[10px] font-bold text-neutral-300">
                              Sem foto
                            </span>
                            <span className="text-[9px] text-neutral-500">
                              Tire ou envie foto
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação para Foto da Rua */}
                      <div className="grid grid-cols-2 gap-1 mt-2">
                        <button
                          type="button"
                          onClick={() => startCamera(facingMode)}
                          className="py-1.5 px-1 rounded-lg bg-[#1c2333] hover:bg-[#252f44] border border-neutral-700 text-neutral-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                        >
                          <Camera className="w-3 h-3 text-[#c69c59]" />
                          <span>Câmera</span>
                        </button>

                        <label className="py-1.5 px-1 rounded-lg bg-[#1c2333] hover:bg-[#252f44] border border-neutral-700 text-neutral-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all">
                          <Upload className="w-3 h-3 text-[#c69c59]" />
                          <span>Galeria</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* CARD 2: FOTO DO CADASTRO (BANCO DE DADOS) */}
                    <div className="flex flex-col bg-[#0e121a] rounded-xl border border-neutral-800 p-2 sm:p-2.5 justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1">
                            <User className="w-3 h-3" /> Cadastro (Banco)
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsChangingSuspect(!isChangingSuspect)}
                            className="text-[9px] font-mono text-[#e5c07b] hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <span>Trocar</span>
                            <Search className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Visualizador da foto do suspeito */}
                        {(() => {
                          const photos = selectedSingleSuspect
                            ? extractSuspectPhotos(selectedSingleSuspect)
                            : [];
                          const targetPhoto = photos[0];

                          return (
                            <div className="relative w-full aspect-square sm:aspect-[4/3] bg-black/80 rounded-lg overflow-hidden border border-neutral-700/80 flex items-center justify-center">
                              {targetPhoto ? (
                                <img
                                  src={formatPhotoUrl(targetPhoto)}
                                  alt="Foto do banco"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-2 text-center text-neutral-500">
                                  <User className="w-6 h-6 mb-1 text-neutral-600" />
                                  <span className="text-[9px] font-mono">Sem foto</span>
                                </div>
                              )}

                              {/* Identificação compacta na foto */}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/85 to-transparent p-1.5 pt-3">
                                <p className="text-[10px] font-extrabold text-white truncate text-center">
                                  {selectedSingleSuspect?.nome || 'Nenhum selecionado'}
                                </p>
                                {selectedSingleSuspect?.alcunha && (
                                  <p className="text-[9px] text-[#e5c07b] truncate text-center font-bold">
                                    "{selectedSingleSuspect.alcunha}"
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Mini ficha do suspeito selecionado */}
                      <div className="mt-2 text-[10px] text-neutral-400 space-y-0.5 bg-[#141923] p-1.5 rounded-lg border border-neutral-800">
                        <div className="truncate">
                          RG:{' '}
                          <span className="text-white font-mono font-bold">
                            {selectedSingleSuspect?.rg || 'S/ RG'}
                          </span>
                        </div>
                        {selectedSingleSuspect?.artigo && (
                          <div className="truncate text-[9px] text-neutral-500">
                            Art: {selectedSingleSuspect.artigo}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BUSCA RÁPIDA / TROCAR ALVO NO MODO 1:1 */}
                  {isChangingSuspect && (
                    <div className="p-2.5 rounded-xl bg-[#0e121a] border border-[#c69c59]/40 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#e5c07b] uppercase">
                          Selecione o Suspeito para Comparar:
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsChangingSuspect(false)}
                          className="text-neutral-400 hover:text-white text-xs cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Pesquisar por nome, vulgo ou RG..."
                          value={searchTermSingle}
                          onChange={(e) => setSearchTermSingle(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#141923] border border-neutral-700 text-xs text-white placeholder:text-neutral-500 focus:border-[#c69c59] outline-none"
                        />
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {filteredSingleCandidates.map((s) => {
                          const photos = extractSuspectPhotos(s);
                          const isSelected = selectedSingleSuspectId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedSingleSuspectId(s.id);
                                setIsChangingSuspect(false);
                                setResults(null);
                              }}
                              className={`w-full flex items-center justify-between p-1.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#c69c59]/20 border-[#c69c59] text-white'
                                  : 'bg-[#141923] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {photos[0] ? (
                                  <img
                                    src={formatPhotoUrl(photos[0])}
                                    alt=""
                                    className="w-6 h-6 rounded object-cover border border-neutral-700"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-[8px]">
                                    S/F
                                  </div>
                                )}
                                <div className="min-w-0 truncate">
                                  <span className="font-bold truncate text-[11px] block">
                                    {s.nome}
                                  </span>
                                  {s.alcunha && (
                                    <span className="text-[10px] text-[#e5c07b] truncate block">
                                      "{s.alcunha}"
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#c69c59] flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MODO 1:N - BANCO COMPLETO ADAPTADO PARA CELULAR E WEB */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-stretch">
                  {/* Bloco 1: Foto do Abordado */}
                  <div className="flex flex-col bg-[#141923] border border-neutral-800 rounded-xl p-3 sm:p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-[#c69c59]" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Foto do Abordado na Rua
                        </span>
                      </div>
                      {capturedPhoto && (
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Pronta
                        </span>
                      )}
                    </div>

                    <div className="relative w-full aspect-square sm:aspect-[4/3] bg-black/80 rounded-xl overflow-hidden border border-neutral-700/80 flex items-center justify-center">
                      {capturedPhoto ? (
                        <>
                          <img
                            src={capturedPhoto}
                            alt="Foto do abordado capturada"
                            className="w-full h-full object-cover"
                          />

                          {/* TARJA LIMPA DE COMPATIBILIDADE NA FOTO DO ABORDADO */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-2 pt-4">
                            {isAnalyzing ? (
                              <div className="text-[10px] font-mono text-[#e5c07b] flex items-center justify-center gap-1.5 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Escaneando biometria...</span>
                              </div>
                            ) : results && topMatch ? (
                              <div
                                className={`text-center py-1 px-2 rounded-lg text-xs font-black tracking-wider uppercase flex items-center justify-center gap-1.5 border shadow-lg ${
                                  topMatch.nivel === 'ALTA'
                                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70'
                                    : topMatch.nivel === 'MODERADA'
                                    ? 'bg-amber-950/90 text-amber-300 border-amber-500/70'
                                    : 'bg-rose-950/90 text-rose-300 border-rose-500/60'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    topMatch.nivel === 'ALTA'
                                      ? 'bg-emerald-400'
                                      : topMatch.nivel === 'MODERADA'
                                      ? 'bg-amber-400'
                                      : 'bg-rose-400'
                                  }`}
                                />
                                <span>
                                  {topMatch.nivel === 'ALTA'
                                    ? `Compatível • ${topMatch.percentual}%`
                                    : topMatch.nivel === 'MODERADA'
                                    ? `Moderada • ${topMatch.percentual}%`
                                    : `Baixa • ${topMatch.percentual}%`}
                                </span>
                              </div>
                            ) : results && results.length === 0 ? (
                              <div className="text-center py-1 px-2 rounded text-xs font-bold uppercase bg-neutral-900/90 text-neutral-300 border border-neutral-700">
                                Nenhum Vínculo no Banco
                              </div>
                            ) : (
                              <div className="text-center text-[10px] font-mono text-neutral-400">
                                Foto Pronta para Análise
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-3 text-center">
                          <ScanLine className="w-8 h-8 text-[#c69c59]/70 mb-1.5" />
                          <p className="text-xs font-bold text-neutral-300">
                            Nenhuma foto capturada
                          </p>
                          <p className="text-[10px] text-neutral-500 max-w-xs mt-0.5">
                            Abra a câmera ou selecione da galeria para confrontar
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2.5">
                      <button
                        type="button"
                        onClick={() => startCamera(facingMode)}
                        className="py-2 px-2 rounded-xl bg-[#1c2333] hover:bg-[#252f44] border border-neutral-700 text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#c69c59]" />
                        <span>Abrir Câmera</span>
                      </button>

                      <label className="py-2 px-2 rounded-xl bg-[#1c2333] hover:bg-[#252f44] border border-neutral-700 text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all">
                        <Upload className="w-3.5 h-3.5 text-[#c69c59]" />
                        <span>Galeria</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Bloco 2: Escopo do Confronto (Varredura 1:N) */}
                  <div className="flex flex-col bg-[#141923] border border-neutral-800 rounded-xl p-3 sm:p-3.5 justify-between space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Filter className="w-4 h-4 text-[#c69c59]" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Varredura no Banco (1:N)
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                          <Zap className="w-3 h-3 text-emerald-400" />
                          <span>5G Otimizado</span>
                        </span>
                      </div>

                      {/* Filtros Rápidos de Marcador para Focar o Scan */}
                      <div className="flex items-center gap-1 flex-wrap mb-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterMarcador('TODOS');
                            setBatchOffset(0);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            filterMarcador === 'TODOS'
                              ? 'bg-[#c69c59] text-neutral-950 border-[#c69c59]'
                              : 'bg-[#0e121a] text-neutral-400 border-neutral-700/80 hover:text-white'
                          }`}
                        >
                          Todos ({suspectsWithPhotos.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterMarcador('ALVO_PRIORITARIO');
                            setBatchOffset(0);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            filterMarcador === 'ALVO_PRIORITARIO'
                              ? 'bg-[#5e351f] text-[#fadcce] border-[#9c552e]'
                              : 'bg-[#0e121a] text-neutral-400 border-neutral-700/80 hover:text-white'
                          }`}
                        >
                          Alvos Prioritários
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterMarcador('FORAGIDO');
                            setBatchOffset(0);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            filterMarcador === 'FORAGIDO'
                              ? 'bg-yellow-400 text-neutral-950 border-yellow-300'
                              : 'bg-[#0e121a] text-neutral-400 border-neutral-700/80 hover:text-white'
                          }`}
                        >
                          Foragidos
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterMarcador('PRESO');
                            setBatchOffset(0);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            filterMarcador === 'PRESO'
                              ? 'bg-slate-600 text-white border-slate-400'
                              : 'bg-[#0e121a] text-neutral-400 border-neutral-700/80 hover:text-white'
                          }`}
                        >
                          Presos
                        </button>
                      </div>

                      {/* Controle de Lotes (10 por lote para resposta rápida em redes móveis) */}
                      {scopedSuspectsWithPhotos.length > BATCH_SIZE && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0e121a] border border-neutral-800 mb-2">
                          <span className="text-[11px] font-mono text-[#e5c07b] font-bold">
                            Lote {currentBatchNum} de {totalBatches} ({currentBatchCandidates.length} indivíduos)
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setBatchOffset((prev) => Math.max(0, prev - BATCH_SIZE));
                                setResults(null);
                              }}
                              disabled={batchOffset === 0 || isAnalyzing}
                              className="px-2 py-1 rounded bg-[#1c2333] hover:bg-[#252f44] disabled:opacity-40 text-neutral-200 text-[10px] font-bold flex items-center gap-0.5 border border-neutral-700 cursor-pointer"
                              title="Lote anterior"
                            >
                              <ChevronLeft className="w-3 h-3" />
                              <span>Anterior</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBatchOffset((prev) =>
                                  Math.min(prev + BATCH_SIZE, (totalBatches - 1) * BATCH_SIZE)
                                );
                                setResults(null);
                              }}
                              disabled={batchOffset + BATCH_SIZE >= scopedSuspectsWithPhotos.length || isAnalyzing}
                              className="px-2 py-1 rounded bg-[#1c2333] hover:bg-[#252f44] disabled:opacity-40 text-neutral-200 text-[10px] font-bold flex items-center gap-0.5 border border-neutral-700 cursor-pointer"
                              title="Próximo lote"
                            >
                              <span>Próximo</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Card de Resumo do Confronto dentro do Escopo */}
                      {results && topMatch ? (
                        <div className="p-3 rounded-xl bg-[#0e121a] border border-neutral-800 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                              Principal Correspondência:
                            </span>
                            <span
                              className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                                topMatch.nivel === 'ALTA'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                  : topMatch.nivel === 'MODERADA'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              }`}
                            >
                              {topMatch.percentual}% • {topMatch.nivel}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {topMatch.candidateFoto ? (
                              <img
                                src={formatPhotoUrl(topMatch.candidateFoto)}
                                alt=""
                                className="w-14 h-14 rounded-lg object-cover border border-neutral-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-neutral-800 flex items-center justify-center text-xs flex-shrink-0">
                                S/F
                              </div>
                            )}

                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-white uppercase truncate">
                                {topMatch.candidateNome}
                              </h4>
                              {topMatch.candidateAlcunha && (
                                <p className="text-[11px] text-[#e5c07b] font-bold truncate">
                                  "{topMatch.candidateAlcunha}"
                                </p>
                              )}
                              <p className="text-[10px] text-neutral-400 mt-0.5">
                                RG: {topMatch.candidateRg || 'Não informado'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-[#10141d] border border-neutral-800/80 space-y-1.5 text-xs text-neutral-300 leading-relaxed">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-400">Prontos para análise neste lote:</span>
                            <strong className="text-[#e5c07b] font-mono">{currentBatchCandidates.length} cadastros</strong>
                          </div>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-1 pt-0.5 font-mono">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span>Envio leve: imagens comprimidas para 5G/4G.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-neutral-500 italic mt-1">
                      💡 Análise em lotes de 10 cadastros garante resposta ultra-rápida sem queda de sinal na rua.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. BANNER LIMPO DE COMPATIBILIDADE (DESTAQUE IMEDIATO NO CELULAR E WEB) */}
          {results && (
            <div
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all shadow-md ${
                !topMatch || topMatch.nivel === 'BAIXA'
                  ? 'bg-rose-950/30 border-rose-600/40 text-rose-200'
                  : topMatch.nivel === 'MODERADA'
                  ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                  : 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {topMatch?.nivel === 'ALTA' ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                ) : topMatch?.nivel === 'MODERADA' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
                ) : (
                  <X className="w-6 h-6 text-rose-400 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-xs uppercase tracking-wider">
                      {topMatch
                        ? `Compatibilidade ${topMatch.nivel} (${topMatch.percentual}%)`
                        : 'Sem Correspondência Localizada'}
                    </span>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-mono font-extrabold ${
                        topMatch?.nivel === 'ALTA'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                          : topMatch?.nivel === 'MODERADA'
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {topMatch?.nivel === 'ALTA'
                        ? 'COMPATÍVEL'
                        : topMatch?.nivel === 'MODERADA'
                        ? 'PARCIAL / IN LOCO'
                        : 'NÃO COMPATÍVEL'}
                    </span>
                  </div>
                  <p className="text-[11px] truncate opacity-90 mt-0.5">
                    {topMatch
                      ? `Indivíduo apontado: ${topMatch.candidateNome}${
                          topMatch.candidateAlcunha ? ` ("${topMatch.candidateAlcunha}")` : ''
                        }`
                      : 'O abordado não coincide fisionomicamente com os cadastros do banco.'}
                  </p>
                </div>
              </div>

              {topMatch && (
                <div className="flex-shrink-0 self-end sm:self-center">
                  <span className="text-sm font-black font-mono px-2.5 py-1 rounded-lg bg-black/40 border border-current">
                    Índice: {topMatch.percentual}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 5. ÁREA DE PROGRESSO E DISPARO DA ANÁLISE */}
          <div className="pt-1 space-y-2.5">
            {/* Feedback de Progresso da Varredura (5G Progressivo) */}
            {isAnalyzing && (
              <div className="p-3 rounded-xl bg-[#121622] border border-[#c69c59]/50 space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="w-3.5 h-3.5 text-[#e5c07b] animate-spin flex-shrink-0" />
                    <span className="font-bold text-white font-mono truncate">
                      {analysisStage || 'Processando biometria...'}
                    </span>
                  </div>
                  {scanProgress && (
                    <span className="font-mono text-[#e5c07b] font-black flex-shrink-0 ml-2">
                      {scanProgress.percent}% ({scanProgress.processedCount}/{scanProgress.totalCount})
                    </span>
                  )}
                </div>

                {scanProgress && (
                  <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
                    <div
                      className="h-full bg-gradient-to-r from-[#c69c59] via-amber-400 to-emerald-400 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(5, scanProgress.percent)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Botão de Disparo da Análise */}
            <button
              type="button"
              onClick={handleRunComparison}
              disabled={!capturedPhoto || isAnalyzing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#c69c59] via-[#dfb66d] to-[#c69c59] hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:pointer-events-none text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-neutral-950" />
                  <span>
                    {comparisonMode === 'all'
                      ? 'Varrendo Banco Geral com Gemini IA...'
                      : 'Processando Biometria com Gemini IA...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-neutral-950" />
                  <span>
                    {comparisonMode === 'all'
                      ? results
                        ? 'Refazer Varredura de Todos os Cadastros'
                        : `Varrer Todos os ${scopedSuspectsWithPhotos.length} Cadastros com Foto`
                      : comparisonMode === 'batch'
                      ? results
                        ? 'Refazer Confronto do Lote Atual'
                        : `Confrontar Lote Atual (${currentBatchCandidates.length} Alvos)`
                      : results
                      ? 'Refazer Confronto 1:1 com o Alvo'
                      : 'Confrontar Diretamente com Alvo Selecionado (1:1)'}
                  </span>
                </>
              )}
            </button>

            {/* Botão para Interromper Varredura Longa */}
            {isAnalyzing && (
              <button
                type="button"
                onClick={handleStopScan}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/70 text-rose-200 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
              >
                <X className="w-4 h-4 text-rose-400" />
                <span>Interromper Varredura (Preservar Resultados Obtidos)</span>
              </button>
            )}
          </div>

          {/* 6. AVISO DE RESGUARDO OPERACIONAL E CONFERÊNCIA IN LOCO (POSICIONADO ABAIXO DA FOTO E ESCOPO DO CONFRONTO) */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-amber-950/30 via-[#1c170f] to-amber-950/30 border border-amber-500/40 shadow-sm">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-neutral-300 leading-relaxed">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-amber-300 uppercase tracking-wide text-[11px]">
                    AVISO DE RESGUARDO OPERACIONAL E CONFERÊNCIA IN LOCO
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 text-[9px] font-mono font-bold">
                    OBRIGATÓRIO
                  </span>
                </div>

                <p className="text-[11px] text-neutral-300">
                  Os índices de probabilidade são classificados estritamente em{' '}
                  <strong className="text-emerald-400">Alta</strong> (80% a 99%),{' '}
                  <strong className="text-amber-400">Moderada</strong> (50% a 79%) e{' '}
                  <strong className="text-rose-400">Baixa</strong> (&lt;50%).
                </p>

                <p className="text-[11px] text-amber-200/90 font-medium">
                  ⚖️ <strong>DIRETRIZ DE CAMPO:</strong> Este sistema NÃO fornece certeza absoluta nem
                  substitui a perícia civil/criminal.{' '}
                  <span className="underline decoration-amber-400 font-bold text-white">
                    A identidade do indivíduo DEVE ser confirmada pelo policial / agente in loco
                  </span>
                  , mediante inspeção de tatuagens, cicatrizes, marcas e documentação do abordado.
                </p>
              </div>
            </div>
          </div>

          {/* Erro de Análise */}
          {analysisError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/50 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Falha no processamento:</strong>
                <span>{analysisError}</span>
              </div>
            </div>
          )}

          {/* ÁREA DE RESULTADOS */}
          {results && (
            <div className="space-y-4 pt-2 border-t border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Resultados da Comparação Facial ({results.length}{' '}
                    {results.length === 1 ? 'registro' : 'registros'})
                  </h3>
                </div>
                <span className="text-xs text-neutral-400 font-mono">
                  Ordenado por maior compatibilidade
                </span>
              </div>

              {results.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#141923] border border-neutral-800 text-center text-xs text-neutral-400">
                  Nenhuma correspondência fisionômica encontrada. O abordado pode não estar
                  cadastrado no banco de dados.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {results.map((match) => {
                    const suspectFull = allSuspects.find((s) => s.id === match.candidateId);
                    const isHigh = match.nivel === 'ALTA';
                    const isModerate = match.nivel === 'MODERADA';
                    const isLow = match.nivel === 'BAIXA';

                    // Cores do Badge
                    let badgeClass =
                      'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-950/30';
                    let borderClass = 'border-neutral-800';
                    let barColor = 'bg-rose-500';

                    if (isHigh) {
                      badgeClass =
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-950/40';
                      borderClass = 'border-emerald-500/50 shadow-lg shadow-emerald-950/30';
                      barColor = 'bg-gradient-to-r from-emerald-500 to-teal-400';
                    } else if (isModerate) {
                      badgeClass =
                        'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-950/40';
                      borderClass = 'border-amber-500/40';
                      barColor = 'bg-gradient-to-r from-amber-500 to-yellow-400';
                    }

                    return (
                      <div
                        key={match.candidateId}
                        className={`p-4 rounded-xl bg-[#141923] border ${borderClass} space-y-3.5 transition-all`}
                      >
                        {/* Linha Superior: Fotos lado a lado + Identificação e Nível */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Confronto Visual Lado a Lado */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className="flex flex-col items-center">
                                <span className="text-[9px] font-mono text-neutral-400 mb-0.5">
                                  RUA
                                </span>
                                {capturedPhoto ? (
                                  <img
                                    src={capturedPhoto}
                                    alt="Foto rua"
                                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-[#c69c59]/50"
                                  />
                                ) : (
                                  <div className="w-14 h-14 bg-neutral-900 rounded-lg" />
                                )}
                              </div>

                              <div className="text-xs font-mono font-bold text-neutral-500">
                                VS
                              </div>

                              <div className="flex flex-col items-center">
                                <span className="text-[9px] font-mono text-neutral-400 mb-0.5">
                                  BANCO
                                </span>
                                {match.candidateFoto ? (
                                  <img
                                    src={formatPhotoUrl(match.candidateFoto)}
                                    alt="Foto banco"
                                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-neutral-700"
                                  />
                                ) : (
                                  <div className="w-14 h-14 bg-neutral-900 rounded-lg flex items-center justify-center text-[10px]">
                                    S/F
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Dados do Cadastro */}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h4 className="text-sm font-extrabold text-white uppercase truncate">
                                  {match.candidateNome}
                                </h4>
                                {match.candidateAlcunha && (
                                  <span className="text-xs font-extrabold text-[#e5c07b] bg-[#c69c59]/15 px-1.5 py-0.2 rounded border border-[#c69c59]/30">
                                    "{match.candidateAlcunha}"
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-400 mt-0.5">
                                RG:{' '}
                                <strong className="text-neutral-200">
                                  {match.candidateRg || 'Não informado'}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {/* Badge de Nível de Compatibilidade */}
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 self-stretch sm:self-auto justify-center">
                            <div
                              className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow ${badgeClass}`}
                            >
                              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                              <span>
                                Compatibilidade {match.nivel} ({match.percentual}%)
                              </span>
                            </div>

                            {/* Barra de Progresso */}
                            <div className="w-full sm:w-36 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                              <div
                                className={`h-full rounded-full transition-all ${barColor}`}
                                style={{ width: `${Math.min(100, Math.max(5, match.percentual))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* TARJA OBRIGATÓRIA DE CONFIRMAÇÃO IN LOCO NO PRÓPRIO CARD */}
                        <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/40 text-[11px] text-amber-200/90 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-amber-300">
                              Conferência Obrigatória In Loco:
                            </strong>{' '}
                            O sistema aponta compatibilidade{' '}
                            <span className="font-bold underline">{match.nivel}</span> ({match.percentual}
                            %). Esta estimativa{' '}
                            <span className="font-bold">DEVE ser confirmada pelo agente in loco</span>{' '}
                            através de conferência direta de cicatrizes, tatuagens e documentação do abordado.
                          </div>
                        </div>

                        {/* Detalhamento Antropométrico */}
                        <div className="space-y-2 text-xs text-neutral-300 bg-[#0e121a] p-3 rounded-lg border border-neutral-800/80">
                          <div>
                            <strong className="text-neutral-200 block text-[11px] uppercase tracking-wider mb-0.5">
                              Diagnóstico Fisionômico:
                            </strong>
                            <p className="text-neutral-300 leading-relaxed">
                              {match.resumoDiagnostico}
                            </p>
                          </div>

                          {match.pontosCoincidentes && match.pontosCoincidentes.length > 0 && (
                            <div>
                              <strong className="text-emerald-400 text-[11px] block mb-0.5">
                                ✓ Pontos Coincidentes:
                              </strong>
                              <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px]">
                                {match.pontosCoincidentes.map((p, idx) => (
                                  <li key={idx}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {match.pontosDivergentes && match.pontosDivergentes.length > 0 && (
                            <div>
                              <strong className="text-amber-400 text-[11px] block mb-0.5">
                                ⚠ Divergências / Variações:
                              </strong>
                              <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px]">
                                {match.pontosDivergentes.map((d, idx) => (
                                  <li key={idx}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {match.recomendacaoTatica && (
                            <div className="pt-1 text-[11px] text-amber-300 font-medium">
                              <strong>🎯 Recomendação Tática para a Guarnição:</strong>{' '}
                              {match.recomendacaoTatica}
                            </div>
                          )}
                        </div>

                        {/* Botões de Ação Rápida */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => copyMatchReport(match)}
                            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            {copiedId === match.candidateId ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-300">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#c69c59]" />
                                <span>Copiar Relatório</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-2">
                            {suspectFull && onStartAbordagemWithSuspect && (
                              <button
                                type="button"
                                onClick={() => {
                                  onStartAbordagemWithSuspect(suspectFull);
                                  onClose();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#1c2333] hover:bg-[#252f44] text-[#e5c07b] border border-[#c69c59]/40 text-xs font-bold transition-all cursor-pointer"
                              >
                                Lançar Abordagem
                              </button>
                            )}

                            {suspectFull && onSelectSuspectForDetail && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSuspectForDetail(suspectFull);
                                  onClose();
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 font-black text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow"
                              >
                                <span>Ver Ficha Completa</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-4 sm:px-6 py-3 bg-[#121622] border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span className="font-mono text-[11px]">
            BANCO DE DADOS • Módulo Pericial de Reconhecimento Facial
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
