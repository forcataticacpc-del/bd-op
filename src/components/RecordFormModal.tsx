import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  MapPin,
  Clock,
  Loader2,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  User,
  ShieldAlert,
  Edit3,
  ClipboardPaste,
  Lock,
} from 'lucide-react';
import { SuspectRecord, SuspectMarcador } from '../types';
import { getSyncConfig } from '../utils/storage';
import { sendSuspectToGoogleSheets } from '../utils/googleSheetsApi';
import { ArticleAutocomplete } from './ArticleAutocomplete';
import { parseArticlesString } from '../data/legalArticles';
import { normalizeText, formatCPF } from '../utils/textUtils';
import { getCurrentSession } from '../utils/userAuth';
import { ParserModal } from './ParserModal';
import { ParsedRecordData, parseRawSuspectText } from '../utils/textParser';
import { detectBPM } from '../utils/bpmMapping';
import {
  getActiveGPS,
  reverseGeocodeLocation,
  searchAddressLocations,
  AddressSuggestion,
} from '../utils/gpsService';

interface RecordFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: SuspectRecord, previousId?: string) => void;
  initialData?: SuspectRecord | null;
  existingSuspects?: SuspectRecord[];
}

export const RecordFormModal: React.FC<RecordFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingSuspects = [],
}) => {
  const [nome, setNome] = useState('');
  const [mae, setMae] = useState('');
  const [dataNasc, setDataNasc] = useState('');
  const [rg, setRg] = useState('');
  const [cpf, setCpf] = useState('');
  const [enderecos, setEnderecos] = useState<string[]>(['']);
  const [alcunha, setAlcunha] = useState('');
  const [artigos, setArtigos] = useState<string[]>([]);
  const [artigo, setArtigo] = useState('');
  const [marcador, setMarcador] = useState<SuspectMarcador>('NENHUM');
  const [localAbordagem, setLocalAbordagem] = useState('');
  const [horaAbordagem, setHoraAbordagem] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [bpm, setBpm] = useState('');
  const [localCoords, setLocalCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [observacoes, setObservacoes] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);

  // Sugestões de endereço e busca no mapa enquanto digita
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userModifiedBpm, setUserModifiedBpm] = useState(false);
  const addressSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addressDropdownRef = useRef<HTMLDivElement>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [isParserOpen, setIsParserOpen] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  } | null>(null);

  // Estado para diálogo de duplicidade
  const [duplicateSuspect, setDuplicateSuspect] = useState<SuspectRecord | null>(null);
  const [targetUpdateSuspect, setTargetUpdateSuspect] = useState<SuspectRecord | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Determina se é edição real de um registro com ID válido ou novo cadastro
  const isEditMode = Boolean(
    (initialData &&
      initialData.id &&
      initialData.id.trim() !== '' &&
      !initialData.id.startsWith('ai-queue-')) ||
      targetUpdateSuspect
  );

  // Coordenadas padrão de BH (Belo Horizonte - MG) caso o GPS ainda não tenha sido acionado
  const defaultCoords = { lat: -19.916681, lng: -43.934493 };

  // Rotina de geolocalização e identificação de BPM automática
  const triggerAutoGeolocation = async () => {
    setIsLocating(true);
    setGeoError(null);
    try {
      const coords = await getActiveGPS();
      setLocalCoords(coords);
      const geo = await reverseGeocodeLocation(coords.lat, coords.lng);
      if (geo.address) {
        setLocalAbordagem(geo.address);
      }
      if (geo.bpm) {
        setBpm(geo.bpm);
      }
    } catch (err: any) {
      console.warn('Erro ao auto-localizar:', err);
    } finally {
      setIsLocating(false);
    }
  };

  // Fecha o menu de sugestões de endereço ao clicar fora do container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addressDropdownRef.current &&
        !addressDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Inicializa ou reseta formulário
  useEffect(() => {
    if (!isOpen) return;

    setGeoError(null);
    setSubmitFeedback(null);
    setDuplicateSuspect(null);
    setTargetUpdateSuspect(null);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setIsSearchingAddress(false);

    if (initialData) {
      // 1. Registro existente para edição
      setNome(initialData.nome || '');
      setMae(initialData.mae || '');
      setDataNasc(initialData.dataNasc || '');
      setRg(initialData.rg || '');
      setCpf(formatCPF(initialData.cpf || ''));

      if (initialData.endereco) {
        const split = initialData.endereco.split(' | ').filter(Boolean);
        setEnderecos(split.length > 0 ? split : [initialData.endereco]);
      } else {
        setEnderecos(['']);
      }

      setAlcunha(initialData.alcunha || '');
      setMarcador((initialData.marcador as SuspectMarcador) || 'NENHUM');

      const parsedArtigos =
        initialData.artigos && initialData.artigos.length > 0
          ? initialData.artigos.slice(0, 30)
          : parseArticlesString(initialData.artigo).slice(0, 30);
      setArtigos(parsedArtigos);
      setArtigo(parsedArtigos.join(', ') || initialData.artigo || '');

      setLocalAbordagem(initialData.localAbordagem || '');
      setHoraAbordagem(initialData.horaAbordagem || '');
      // Auto-identifica BPM ou recupera o salvo
      const detectedInitialBpm =
        initialData.bpm ||
        detectBPM(`${initialData.localAbordagem || ''} ${initialData.endereco || ''}`);
      setBpm(detectedInitialBpm);
      setUserModifiedBpm(Boolean(initialData.bpm));

      let coords = initialData.localAbordagemCoords;
      if (!coords && initialData.coordenadas && initialData.coordenadas.includes(',')) {
        const parts = initialData.coordenadas.split(',');
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          coords = { lat, lng };
        }
      }
      setLocalCoords(coords);
      setObservacoes(initialData.observacoes || '');
      setFotos(initialData.fotos || []);
      // IMPORTANTE: Em edição de card existente, NUNCA busca novamente GPS ou hora automaticamente
    } else {
      // 2. Novo registro limpo: GPS automático e hora atual automática conforme solicitado
      setNome('');
      setMae('');
      setDataNasc('');
      setRg('');
      setCpf('');
      setEnderecos(['']);
      setAlcunha('');
      setMarcador('NENHUM');
      setArtigos([]);
      setArtigo('');
      setLocalAbordagem('');
      setHoraAbordagem(
        `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
      );
      setBpm('');
      setUserModifiedBpm(false);
      setLocalCoords(undefined);
      setObservacoes('');
      setFotos([]);
      triggerAutoGeolocation();
    }
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Compressão e redimensionamento automático de fotos no cliente
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 960;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve((event.target?.result as string) || '');
            return;
          }

          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.88);
          resolve(compressedBase64);
        };
        img.onerror = () => resolve((event.target?.result as string) || '');
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const compressed = await compressImageFile(file);
      if (compressed) {
        newPhotos.push(compressed);
      }
    }

    if (newPhotos.length > 0) {
      setFotos((prev) => [...prev, ...newPhotos]);
    }
    if (e.target) e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAddress = () => {
    setEnderecos((prev) => [...prev, '']);
  };

  const handleRemoveAddress = (index: number) => {
    setEnderecos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddressChange = (index: number, value: string) => {
    setEnderecos((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  // Obter localização exata do GPS do telefone e vincular Batalhão
  const handleGetLocation = async () => {
    setIsLocating(true);
    setGeoError(null);
    setShowSuggestions(false);
    setAddressSuggestions([]);
    setUserModifiedBpm(false);
    try {
      const coords = await getActiveGPS();
      setLocalCoords(coords);
      const geo = await reverseGeocodeLocation(coords.lat, coords.lng);
      if (geo.address) {
        setLocalAbordagem(geo.address);
      }
      if (geo.bpm) {
        setBpm(geo.bpm);
      }
    } catch (err: any) {
      console.warn('Falha ao obter localização:', err);
      setGeoError('Não foi possível obter endereço via GPS no momento.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleLocalAbordagemChange = (val: string) => {
    setLocalAbordagem(val);

    // 1. Detecção imediata com base em texto/bairro já digitado
    const immediateBpm = detectBPM(val);
    if (immediateBpm && !userModifiedBpm) {
      setBpm(immediateBpm);
    }

    // 2. Busca debounced no Maps / Nominatim
    if (addressSearchTimeoutRef.current) {
      clearTimeout(addressSearchTimeoutRef.current);
    }

    const trimmed = val.trim();
    if (trimmed.length >= 3) {
      setIsSearchingAddress(true);
      addressSearchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchAddressLocations(trimmed);
          setAddressSuggestions(results);
          setShowSuggestions(results.length > 0);

          // "quando tiver digitado o nome da rua fazer a busca no mapa e preencher o batalhao a qual pertence essa rua, podendo ser alterado o bpm manualmente"
          if (results.length > 0) {
            const bestBpm = results.find((r) => r.bpm)?.bpm;
            if (bestBpm && !userModifiedBpm) {
              setBpm(bestBpm);
            }
            // Se ainda não tiver alfinete fixado, posiciona no mapa as coordenadas da rua encontrada
            if (!localCoords && results[0]) {
              setLocalCoords({ lat: results[0].lat, lng: results[0].lng });
            }
          }
        } catch (e) {
          console.warn('Erro ao pesquisar endereço:', e);
        } finally {
          setIsSearchingAddress(false);
        }
      }, 350);
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setIsSearchingAddress(false);
    }
  };

  const handleSelectAddressSuggestion = (suggestion: AddressSuggestion) => {
    setLocalAbordagem(suggestion.formattedAddress);
    setLocalCoords({ lat: suggestion.lat, lng: suggestion.lng });
    if (suggestion.bpm) {
      setBpm(suggestion.bpm);
    }
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const handleApplyParsedData = (parsed: ParsedRecordData) => {
    if (parsed.nome) setNome(parsed.nome);
    if (parsed.mae) setMae(parsed.mae);
    if (parsed.dataNasc) setDataNasc(parsed.dataNasc);
    if (parsed.rg) setRg(parsed.rg);
    if (parsed.cpf) setCpf(formatCPF(parsed.cpf));
    if (parsed.alcunha) setAlcunha(parsed.alcunha);
    if (parsed.enderecos && parsed.enderecos.length > 0) {
      setEnderecos(parsed.enderecos);
      const matchedBpm = detectBPM(parsed.enderecos.join(' '));
      if (matchedBpm && !bpm) {
        setBpm(matchedBpm);
      }
    }
    if (parsed.artigos && parsed.artigos.length > 0) {
      setArtigos(parsed.artigos);
      setArtigo(parsed.artigos.join(', '));
    } else if (parsed.artigo) {
      setArtigo(parsed.artigo);
    }
    if (parsed.observacoes) {
      setObservacoes((prev) => (prev ? `${prev}\n${parsed.observacoes}` : parsed.observacoes));
    }
  };

  const handleNamePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && (pasted.includes('\n') || pasted.length > 50)) {
      const parsed = parseRawSuspectText(pasted);
      if (parsed.nome) {
        e.preventDefault();
        handleApplyParsedData(parsed);
        setSubmitFeedback({
          type: 'info',
          message: 'Texto assimilado com sucesso! Os campos foram preenchidos automaticamente.',
        });
        setTimeout(() => setSubmitFeedback(null), 3500);
      }
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
  };

  const handleCpfBlur = () => {
    if (cpf.trim()) {
      setCpf(formatCPF(cpf));
    }
  };

  const handleDataNascChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);

    if (val.length > 4) {
      val = val.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
    } else if (val.length > 2) {
      val = val.replace(/(\d{2})(\d{1,2})/, '$1/$2');
    }
    setDataNasc(val);
  };

  // Comparação de duplicidade por NOME, RG e CPF
  const checkDuplicate = (): SuspectRecord | null => {
    if (initialData || targetUpdateSuspect) return null; // Se estiver editando, não barra duplicidade dele mesmo

    const normNome = normalizeText(nome.trim());
    const cleanRg = rg.trim().replace(/\D/g, '');
    const cleanCpf = cpf.trim().replace(/\D/g, '');

    for (const suspect of existingSuspects) {
      const susNome = normalizeText(suspect.nome || '');
      const susRg = (suspect.rg || '').trim().replace(/\D/g, '');
      const susCpf = (suspect.cpf || '').trim().replace(/\D/g, '');

      // Comparação por Nome idêntico
      const sameNome = normNome.length > 4 && susNome === normNome;
      // Comparação por RG idêntico (se preenchido e com mais de 4 dígitos)
      const sameRg = cleanRg.length >= 5 && susRg.length >= 5 && cleanRg === susRg;
      // Comparação por CPF idêntico (se preenchido e com 11 dígitos)
      const sameCpf = cleanCpf.length === 11 && susCpf.length === 11 && cleanCpf === susCpf;

      if (sameNome || sameRg || sameCpf) {
        return suspect;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome do abordado é obrigatório';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Se for NOVO REGISTRO e ainda não confirmado para atualização: faz a checagem de duplicidade
    if (!isEditMode) {
      const duplicate = checkDuplicate();
      if (duplicate) {
        setDuplicateSuspect(duplicate);
        return;
      }
    }

    // Executa a persistência
    await executeSave(targetUpdateSuspect || (isEditMode ? initialData : null));
  };

  // Executa o salvamento com as regras operacionais da planilha
  const executeSave = async (existingTarget?: SuspectRecord | null) => {
    const cleanAddresses = enderecos.map((a) => a.trim().toUpperCase()).filter(Boolean);
    const joinedAddress = cleanAddresses.join(' | ');

    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');

    let finalId =
      existingTarget &&
      existingTarget.id &&
      existingTarget.id.trim() !== '' &&
      !existingTarget.id.startsWith('ai-queue-')
        ? existingTarget.id
        : `FT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let isOnlyPhotoChanged = false;
    let isDataChanged = false;
    let alteradoText: string | undefined = undefined;
    let dataAlteracaoFoto: string | undefined = undefined;

    if (existingTarget) {
      // Verifica se houve mudança nos dados de preenchimento
      const normOldNome = normalizeText(existingTarget.nome || '');
      const normNewNome = normalizeText(nome.trim());
      const normOldMae = normalizeText(existingTarget.mae || '');
      const normNewMae = normalizeText(mae.trim());
      const oldRg = (existingTarget.rg || '').trim();
      const newRg = rg.trim();
      const oldCpf = (existingTarget.cpf || '').trim();
      const newCpf = cpf.trim();
      const oldEnd = (existingTarget.endereco || '').trim();
      const newEnd = joinedAddress.trim();
      const oldAlcunha = normalizeText(existingTarget.alcunha || '');
      const newAlcunha = normalizeText(alcunha.trim());
      const oldObs = (existingTarget.observacoes || '').trim();
      const newObs = observacoes.trim();
      const oldArtigo = (existingTarget.artigo || '').trim().toUpperCase();
      const newArtigo = artigo.trim().toUpperCase();
      const oldLoc = (existingTarget.localAbordagem || '').trim().toUpperCase();
      const newLoc = localAbordagem.trim().toUpperCase();
      const oldNasc = (existingTarget.dataNasc || '').trim();
      const newNasc = dataNasc.trim();
      const oldMarcador = (existingTarget.marcador || 'NENHUM').toUpperCase();
      const newMarcador = (marcador || 'NENHUM').toUpperCase();
      const marcadorChanged = oldMarcador !== newMarcador;

      const textualDataChanged =
        normOldNome !== normNewNome ||
        normOldMae !== normNewMae ||
        oldRg !== newRg ||
        oldCpf !== newCpf ||
        oldEnd !== newEnd ||
        oldAlcunha !== newAlcunha ||
        oldObs !== newObs ||
        oldArtigo !== newArtigo ||
        oldLoc !== newLoc ||
        oldNasc !== newNasc;

      const oldPhotosCount = (existingTarget.fotos || []).length;
      const newPhotosCount = fotos.length;
      const photoChanged =
        oldPhotosCount !== newPhotosCount ||
        (fotos[0] && fotos[0] !== existingTarget.fotos?.[0]);

      // REGRA ATUALIZADA:
      // Quando o card for editado, não cria mais linha de backup na planilha, apenas atualiza
      // o mesmo registro no mesmo ID e sinaliza que o card foi editado.
      finalId = existingTarget.id;

      if (textualDataChanged) {
        isDataChanged = true;
        alteradoText = `EDITADO EM ${nowFormatted}`;
      } else if (photoChanged && !textualDataChanged) {
        isOnlyPhotoChanged = true;
        alteradoText = `FOTO ATUALIZADA EM ${nowFormatted}`;
        dataAlteracaoFoto = nowIso;
      } else if (marcadorChanged && !textualDataChanged && !photoChanged) {
        alteradoText = `MARCADOR ATUALIZADO PARA ${newMarcador} EM ${nowFormatted}`;
      } else {
        alteradoText = existingTarget.alterado || `EDITADO EM ${nowFormatted}`;
      }
    }

    const currentSession = getCurrentSession();
    const currentLogin = currentSession?.login || '';
    const currentNome = currentSession?.nome || '';

    const newRecord: SuspectRecord = {
      id: finalId,
      nome: nome.trim().toUpperCase(),
      mae: mae.trim().toUpperCase(),
      dataNasc: dataNasc.trim(),
      rg: rg.trim().toUpperCase(),
      cpf: formatCPF(cpf),
      endereco: joinedAddress,
      enderecos: cleanAddresses.length > 0 ? cleanAddresses : undefined,
      alcunha: alcunha.trim().toUpperCase(),
      marcador: marcador || 'NENHUM',
      artigo: artigo.trim().toUpperCase(),
      artigos: artigos.length > 0 ? artigos : undefined,
      localAbordagem: localAbordagem.trim().toUpperCase(),
      horaAbordagem: horaAbordagem.trim() || undefined,
      bpm: bpm.trim() ? bpm.trim().toUpperCase() : undefined,
      localAbordagemCoords: localCoords,
      coordenadas: localCoords ? `${localCoords.lat},${localCoords.lng}` : undefined,
      observacoes: observacoes.trim(),
      fotos: fotos,
      dataCriacao: existingTarget ? existingTarget.dataCriacao : nowIso,
      dataAtualizacao: nowIso,
      dataAlteracaoFoto: dataAlteracaoFoto || (existingTarget?.dataAlteracaoFoto),
      alterado: alteradoText || (existingTarget?.alterado) || `EDITADO EM ${nowFormatted}`,
      autorCriacaoLogin: existingTarget
        ? (existingTarget.autorCriacaoLogin || currentLogin || '1779958')
        : (currentLogin || '1779958'),
      autorCriacaoNome: existingTarget
        ? (existingTarget.autorCriacaoNome || currentNome || 'Banco de Dados')
        : (currentNome || 'Banco de Dados'),
      autorAlteracaoLogin: existingTarget ? currentLogin : undefined,
      autorAlteracaoNome: existingTarget ? currentNome : undefined,
    };

    setIsSubmitting(true);
    setSubmitFeedback(null);

    const previousId = existingTarget ? existingTarget.id : undefined;

    // Conclusão do salvamento
    const finishSave = () => {
      onSave(newRecord, previousId);
      setIsSubmitting(false);
      onClose();
    };

    const config = getSyncConfig();
    if (config.autoSync && config.webhookUrl) {
      setSubmitFeedback({
        type: 'info',
        message: existingTarget
          ? 'Salvando alterações no banco de dados em nuvem...'
          : 'Salvando novo registro no banco de dados em nuvem...',
      });

      try {
        const result = await sendSuspectToGoogleSheets(newRecord, config.webhookUrl);
        if (result.success) {
          setSubmitFeedback({
            type: 'success',
            message: 'Salvo com sucesso no aplicativo e sincronizado no banco de dados em nuvem!',
          });
          setTimeout(() => {
            finishSave();
          }, 800);
          return;
        } else {
          setSubmitFeedback({
            type: 'warning',
            message: 'Salvo com sucesso no dispositivo! Sincronização na nuvem pendente.',
          });
          setTimeout(() => {
            finishSave();
          }, 1200);
          return;
        }
      } catch (err: any) {
        setSubmitFeedback({
          type: 'warning',
          message: 'Salvo localmente no dispositivo! A sincronização ocorrerá assim que restabelecer conexão.',
        });
        setTimeout(() => {
          finishSave();
        }, 1200);
        return;
      }
    }

    finishSave();
  };

  // Quando o usuário aceita alterar o cadastro duplicado existente
  const handleConfirmUpdateDuplicate = () => {
    if (!duplicateSuspect) return;
    setTargetUpdateSuspect(duplicateSuspect);
    setDuplicateSuspect(null);
    setSubmitFeedback({
      type: 'info',
      message: `Modo de Atualização ativado para "${duplicateSuspect.nome}". Altere a foto ou os dados e clique em Atualizar Cadastro.`,
    });
  };

  const activeDisplayCoords = localCoords || defaultCoords;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="record-form-modal"
        className="relative w-full max-w-xl my-auto bg-[#10141d] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-neutral-800/90 bg-[#141822]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c69c59]/15 border border-[#c69c59]/40 flex items-center justify-center text-[#e5c07b]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                {isEditMode ? 'Editar Registro de Abordado' : 'Novo Registro de Abordado'}
              </h2>
              <span className="text-[10px] text-[#c69c59] font-mono block">
                BANCO DE DADOS
              </span>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-form-x"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Feedback no topo (erro, aviso ou sucesso) */}
          {submitFeedback && (
            <div
              id="top-feedback-banner"
              className={`p-3 rounded-xl border flex items-start gap-2.5 shadow-md animate-fadeIn ${
                submitFeedback.type === 'error'
                  ? 'border-red-500/80 bg-red-950/90 text-red-200'
                  : submitFeedback.type === 'success'
                  ? 'border-emerald-500/80 bg-emerald-950/90 text-emerald-200'
                  : 'border-[#c69c59]/80 bg-[#172033] text-[#e5c07b]'
              }`}
            >
              {submitFeedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              ) : submitFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#e5c07b] flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-[11px] leading-snug">
                <span>{submitFeedback.message}</span>
              </div>
            </div>
          )}

          {/* Aviso se estiver atualizando cadastro que estava duplicado */}
          {targetUpdateSuspect && (
            <div className="p-3 rounded-xl border border-[#c69c59]/80 bg-[#1c2230] text-[#e5c07b] flex items-center gap-2.5 animate-fadeIn">
              <Edit3 className="w-4 h-4 text-[#c69c59] flex-shrink-0" />
              <div className="text-[11px]">
                <strong className="block">Atualização de Cadastro Existente</strong>
                <span>
                  Você está atualizando os dados/foto de{' '}
                  <strong className="text-white">{targetUpdateSuspect.nome}</strong>.
                </span>
              </div>
            </div>
          )}

          {/* 1. SEÇÃO DE FOTOS */}
          <div className="space-y-2 p-3 rounded-xl bg-[#141822] border border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                Fotografia do Abordado
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
              </span>
            </div>

            <input
              type="file"
              ref={cameraInputRef}
              onChange={handlePhotoCapture}
              accept="image/*"
              capture="environment"
              className="hidden"
            />
            <input
              type="file"
              ref={galleryInputRef}
              onChange={handlePhotoCapture}
              accept="image/*"
              multiple
              className="hidden"
            />
            {/* Botão de Câmera: Cor sólida e MAIOR conforme diretriz operacional */}
            <button
              type="button"
              id="btn-open-camera-capture"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-3.5 px-4 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] active:scale-[0.98] text-neutral-950 font-black text-sm flex items-center justify-center gap-3 transition-all shadow-lg shadow-[#c69c59]/20 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-black/15 flex items-center justify-center text-neutral-950 flex-shrink-0">
                <Camera className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="text-left leading-tight">
                <span className="block font-black tracking-wide uppercase text-xs sm:text-sm">
                  ABRIR CÂMERA
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-950/80">
                  Toque para fotografar o abordado
                </span>
              </div>
            </button>

            {fotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {fotos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative aspect-[3/4] rounded-lg overflow-hidden border border-neutral-700 bg-black group"
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/80 hover:bg-red-900 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                    {index === 0 && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono text-[#c69c59]">
                        Principal
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Botão de Galeria: Mais DISCRETO e MENOR que o botão da câmera */}
            <div className="flex justify-center pt-0.5">
              <button
                type="button"
                id="btn-load-gallery-image"
                onClick={() => galleryInputRef.current?.click()}
                className="py-1.5 px-3 rounded-lg border border-neutral-700/80 hover:border-neutral-500 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 font-medium text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                <span>Carregar da galeria</span>
              </button>
            </div>
          </div>

          {/* MARCADOR OPERACIONAL: Apenas em cards já lançados (modo edição) */}
          {(initialData || targetUpdateSuspect) && (
            <div className="p-3 rounded-xl bg-[#141822] border border-[#c69c59]/40 space-y-2 animate-fadeIn">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#e5c07b]">
                Marcador Operacional (Atualização Cadastral)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                <button
                  type="button"
                  id="btn-marcador-nenhum"
                  onClick={() => setMarcador('NENHUM')}
                  className={`py-2 px-1.5 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                    marcador === 'NENHUM'
                      ? 'bg-neutral-800 border-neutral-500 text-white'
                      : 'bg-[#10141d] border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Nenhum
                </button>
                <button
                  type="button"
                  id="btn-marcador-preso"
                  onClick={() => setMarcador('PRESO')}
                  className={`py-2 px-1.5 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                    marcador === 'PRESO'
                      ? 'bg-slate-500/90 border-slate-300 text-white font-black shadow-md'
                      : 'bg-[#10141d] border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                  title="Preso (Mescla cinza mais claro)"
                >
                  Preso
                </button>
                <button
                  type="button"
                  id="btn-marcador-alvo"
                  onClick={() => setMarcador('ALVO_PRIORITARIO')}
                  className={`py-2 px-1.5 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                    marcador === 'ALVO_PRIORITARIO'
                      ? 'bg-[#6b3d22] border-[#a85a2c] text-amber-100 font-black shadow-md'
                      : 'bg-[#10141d] border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                  title="Alvo Prioritário (Tom amarronzado)"
                >
                  Alvo Prioritário
                </button>
                <button
                  type="button"
                  id="btn-marcador-foragido"
                  onClick={() => setMarcador('FORAGIDO')}
                  className={`py-2 px-1.5 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                    marcador === 'FORAGIDO'
                      ? 'bg-yellow-400 border-yellow-300 text-neutral-950 font-black shadow-md'
                      : 'bg-[#10141d] border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                  title="Foragido (Cor amarela)"
                >
                  Foragido
                </button>
                <button
                  type="button"
                  id="btn-marcador-morto"
                  onClick={() => setMarcador('MORTO')}
                  className={`py-2 px-1.5 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                    marcador === 'MORTO'
                      ? 'bg-rose-950/90 border-rose-500 text-rose-200 font-black shadow-md'
                      : 'bg-[#10141d] border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                  title="Morto (Cor vermelha)"
                >
                  Morto
                </button>
              </div>
            </div>
          )}

          {/* 2. Nome do Abordado com botão compacto de parser inteligente */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                Nome do Abordado <span className="text-[#c69c59]">*</span>
              </label>
              <button
                type="button"
                id="btn-open-parser-header"
                onClick={() => setIsParserOpen(true)}
                className="inline-flex items-center gap-1 text-[10px] text-[#e5c07b] hover:text-white transition-colors cursor-pointer"
                title="Colar texto bruto para preenchimento inteligente"
              >
                <ClipboardPaste className="w-3 h-3 text-[#c69c59]" />
                <span>Colar Ficha Bruta</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-open-parser-input"
                onClick={() => setIsParserOpen(true)}
                className="p-2 rounded-lg bg-[#182030] hover:bg-[#222c42] border border-[#c69c59]/50 hover:border-[#c69c59] text-[#e5c07b] transition-all shadow-sm active:scale-95 cursor-pointer flex-shrink-0"
                title="Colar texto bruto da ficha (NOME, MAE, RG, CPF, etc.)"
              >
                <ClipboardPaste className="w-4 h-4 text-[#c69c59]" />
              </button>
              <input
                type="text"
                id="input-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onPaste={handleNamePaste}
                placeholder="NOME COMPLETO (ou cole o texto da ficha aqui)"
                className="flex-1 px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase transition-colors"
                required
              />
            </div>
            {errors.nome && <span className="text-red-400 text-[11px] mt-1 block">{errors.nome}</span>}
          </div>

          {/* 3. Nome da Mãe & Data de Nascimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
                Nome da Mãe
              </label>
              <input
                type="text"
                id="input-mae"
                value={mae}
                onChange={(e) => setMae(e.target.value)}
                placeholder="NOME DA MÃE"
                className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
                Data de Nascimento
              </label>
              <input
                type="text"
                id="input-data-nasc"
                value={dataNasc}
                onChange={handleDataNascChange}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* 4. RG & CPF: Placeholder do RG alterado para "0000000" */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
                RG
              </label>
              <input
                type="text"
                id="input-rg"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                placeholder="0000000"
                className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
                CPF
              </label>
              <input
                type="text"
                id="input-cpf"
                value={cpf}
                onChange={handleCpfChange}
                onBlur={handleCpfBlur}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* 5. Endereço & Alcunha: Label "Endereço" e botão "+Add Endereço" */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
                Alcunha (Apelido)
              </label>
              <input
                type="text"
                id="input-alcunha"
                value={alcunha}
                onChange={(e) => setAlcunha(e.target.value)}
                placeholder="EX: ZECA, MAGRO"
                className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase transition-colors"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                  Endereço
                </label>
                <button
                  type="button"
                  id="btn-add-address"
                  onClick={handleAddAddress}
                  className="text-[10px] text-[#e5c07b] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                >
                  <Plus className="w-3 h-3" />
                  <span>+Add Endereço</span>
                </button>
              </div>
              <div className="space-y-1.5">
                {enderecos.map((addr, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={addr}
                      onChange={(e) => handleAddressChange(index, e.target.value)}
                      placeholder={`Endereço ${index + 1}`}
                      className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase transition-colors placeholder:text-neutral-500"
                    />
                    {enderecos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAddress(index)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-300 transition-colors cursor-pointer flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6. Artigo Penal com Tags e Autocomplete Inteligente (Até 30 crimes) */}
          <ArticleAutocomplete
            articles={artigos}
            value={artigo}
            maxArticles={30}
            onChange={(updatedArticles, joined) => {
              setArtigos(updatedArticles);
              setArtigo(joined);
            }}
            id="input-artigo"
          />

          {/* 7. OBSERVAÇÕES: Posicionado ACIMA do campo Local da Abordagem conforme solicitado */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-1">
              Observações
            </label>
            <textarea
              id="textarea-observacoes"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações complementares de campo, antecedentes, comparsas, tatuagens, rotas..."
              className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors resize-y min-h-[90px]"
            />
          </div>

          {/* 8. LOCAL DA ABORDAGEM & MAPA SEMPRE VISÍVEL */}
          <div className="space-y-2 p-3 rounded-xl bg-[#141822] border border-neutral-800">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#c69c59]" />
                <span>Local da Abordagem & Hora</span>
              </label>

              {/* Botões compactos: Apenas ícones (Localização + Abrir no Maps + Limpar) */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-get-phone-location"
                  onClick={handleGetLocation}
                  disabled={isLocating}
                  className="p-1.5 rounded-lg bg-[#1a202d] hover:bg-[#222b3d] text-[#e5c07b] border border-[#c69c59]/50 hover:border-[#c69c59] transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center"
                  title="Localização GPS (Capturar endereço e BPM automaticamente)"
                >
                  {isLocating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#c69c59]" />
                  ) : (
                    <MapPin className="w-4 h-4 text-[#c69c59]" />
                  )}
                </button>

                {/* Abrir no Maps ao lado de Localização - Compacto apenas ícone */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${activeDisplayCoords.lat},${activeDisplayCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#202c44] text-[#e5c07b] border border-[#c69c59]/40 transition-colors cursor-pointer flex items-center justify-center"
                  title="Abrir no Google Maps"
                >
                  <ExternalLink className="w-4 h-4 text-[#e5c07b]" />
                </a>

                {/* Limpar ao lado de Localização - Compacto apenas ícone: limpa alfinete, endereço e BPM */}
                {(localCoords || localAbordagem || bpm) && (
                  <button
                    type="button"
                    id="btn-clear-location"
                    onClick={() => {
                      setLocalCoords(undefined);
                      setLocalAbordagem('');
                      setBpm('');
                      setUserModifiedBpm(false);
                      setShowSuggestions(false);
                      setAddressSuggestions([]);
                    }}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-colors cursor-pointer flex items-center justify-center"
                    title="Limpar endereço de abordagem, BPM e alfinete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {geoError && (
              <div className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/60 rounded-lg p-2 flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                <span>{geoError}</span>
              </div>
            )}

            {/* Linha com Local da abordagem e quadrado compacto do BPM à direita */}
            <div className="flex items-start gap-2">
              <div className="relative flex-1" ref={addressDropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    id="input-local-abordagem"
                    value={localAbordagem}
                    onChange={(e) => handleLocalAbordagemChange(e.target.value)}
                    onFocus={() => {
                      if (addressSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowSuggestions(false);
                      }
                    }}
                    placeholder="Ex: RUA TIRADENTES, Nº 450 - CENTRO (ou digite o nome da rua)"
                    className="w-full px-3 py-2 pr-8 rounded-lg bg-[#10141d] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase transition-colors placeholder:text-neutral-500"
                  />
                  {isSearchingAddress && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c69c59]" />
                    </div>
                  )}
                </div>

                {/* Dropdown de sugestões do Maps enquanto digita - Opcional para o operador */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#141923] border border-[#c69c59]/70 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md animate-fadeIn max-h-64 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-[#0f131a] border-b border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400">
                      <span className="flex items-center gap-1.5 font-semibold text-[#f5d799]">
                        <MapPin className="w-3 h-3 text-[#c69c59]" />
                        Sugestões no Maps (opcional selecionar ou continuar digitando)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSuggestions(false)}
                        className="text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
                        title="Fechar sugestões"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="divide-y divide-neutral-800/80">
                      {addressSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectAddressSuggestion(item);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#1d2535] transition-colors flex items-start gap-2.5 group cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#c69c59] flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-xs font-semibold truncate group-hover:text-[#f5d799]">
                              {item.formattedAddress}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                              {item.suburb && <span>Bairro: {item.suburb}</span>}
                              {item.bpm && (
                                <span className="px-1.5 py-0.2 rounded bg-[#0b0e14] text-[#f5d799] border border-[#c69c59]/50 font-bold">
                                  Área do {item.bpm}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Hora da Abordagem - Substitui o Batalhão conforme solicitação mantendo o restante do local */}
              <div
                className="w-28 sm:w-32 flex-shrink-0"
                title="Hora exata da abordagem (ex: 14:30) - Preenchimento automático ou ajustável manualmente"
              >
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#c69c59]">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="time"
                    id="input-hora-abordagem"
                    value={horaAbordagem}
                    onChange={(e) => setHoraAbordagem(e.target.value)}
                    className="w-full pl-7 pr-2 py-2 rounded-lg bg-[#161d2b] border border-[#c69c59]/70 text-[#f5d799] font-bold text-center text-xs outline-none focus:border-[#e5c07b] font-mono tracking-wider shadow-inner"
                  />
                </div>
              </div>
            </div>

            {/* MAPA DO GOOGLE MAPS SEMPRE VISÍVEL: Coordenadas e alfinete estritamente bloqueados para edição manual */}
            <div className="space-y-1.5 pt-1.5 border-t border-neutral-800/80">
              <div className="relative w-full h-44 sm:h-48 rounded-xl overflow-hidden border border-[#c69c59]/50 shadow-md bg-black">
                <iframe
                  title="Google Maps Alfinete Abordagem"
                  width="100%"
                  height="100%"
                  style={{ border: 0, pointerEvents: 'auto' }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  src={`https://maps.google.com/maps?q=${activeDisplayCoords.lat},${activeDisplayCoords.lng}&hl=pt-BR&z=17&output=embed`}
                />
              </div>

              {/* Coordenadas estritamente bloqueadas para edição manual */}
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 pt-0.5">
                <div className="flex items-center gap-1.5 text-[#e5c07b]">
                  <Lock className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                  <span>
                    GPS: {activeDisplayCoords.lat.toFixed(6)}, {activeDisplayCoords.lng.toFixed(6)}{' '}
                    <span className="text-neutral-500">(Bloqueado)</span>
                  </span>
                </div>
                <span className="text-emerald-400">
                  📍 Alfinete fixado via GPS
                </span>
              </div>
            </div>
          </div>

          {/* Feedback Visual de Envio */}
          {submitFeedback && (
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-fadeIn ${
                submitFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : submitFeedback.type === 'error'
                  ? 'bg-red-950/80 border-red-500 text-red-300'
                  : 'bg-[#182232] border-[#3b82f6] text-[#93c5fd]'
              }`}
            >
              {submitFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : submitFeedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />
              )}
              <span>{submitFeedback.message}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
            <button
              type="button"
              id="btn-cancel-form"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-transparent hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-save-record"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer disabled:opacity-75 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando no banco de dados em nuvem...</span>
                </>
              ) : (
                <span>{isEditMode ? 'Atualizar Registro' : 'Salvar Registro'}</span>
              )}
            </button>
          </div>
        </form>

        {/* DIÁLOGO DE DUPLICIDADE (CAIXA DE DIÁLOGO IMPEDINDO CADASTRO E OFERECENDO ATUALIZAÇÃO) */}
        {duplicateSuspect && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="duplicate-dialog"
              className="w-full max-w-md bg-[#121620] border-2 border-amber-500/80 rounded-2xl p-5 shadow-2xl space-y-4 animate-scaleUp"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <ShieldAlert className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                    Cadastro Já Existente
                  </h3>
                  <span className="text-[11px] text-amber-400 font-mono block">
                    Duplicidade Detectada no Banco de Dados
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#181e2b] border border-neutral-700/80 space-y-2 text-xs">
                <p className="text-neutral-200 leading-relaxed">
                  Não é possível adicionar este indivíduo como um novo registro, pois ele{' '}
                  <strong className="text-amber-400">já consta em nosso banco de dados</strong>:
                </p>
                <div className="bg-[#10141d] p-2.5 rounded-lg border border-neutral-800 space-y-1 font-mono text-[11px]">
                  <div className="text-white font-bold uppercase">{duplicateSuspect.nome}</div>
                  {duplicateSuspect.mae && (
                    <div className="text-neutral-400">Mãe: {duplicateSuspect.mae}</div>
                  )}
                  <div className="text-neutral-400">
                    RG: {duplicateSuspect.rg || 'Não cadastrado'} | CPF:{' '}
                    {duplicateSuspect.cpf || 'Não cadastrado'}
                  </div>
                </div>
                <p className="text-neutral-300 text-[11px] pt-1">
                  Deseja <strong className="text-[#e5c07b]">alterar/atualizar o cadastro</strong> existente?
                  Você poderá atualizar com uma foto mais recente ou alterar dados cadastrais.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  id="btn-cancel-duplicate"
                  onClick={() => setDuplicateSuspect(null)}
                  className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  id="btn-confirm-duplicate-update"
                  onClick={handleConfirmUpdateDuplicate}
                  className="px-4 py-2 rounded-lg bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-neutral-950" />
                  <span>Sim, Atualizar Cadastro</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal de Preenchimento Inteligente via Parser de Texto Bruto */}
        <ParserModal
          isOpen={isParserOpen}
          onClose={() => setIsParserOpen(false)}
          onApply={handleApplyParsedData}
        />
      </div>
    </div>
  );
};
