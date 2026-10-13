import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SuspectRecord, SuspectMarcador } from './types';
import {
  getAllSuspects,
  saveSuspect,
  deleteSuspect,
  replaceAllSuspectsInStorage,
  clearLocalCache,
  getSyncConfig,
} from './utils/storage';
import {
  sendSuspectToGoogleSheets,
  searchSuspectsInGoogleSheets,
  deleteSuspectFromGoogleSheets,
  API_URL,
} from './utils/googleSheetsApi';
import {
  getActiveBackendProvider,
  setActiveBackendProvider,
  BackendProvider,
  fetchSuspectsFromCloudflare,
  saveSuspectToCloudflare,
  deleteSuspectFromCloudflare,
} from './utils/cloudflareApi';
import {
  subscribeToCloudSuspects,
  saveSuspectToRealtimeCloud,
  deleteSuspectFromRealtimeCloud,
  flushOfflineQueueToCloud,
  getPendingOfflineCount,
} from './utils/firebaseSync';
import { matchesSuspect, normalizeText } from './utils/textUtils';
import { Header, ViewportMode } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { SuspectCard } from './components/SuspectCard';
import { DetailModal } from './components/DetailModal';
import { RecordFormModal } from './components/RecordFormModal';
import { DeleteAuthModal } from './components/DeleteAuthModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { CloudflareModal } from './components/CloudflareModal';
import { GitHubModal } from './components/GitHubModal';
import { deleteAbordagensBySuspectId } from './utils/abordagensStorage';
import { FloatingActionButton } from './components/FloatingActionButton';
import { SecurityModal } from './components/SecurityModal';
import { SettingsModal, CardViewMode } from './components/SettingsModal';
import { FilterModal, FilterCriteria } from './components/FilterModal';
import { OrcrimModal } from './components/OrcrimModal';
import { UserManagementModal } from './components/UserManagementModal';
import { AuthFlowModal } from './components/AuthFlowModal';
import { getCurrentSession, UserSession, logoutUser } from './utils/userAuth';
import { PullToRefresh } from './components/PullToRefresh';
import {
  ShieldAlert,
  Plus,
  ShieldCheck,
  Filter,
  LayoutGrid,
  Grid3X3,
  List,
  Layers,
  X,
  MapPin,
  Tag,
  FileText,
  WifiOff,
  Cloud,
  RefreshCw,
  LogOut,
  ChevronUp,
  Zap,
  Skull,
  Lock,
  Crosshair,
  AlertTriangle,
} from 'lucide-react';
import { getInitialTheme, applyTheme, ThemeMode } from './utils/theme';
import { PWAInstallModal, DONT_SHOW_INSTALL_KEY } from './components/PWAInstallModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { usePWAInstall } from './utils/usePWAInstall';
import {
  NavigationModuleBar,
  NavigationModule,
  BarPosition,
} from './components/NavigationModuleBar';
import { AbordagensPreviewModal } from './components/AbordagensPreviewModal';
import { FacialRecognitionModal } from './components/FacialRecognitionModal';
import { SmartImportModal } from './components/SmartImportModal';
import { AiMultiReviewModal } from './components/AiMultiReviewModal';
import { WebCommandBar } from './components/WebCommandBar';
import { ScanFace } from 'lucide-react';
import { getAllOrcrims } from './utils/orcrimStorage';

export default function App() {
  const [suspects, setSuspects] = useState<SuspectRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SuspectRecord[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Importador Inteligente e Revisão em Lote por IA
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [isMultiReviewOpen, setIsMultiReviewOpen] = useState(false);
  const [multiReviewCandidates, setMultiReviewCandidates] = useState<any[]>([]);

  // Provedor de Nuvem: 'cloudflare' (D1 SQL/R2) ou 'google_sheets' (Apps Script)
  const [activeProvider, setActiveProvider] = useState<BackendProvider>(() => getActiveBackendProvider());

  // Detecção Automática Celular vs Web
  const detectDeviceMode = (): 'mobile' | 'web' => {
    if (typeof window === 'undefined') return 'web';
    return window.innerWidth < 768 ? 'mobile' : 'web';
  };

  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => {
    return detectDeviceMode();
  });

  useEffect(() => {
    const handleResize = () => {
      setViewportMode(detectDeviceMode());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleChangeViewportMode = (mode: ViewportMode) => {
    setViewportMode(mode);
    try {
      localStorage.setItem('ft_viewport_mode', mode);
    } catch (_) {}
  };

  // Modals state
  const [isCloudflareModalOpen, setIsCloudflareModalOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  // Tema: Padrão inicial Dark conforme exigência
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleChangeTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  // Modals state
  const [selectedSuspect, setSelectedSuspect] = useState<SuspectRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSuspect, setEditingSuspect] = useState<SuspectRecord | null>(null);
  const [suspectToDelete, setSuspectToDelete] = useState<SuspectRecord | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isOrcrimModalOpen, setIsOrcrimModalOpen] = useState(false);
  const [orcrimInitialTab, setOrcrimInitialTab] = useState<'visao_geral' | 'organograma'>('visao_geral');
  const [totalOrcrimsCount, setTotalOrcrimsCount] = useState<number>(0);
  const [isAbordagensPreviewOpen, setIsAbordagensPreviewOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<NavigationModule>('cadastrados');
  const [barPosition, setBarPosition] = useState<BarPosition>(() => {
    try {
      const saved = localStorage.getItem('ft_bar_position');
      if (saved === 'above' || saved === 'below') return saved;
    } catch (_) {}
    return 'below';
  });

  const handleChangeBarPosition = (pos: BarPosition) => {
    setBarPosition(pos);
    try {
      localStorage.setItem('ft_bar_position', pos);
    } catch (_) {}
  };

  const [isFacialRecognitionOpen, setIsFacialRecognitionOpen] = useState(false);
  const [facialInitialSuspect, setFacialInitialSuspect] = useState<SuspectRecord | null>(null);

  const handleOpenFacialRecognition = (suspect?: SuspectRecord) => {
    setFacialInitialSuspect(suspect || null);
    setIsFacialRecognitionOpen(true);
  };

  const handleSelectModule = (mod: NavigationModule) => {
    setActiveModule(mod);
    if (mod === 'cadastrados') {
      // Retorna para listagem geral
    } else if (mod === 'abordagens') {
      setIsAbordagensPreviewOpen(true);
    } else if (mod === 'orcrim') {
      setOrcrimInitialTab('visao_geral');
      setIsOrcrimModalOpen(true);
    } else if (mod === 'organograma') {
      setOrcrimInitialTab('organograma');
      setIsOrcrimModalOpen(true);
    } else if (mod === 'facial') {
      handleOpenFacialRecognition();
    }
  };

  useEffect(() => {
    const updateCount = () => {
      getAllOrcrims().then((list) => {
        setTotalOrcrimsCount(list.length);
      });
    };
    updateCount();
    const handleUpdate = (e: any) => {
      if (Array.isArray(e.detail)) {
        setTotalOrcrimsCount(e.detail.length);
      } else {
        updateCount();
      }
    };
    window.addEventListener('orcrim_updated', handleUpdate);
    return () => window.removeEventListener('orcrim_updated', handleUpdate);
  }, [isOrcrimModalOpen]);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(() => getCurrentSession());
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Status de Conexão à Nuvem e Fila de Sincronização Offline
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() =>
    getPendingOfflineCount()
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueueToCloud().then((count) => {
        setPendingOfflineCount(getPendingOfflineCount());
        if (count > 0) {
          setSyncToast(`☁️ Conectado! ${count} registro(s) sincronizado(s) com a nuvem automaticamente.`);
          setTimeout(() => setSyncToast(null), 4000);
        }
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncToast('📱 Modo Offline: Registros serão salvos temporariamente no celular e enviados ao reconectar.');
      setTimeout(() => setSyncToast(null), 4500);
    };
    const handleStatusChanged = () => {
      setPendingOfflineCount(getPendingOfflineCount());
    };
    const handleNotice = (e: any) => {
      if (e.detail) {
        setSyncToast(`☁️ ${e.detail}`);
        setTimeout(() => setSyncToast(null), 4000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('cloud_sync_status_changed', handleStatusChanged);
    window.addEventListener('cloud_sync_notice', handleNotice);

    // 1. Assina o banco em nuvem Firestore em tempo real
    // Todo e qualquer celular conectado refletirá as mudanças instantaneamente quando no modo Firestore
    const unsubscribeCloud = subscribeToCloudSuspects(
      (cloudList) => {
        const currentProvider = getActiveBackendProvider();
        if (currentProvider !== 'cloudflare' && Array.isArray(cloudList) && cloudList.length > 0) {
          setSuspects(cloudList);
          replaceAllSuspectsInStorage(cloudList);
          setLoading(false);
        }
      },
      (err) => {
        console.warn('Operando temporariamente em cache offline:', err);
      }
    );

    // 2. Se houver registros pendentes acumulados sem internet, envia para a nuvem
    if (navigator.onLine) {
      flushOfflineQueueToCloud().then((count) => {
        setPendingOfflineCount(getPendingOfflineCount());
        if (count > 0) {
          setSyncToast(`${count} registro(s) sincronizado(s) com a nuvem.`);
          setTimeout(() => setSyncToast(null), 4000);
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('cloud_sync_status_changed', handleStatusChanged);
      window.removeEventListener('cloud_sync_notice', handleNotice);
      unsubscribeCloud();
    };
  }, []);

  // Paginação inteligente sob demanda: 50 cards iniciais com carregamento infinito ao rolar a página
  const CARDS_PER_PAGE = 50;
  const [visibleCount, setVisibleCount] = useState<number>(CARDS_PER_PAGE);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Estados dos Pop-ups de Transição ao Sair e ao Entrar
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [pendingLoginSession, setPendingLoginSession] = useState<UserSession | null>(null);

  const handleLogout = () => {
    setIsLoggingOut(true);
    setIsSettingsOpen(false);
    setIsUserManagementOpen(false);
    setIsOrcrimModalOpen(false);
    setIsAbordagensPreviewOpen(false);
    setIsFilterModalOpen(false);
    setSelectedSuspect(null);

    setTimeout(() => {
      logoutUser();
      setUserSession(null);
      setIsLoggingOut(false);
      setSyncToast('Sessão encerrada com segurança.');
      setTimeout(() => setSyncToast(null), 3000);
    }, 1100);
  };

  const handleLoginSuccess = (session: UserSession) => {
    setPendingLoginSession(session);
    setIsLoggingIn(true);

    setTimeout(() => {
      setUserSession(session);
      setIsLoggingIn(false);
      setPendingLoginSession(null);
      setVisibleCount(CARDS_PER_PAGE);
      setSyncToast(`Bem-vindo, ${session.nome}!`);
      setTimeout(() => setSyncToast(null), 3500);
    }, 1100);
  };

  // Hook de instalação do PWA
  const { isInstalled, isMobile } = usePWAInstall();

  // Quando o app é aberto (na web ou no app, especialmente no celular), oferece a opção de instalar e adicionar atalho
  useEffect(() => {
    // Se o usuário já marcou a opção para "não exibir novamente"
    try {
      if (localStorage.getItem(DONT_SHOW_INSTALL_KEY) === 'true') {
        return;
      }
    } catch (_) {}

    // Se ainda não estiver instalado como app independente (standalone)
    if (!isInstalled) {
      const alreadyOffered = sessionStorage.getItem('ft_install_offered_session');
      if (!alreadyOffered) {
        // Exibe o diálogo de instalação suavemente após 1.5s ao carregar
        const timer = setTimeout(() => {
          setIsInstallModalOpen(true);
          sessionStorage.setItem('ft_install_offered_session', 'true');
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isInstalled]);

  // Filtros avançados: Bairros de BH (com contagem), Marcadores e Artigos
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    bairro: '',
    marcador: 'TODOS',
    artigo: '',
  });

  // Modo de visualização dos cards (Padrão: Detalhes Compacto conforme exigência)
  const [viewMode, setViewMode] = useState<CardViewMode>('compact');

  const handleChangeViewMode = (mode: CardViewMode) => {
    setViewMode(mode);
  };

  // Carrega registros da nuvem (Cloudflare D1 ou Google Sheets) em tempo real: FONTE ÚNICA DA VERDADE
  const refreshRecordsFromCloud = useCallback(async () => {
    setIsRefreshing(true);
    const provider = getActiveBackendProvider();
    setActiveProvider(provider);

    try {
      let cloudData: { success: boolean; data: SuspectRecord[]; message?: string };

      if (provider === 'cloudflare') {
        cloudData = await fetchSuspectsFromCloudflare('');
      } else {
        cloudData = await searchSuspectsInGoogleSheets('');
      }

      if (cloudData.success && Array.isArray(cloudData.data)) {
        const activeList = cloudData.data;

        if (activeList.length > 0) {
          // Nuvem retornou registros ativos: espelha na tela e no storage local
          setSuspects(activeList);
          await replaceAllSuspectsInStorage(activeList);
        } else {
          // Se a nuvem respondeu vazia (ex: conexão nova), preserva os dados locais do dispositivo
          const local = await getAllSuspects();
          if (local.length > 0) {
            console.log('[App] Preservando registros locais do dispositivo:', local.length);
            setSuspects(local);
          } else {
            setSuspects([]);
          }
        }

        const providerLabel = provider === 'cloudflare' ? 'Cloudflare D1' : 'Banco de Dados em Nuvem';
        setSyncToast(
          activeList.length > 0
            ? `${activeList.length} abordados carregados via ${providerLabel}.`
            : `${providerLabel} conectado.`
        );
        setTimeout(() => setSyncToast(null), 3500);
      } else {
        const providerLabel = provider === 'cloudflare' ? 'Cloudflare D1' : 'Banco de Dados em Nuvem';
        console.warn(`Aviso de conexão (${providerLabel}):`, cloudData.message);

        // Se a nuvem ainda não foi configurada ou falhar temporariamente, preserva dados locais
        const local = await getAllSuspects();
        if (local.length > 0) {
          setSuspects(local);
        }

        setSyncToast(`⚠️ Conexão (${providerLabel}): ${cloudData.message || 'Verifique a URL ou conexão de rede'}`);
        setTimeout(() => setSyncToast(null), 5000);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados na nuvem:', err);
      const local = await getAllSuspects();
      if (local.length > 0) {
        setSuspects(local);
      }
      setSyncToast('⚠️ Falha de conexão: Não foi possível obter os dados da nuvem.');
      setTimeout(() => setSyncToast(null), 5000);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Carrega imediatamente os dados locais persistidos no dispositivo
    getAllSuspects().then((local) => {
      if (local.length > 0) {
        setSuspects(local);
        setLoading(false);
      }
    });

    // 2. Consulta à nuvem para sincronização
    refreshRecordsFromCloud();
  }, [refreshRecordsFromCloud]);

  // Executa busca remota via GET (Cloudflare D1 ou Google Sheets)
  const executeRemoteSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const provider = getActiveBackendProvider();
    try {
      const res = provider === 'cloudflare'
        ? await fetchSuspectsFromCloudflare(trimmed)
        : await searchSuspectsInGoogleSheets(trimmed);

      if (res.success) {
        setSearchResults(res.data);
      } else {
        console.warn('Falha na busca remota:', res.message);
        setSearchResults(null);
      }
    } catch (err) {
      console.error('Erro na pesquisa remota:', err);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce automático da pesquisa ao digitar
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      executeRemoteSearch(searchQuery);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery, executeRemoteSearch]);

  // Aplicação combinada da busca textual e dos filtros avançados (Bairro BH, Marcador, Artigo)
  const displayedSuspects = useMemo(() => {
    // 1. Base inicial: pesquisa textual ou todos os suspeitos
    let base = searchQuery.trim()
      ? (searchResults !== null ? searchResults : suspects.filter((s) => matchesSuspect(s, searchQuery)))
      : suspects;

    // 2. Filtro de Bairro de Belo Horizonte
    if (filterCriteria.bairro) {
      const normBairro = normalizeText(filterCriteria.bairro);
      base = base.filter((s) => {
        const fullEnd = normalizeText(
          `${s.endereco || ''} ${(s.enderecos || []).join(' ')}`
        );
        return fullEnd.includes(normBairro);
      });
    }

    // 3. Filtro de Marcador Operacional (PRESO, MORTO, ALVO_PRIORITARIO, SEM_MARCADOR)
    if (filterCriteria.marcador && filterCriteria.marcador !== 'TODOS') {
      if (filterCriteria.marcador === 'SEM_MARCADOR') {
        base = base.filter((s) => !s.marcador || s.marcador === 'NENHUM');
      } else {
        base = base.filter((s) => s.marcador === filterCriteria.marcador);
      }
    }

    // 4. Filtro de Artigo Penal
    if (filterCriteria.artigo.trim()) {
      const normArtigo = normalizeText(filterCriteria.artigo.trim());
      base = base.filter((s) => {
        const fullArt = normalizeText(
          `${s.artigo || ''} ${(s.artigos || []).join(' ')}`
        );
        return fullArt.includes(normArtigo);
      });
    }

    return base;
  }, [suspects, searchResults, searchQuery, filterCriteria]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCriteria.bairro) count++;
    if (filterCriteria.marcador && filterCriteria.marcador !== 'TODOS') count++;
    if (filterCriteria.artigo.trim()) count++;
    return count;
  }, [filterCriteria]);

  const isFilterActive = activeFilterCount > 0;

  // Reinicia a contagem de cards ao pesquisar ou aplicar filtros
  useEffect(() => {
    setVisibleCount(CARDS_PER_PAGE);
  }, [searchQuery, filterCriteria]);

  // Observer de rolagem infinita: detecta aproximação do final e carrega automaticamente próximos 50 cards
  useEffect(() => {
    if (visibleCount >= displayedSuspects.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + CARDS_PER_PAGE, displayedSuspects.length));
        }
      },
      { rootMargin: '350px' }
    );

    const el = loadMoreSentinelRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [visibleCount, displayedSuspects.length]);

  const pagedSuspects = useMemo(() => {
    return displayedSuspects.slice(0, visibleCount);
  }, [displayedSuspects, visibleCount]);

  // Controle do botão flutuante Voltar ao Topo
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Estatísticas táticas para o HUD de Comando e filtros rápidos
  const tacticalStats = useMemo(() => {
    let alvosCount = 0;
    let presosCount = 0;
    let foragidosCount = 0;
    let mortosCount = 0;
    for (const s of suspects) {
      const m = (s.marcador || '').toUpperCase();
      if (m === 'ALVO_PRIORITARIO' || m === 'ALVO PRIORITARIO') alvosCount++;
      else if (m === 'PRESO') presosCount++;
      else if (m === 'FORAGIDO') foragidosCount++;
      else if (m === 'MORTO') mortosCount++;
    }
    return {
      total: suspects.length,
      alvos: alvosCount,
      presos: presosCount,
      foragidos: foragidosCount,
      mortos: mortosCount,
    };
  }, [suspects]);

  // Handle Save Record (create or update)
  const handleSaveRecord = async (record: SuspectRecord, previousId?: string) => {
    // 1. Envia diretamente para o banco de dados em nuvem em tempo real (Firestore)
    // Se o celular estiver sem internet, o registro fica temporariamente enfileirado no celular
    const cloudRes = await saveSuspectToRealtimeCloud(record);

    // 2. Se Cloudflare estiver ativo, sincroniza com o Worker (D1 SQL)
    const provider = getActiveBackendProvider();
    let cfSaved = false;
    if (provider === 'cloudflare') {
      try {
        const cfRes = await saveSuspectToCloudflare(record, !!previousId);
        if (cfRes.success) {
          cfSaved = true;
        }
      } catch (err) {
        console.warn('Aviso Cloudflare Save:', err);
      }
    }

    // 3. Salva no espelho local do dispositivo (cache IndexedDB)
    await saveSuspect(record);
    if (previousId && previousId !== record.id) {
      await deleteSuspect(previousId);
      await deleteSuspectFromRealtimeCloud(previousId);
      if (provider === 'cloudflare') {
        deleteSuspectFromCloudflare(previousId).catch(() => {});
      }
    }

    // 4. Atualiza a memória da interface do app
    setSuspects((prev) => {
      const targetId = previousId || record.id;
      const index = prev.findIndex((item) => item.id === targetId || item.id === record.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = record;
        return updated;
      }
      return [record, ...prev];
    });

    if (selectedSuspect?.id === record.id || (previousId && selectedSuspect?.id === previousId)) {
      setSelectedSuspect(record);
    }

    setPendingOfflineCount(getPendingOfflineCount());

    if (cloudRes.isOffline) {
      setSyncToast(
        '📱 Salvo temporariamente no celular (sem internet). Sincronizará com a nuvem automaticamente ao reconectar!'
      );
    } else {
      setSyncToast('☁️ Integrado ao banco de dados em nuvem em tempo real! Disponível para todos os celulares.');
    }
    setTimeout(() => setSyncToast(null), 4000);
  };

  // Import records pulled from Google Sheets (substitui integralmente, sem merge com registros antigos)
  const handleImportRecords = async (imported: SuspectRecord[]) => {
    const list = Array.isArray(imported) ? imported : [];
    setSuspects(list);
    await replaceAllSuspectsInStorage(list);
    setSyncToast(
      list.length > 0
        ? `${list.length} registros sincronizados!`
        : 'Conectado. Nenhum registro cadastrado.'
    );
    setTimeout(() => setSyncToast(null), 3500);
  };

  // Handle Delete Record
  const handleConfirmDelete = async (id: string): Promise<boolean> => {
    const provider = getActiveBackendProvider();
    setSyncToast('Excluindo registro do banco de dados...');

    // 1. Exclui do espelho local e da memória imediatamente
    await deleteSuspect(id);
    deleteAbordagensBySuspectId(id);
    setSuspects((prev) => prev.filter((item) => item.id !== id));

    if (selectedSuspect?.id === id) {
      setSelectedSuspect(null);
    }

    // 2. Sincroniza exclusão na nuvem sem bloquear a operação local caso ocorra erro de rede
    try {
      await deleteSuspectFromRealtimeCloud(id);
    } catch (err) {
      console.warn('Aviso ao excluir do Firestore:', err);
    }

    if (provider === 'cloudflare') {
      try {
        await deleteSuspectFromCloudflare(id);
      } catch (err) {
        console.warn('Aviso ao excluir do Cloudflare:', err);
      }
    } else {
      try {
        await deleteSuspectFromGoogleSheets(id, API_URL);
      } catch (err) {
        console.warn('Aviso ao excluir da Planilha:', err);
      }
    }

    setSyncToast('Registro excluído com sucesso do banco de dados!');
    setTimeout(() => setSyncToast(null), 3500);

    return true;
  };

  // Open Edit Form from Detail view
  const handleStartEdit = (suspect: SuspectRecord) => {
    setSelectedSuspect(null);
    setEditingSuspect(suspect);
    setIsFormOpen(true);
  };

  // Open Delete Prompt from Detail view
  const handleRequestDelete = (suspect: SuspectRecord) => {
    setSelectedSuspect(null); // Fecha o DetailModal para evitar sobreposição de telas
    setSuspectToDelete(suspect);
  };

  // Atualiza simultaneamente o app e o banco de dados
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          reg.update().catch(() => {});
        }
      }
      await refreshRecordsFromCloud();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshRecordsFromCloud]);

  // Se o usuário NÃO estiver logado: Exibe exclusivamente a tela de Login (sem carregar ou exibir cards no fundo)
  if (!userSession) {
    return (
      <div className="min-h-screen bg-[#090c13] text-neutral-100 flex flex-col items-center justify-center p-3 sm:p-4 relative overflow-hidden select-none">
        {/* Fundo tático com iluminação ambiente */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1b2230]/40 via-[#0d1117] to-[#07090e] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#c69c59] to-transparent opacity-60" />

        {/* Tela de Login Dedicada (Sem os cards montados no fundo) */}
        <div className="relative z-10 w-full flex items-center justify-center">
          <AuthFlowModal
            isOpen={true}
            isStandalone={true}
            onClose={() => {}}
            onLoginSuccess={handleLoginSuccess}
          />
        </div>

        {/* Pop-up de Transição: Entrando no Sistema... */}
        {isLoggingIn && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-sm bg-[#111520] border border-[#c69c59]/60 rounded-2xl shadow-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#1c2436] to-[#121622] border border-[#c69c59]/60 flex items-center justify-center text-[#e5c07b] shadow-lg shadow-[#c69c59]/20">
                <ShieldCheck className="w-8 h-8 text-[#e5c07b] animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Entrando no Sistema
                </h3>
                <p className="text-xs text-neutral-300">
                  Bem-vindo, <strong className="text-[#e5c07b]">{pendingLoginSession?.nome || 'Operador'}</strong>!
                </p>
                <p className="text-[11px] text-neutral-400">
                  Autenticando credenciais e preparando ambiente seguro...
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#c69c59] pt-1">
                <RefreshCw className="w-4 h-4 animate-spin text-[#c69c59]" />
                <span>Carregando dados operacionais...</span>
              </div>
            </div>
          </div>
        )}

        {/* Pop-up de Transição: Saindo do Sistema... */}
        {isLoggingOut && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-sm bg-[#141824] border border-red-500/60 rounded-2xl shadow-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-950/50 border border-red-500/50 flex items-center justify-center text-red-400 shadow-lg shadow-red-900/30">
                <LogOut className="w-8 h-8 animate-pulse text-red-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Saindo do Sistema
                </h3>
                <p className="text-xs text-neutral-300">
                  Encerrando sessão com segurança...
                </p>
                <p className="text-[11px] text-neutral-400">
                  Desconectando do Banco de Dados Operacional.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-red-300 pt-1">
                <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
                <span>Finalizando credenciais...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-neutral-100 flex flex-col antialiased">
      {/* Pop-up de Transição ao Clicar em Sair na tela de cards */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-sm bg-[#141824] border border-red-500/60 rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-950/50 border border-red-500/50 flex items-center justify-center text-red-400 shadow-lg shadow-red-900/30">
              <LogOut className="w-8 h-8 animate-pulse text-red-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Saindo do Sistema
              </h3>
              <p className="text-xs text-neutral-300">
                Encerrando sessão com segurança...
              </p>
              <p className="text-[11px] text-neutral-400">
                Desconectando do Banco de Dados Operacional.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-red-300 pt-1">
              <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
              <span>Finalizando credenciais...</span>
            </div>
          </div>
        </div>
      )}

      {/* Banner de Oferta de Instalação do PWA (aparece discretamente no topo) */}
      <PWAInstallBanner onOpenModal={() => setIsInstallModalOpen(true)} />

      {/* Header Tático */}
      <Header
        totalRecords={suspects.length}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenCloudflareModal={() => setIsCloudflareModalOpen(true)}
        onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
        onOpenOrcrimModal={() => setIsOrcrimModalOpen(true)}
        onOpenUserManagementModal={() => setIsUserManagementOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenSmartImportModal={() => setIsSmartImportOpen(true)}
        onLogout={handleLogout}
        currentSession={userSession}
        activeProvider={activeProvider}
        viewportMode={viewportMode}
        onChangeViewportMode={handleChangeViewportMode}
        theme={theme}
        onToggleTheme={() => handleChangeTheme(theme === 'light' ? 'dark' : 'light')}
      />

      {/* Barra de Status: Nuvem em Tempo Real / Modo Offline Temporário */}
      {!isOnline ? (
        <div className="bg-amber-950/90 border-b border-amber-500/70 text-amber-200 px-4 py-2 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
            <span className="leading-tight">
              <strong>Modo Offline Temporário (Sem Conexão):</strong> Os cadastros feitos agora ficarão salvos temporariamente no celular e serão sincronizados com o banco em nuvem assim que a internet retornar.
            </span>
          </div>
          {pendingOfflineCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500 text-black font-extrabold text-[11px] whitespace-nowrap ml-2">
              {pendingOfflineCount} pendente(s)
            </span>
          )}
        </div>
      ) : pendingOfflineCount > 0 ? (
        <div className="bg-cyan-950/90 border-b border-cyan-500/70 text-cyan-200 px-4 py-2 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
            <span>
              Conectado! Sincronizando <strong>{pendingOfflineCount}</strong> registro(s) salvo(s) offline com a nuvem...
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              const count = await flushOfflineQueueToCloud();
              setPendingOfflineCount(getPendingOfflineCount());
              setSyncToast(`${count} registro(s) sincronizado(s) com a nuvem com sucesso!`);
              setTimeout(() => setSyncToast(null), 3500);
            }}
            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase cursor-pointer transition-colors"
          >
            Enviar Agora
          </button>
        </div>
      ) : null}

      {/* Barra de Comando Web (quando em modo web ou tela desktop) */}
      <div className={viewportMode === 'mobile' ? 'hidden' : 'block'}>
        <WebCommandBar
          suspects={suspects}
          activeProvider={activeProvider}
          onOpenCloudflareModal={() => setIsCloudflareModalOpen(true)}
          onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
          onOpenOrcrimModal={() => setIsOrcrimModalOpen(true)}
          onOpenUserManagementModal={() => setIsUserManagementOpen(true)}
          onOpenSmartImportModal={() => setIsSmartImportOpen(true)}
          onNewRecord={() => {
            setEditingSuspect(null);
            setIsFormOpen(true);
          }}
          onRefreshAll={handleRefreshAll}
          isRefreshing={isRefreshing}
          onSelectMarkerFilter={(m) =>
            setFilterCriteria((prev) => ({ ...prev, marcador: m as any }))
          }
          currentMarker={filterCriteria.marcador}
        />
      </div>

      {/* Pull-to-Refresh Container */}
      <PullToRefresh onRefresh={handleRefreshAll} isRefreshing={isRefreshing}>
        {/* Barra de Pesquisa */}
        <SearchBar
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            if (!val.trim()) {
              setSearchResults(null);
            }
          }}
          onSubmit={() => executeRemoteSearch(searchQuery)}
          onOpenFacialRecognition={() => handleOpenFacialRecognition()}
          totalFiltered={displayedSuspects.length}
          totalAll={suspects.length}
          isSearching={isSearching}
        />

        {/* Barra de Navegação dos Módulos Fixa Abaixo da Pesquisa */}
        <NavigationModuleBar
          activeModule={activeModule}
          onSelectModule={handleSelectModule}
          totalCadastrados={suspects.length}
          totalOrcrims={totalOrcrimsCount}
        />

        {/* HUD OPERACIONAL TÁTICO: RESUMO E FILTROS RÁPIDOS COM 1 CLIQUE */}
        <div className="w-full max-w-7xl mx-auto px-4 mb-3">
          <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-2xl bg-[#111520] border border-neutral-800/80 shadow-md flex-wrap">
            {/* Indicador de Economia e Alta Velocidade */}
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] font-bold">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Alta Velocidade (50 em 50)</span>
              </span>
              <span className="text-neutral-400 text-[11px] hidden md:inline font-mono">
                Total: <strong className="text-white">{tacticalStats.total}</strong> | Na tela: <strong className="text-[#e5c07b]">{pagedSuspects.length}</strong>
              </span>
            </div>

            {/* Chips de Ação Rápida de Filtro com 1 Clique */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setFilterCriteria((prev) => ({
                    ...prev,
                    marcador: prev.marcador === 'ALVO_PRIORITARIO' ? 'TODOS' : 'ALVO_PRIORITARIO',
                  }))
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                  filterCriteria.marcador === 'ALVO_PRIORITARIO'
                    ? 'bg-[#5e351f] border-[#9c552e] text-[#fadcce] shadow-sm'
                    : 'bg-[#181d29] border-neutral-700/60 hover:border-[#9c552e]/50 text-neutral-300'
                }`}
                title="Filtrar Alvos Prioritários"
              >
                <Crosshair className="w-3 h-3 text-[#f09a6c]" />
                <span>Alvos ({tacticalStats.alvos})</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilterCriteria((prev) => ({
                    ...prev,
                    marcador: prev.marcador === 'PRESO' ? 'TODOS' : 'PRESO',
                  }))
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                  filterCriteria.marcador === 'PRESO'
                    ? 'bg-slate-700 border-slate-400 text-white shadow-sm'
                    : 'bg-[#181d29] border-neutral-700/60 hover:border-slate-500/50 text-neutral-300'
                }`}
                title="Filtrar Presos"
              >
                <Lock className="w-3 h-3 text-slate-300" />
                <span>Presos ({tacticalStats.presos})</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilterCriteria((prev) => ({
                    ...prev,
                    marcador: prev.marcador === 'FORAGIDO' ? 'TODOS' : 'FORAGIDO',
                  }))
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                  filterCriteria.marcador === 'FORAGIDO'
                    ? 'bg-yellow-500 text-neutral-950 border-yellow-400 shadow-sm'
                    : 'bg-[#181d29] border-neutral-700/60 hover:border-yellow-500/50 text-neutral-300'
                }`}
                title="Filtrar Foragidos"
              >
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span>Foragidos ({tacticalStats.foragidos})</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilterCriteria((prev) => ({
                    ...prev,
                    marcador: prev.marcador === 'MORTO' ? 'TODOS' : 'MORTO',
                  }))
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                  filterCriteria.marcador === 'MORTO'
                    ? 'bg-red-950 border-red-500 text-red-200 shadow-sm'
                    : 'bg-[#181d29] border-neutral-700/60 hover:border-red-500/50 text-neutral-300'
                }`}
                title="Filtrar Mortos"
              >
                <Skull className="w-3 h-3 text-red-400" />
                <span>Mortos ({tacticalStats.mortos})</span>
              </button>
            </div>
          </div>
        </div>

        {/* BARRA TÁTICA: BOTÃO DE FILTRO (DIÁLOGO) E SELETOR DE VISUALIZAÇÃO DOS CARDS */}
        <div className="w-full max-w-7xl mx-auto px-4 mb-3.5">
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            {/* Botão de Filtro - Abre a caixa de diálogo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-open-filter-modal"
                onClick={() => setIsFilterModalOpen(true)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm ${
                  isFilterActive
                    ? 'bg-[#1f2637] border-[#c69c59] text-[#e5c07b]'
                    : 'bg-[#141822] border-neutral-700/80 hover:border-[#c69c59]/50 text-neutral-200'
                }`}
                title="Abrir caixa de diálogo de filtros (Bairros de BH, Marcadores e Artigos)"
              >
                <Filter className={`w-3.5 h-3.5 ${isFilterActive ? 'text-[#c69c59]' : 'text-neutral-400'}`} />
                <span>Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#c69c59] text-neutral-950 font-extrabold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Botão sutil para limpar filtros se houver algum ativo */}
              {isFilterActive && (
                <button
                  type="button"
                  id="btn-clear-active-filters"
                  onClick={() =>
                    setFilterCriteria({
                      bairro: '',
                      marcador: 'TODOS',
                      artigo: '',
                    })
                  }
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Limpar todos os filtros ativos"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar Filtros</span>
                </button>
              )}

              {/* Contagem rápida de abordados exibidos */}
              <span className="text-[11px] font-mono text-neutral-400 hidden sm:inline">
                {displayedSuspects.length} {displayedSuspects.length === 1 ? 'abordado' : 'abordados'}
              </span>
            </div>

            {/* SELETOR DE MODO DE VISUALIZAÇÃO DOS CARDS AO LADO DO FILTRO */}
            <div className="flex items-center gap-1 p-1 bg-[#141822] border border-neutral-800 rounded-xl shadow-inner">
              <button
                type="button"
                id="btn-quick-view-compact"
                onClick={() => handleChangeViewMode('compact')}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'compact'
                    ? 'bg-[#1f2637] text-[#e5c07b] border border-[#c69c59]/40 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Visualização Detalhes Compacto (Padrão)"
              >
                <Layers className="w-4 h-4" />
                <span className="text-[11px] hidden sm:inline">Detalhes Compacto</span>
              </button>

              <button
                type="button"
                id="btn-quick-view-grid-3"
                onClick={() => handleChangeViewMode('grid-3')}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'grid-3'
                    ? 'bg-[#1f2637] text-[#e5c07b] border border-[#c69c59]/40 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Visualizar Três Cards Lado a Lado (3 Colunas)"
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="text-[11px] hidden sm:inline">3 Colunas</span>
              </button>

              <button
                type="button"
                id="btn-quick-view-list"
                onClick={() => handleChangeViewMode('list')}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#1f2637] text-[#e5c07b] border border-[#c69c59]/40 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Visualização em Lista"
              >
                <List className="w-4 h-4" />
                <span className="text-[11px] hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>

          {/* Chips de filtros ativos quando selecionados */}
          {isFilterActive && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 animate-fadeIn">
              {filterCriteria.bairro && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#182030] border border-[#c69c59]/50 text-[#e5c07b] text-[11px] font-mono">
                  <MapPin className="w-3 h-3" />
                  <span>Bairro: {filterCriteria.bairro}</span>
                  <button
                    type="button"
                    onClick={() => setFilterCriteria((prev) => ({ ...prev, bairro: '' }))}
                    className="ml-1 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterCriteria.marcador && filterCriteria.marcador !== 'TODOS' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#182030] border border-[#c69c59]/50 text-[#e5c07b] text-[11px] font-mono">
                  <Tag className="w-3 h-3" />
                  <span>
                    Marcador:{' '}
                    {filterCriteria.marcador === 'PRESO'
                      ? 'Preso'
                      : filterCriteria.marcador === 'MORTO'
                      ? 'Morto'
                      : filterCriteria.marcador === 'ALVO_PRIORITARIO'
                      ? 'Alvo Prioritário'
                      : 'Sem Marcador'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterCriteria((prev) => ({ ...prev, marcador: 'TODOS' }))}
                    className="ml-1 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterCriteria.artigo && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#182030] border border-[#c69c59]/50 text-[#e5c07b] text-[11px] font-mono">
                  <FileText className="w-3 h-3" />
                  <span>Artigo: {filterCriteria.artigo}</span>
                  <button
                    type="button"
                    onClick={() => setFilterCriteria((prev) => ({ ...prev, artigo: '' }))}
                    className="ml-1 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={() =>
                  setFilterCriteria({
                    bairro: '',
                    marcador: 'TODOS',
                    artigo: '',
                  })
                }
                className="text-[10px] text-neutral-400 hover:text-red-400 underline font-mono ml-1 cursor-pointer"
              >
                Limpar Todos os Filtros
              </button>
            </div>
          )}
        </div>

        {/* Main Content: 3 modos de visualização */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 pb-24">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
              <div className="w-8 h-8 border-2 border-[#c69c59] border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs uppercase tracking-widest font-mono">
                Carregando Banco de Dados Operacional...
              </span>
            </div>
          ) : isSearching && displayedSuspects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
              <div className="w-8 h-8 border-2 border-[#c69c59] border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs uppercase tracking-widest font-mono text-[#c69c59]">
                Consultando Banco de Dados na Nuvem...
              </span>
              <span className="text-[11px] text-neutral-500 mt-1 font-mono">
                Termo pesquisado: "{searchQuery}"
              </span>
            </div>
          ) : displayedSuspects.length > 0 ? (
            <>
              {viewMode === 'list' ? (
                /* Modo 1: Em Lista */
                <div className="flex flex-col gap-2.5 w-full">
                  {pagedSuspects.map((suspect) => (
                    <SuspectCard
                      key={suspect.id}
                      suspect={suspect}
                      viewMode="list"
                      onClick={() => setSelectedSuspect(suspect)}
                      onToast={(msg) => {
                        setSyncToast(msg);
                        setTimeout(() => setSyncToast(null), 3500);
                      }}
                    />
                  ))}
                </div>
              ) : viewMode === 'compact' ? (
                /* Modo 2: Detalhes / Compacto */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-stretch">
                  {pagedSuspects.map((suspect) => (
                    <SuspectCard
                      key={suspect.id}
                      suspect={suspect}
                      viewMode="compact"
                      onClick={() => setSelectedSuspect(suspect)}
                      onToast={(msg) => {
                        setSyncToast(msg);
                        setTimeout(() => setSyncToast(null), 3500);
                      }}
                    />
                  ))}
                </div>
              ) : viewMode === 'grid-3' ? (
                /* Modo 4: Três Cards Lado a Lado (inclusive no Celular) */
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3 lg:gap-4 items-stretch">
                  {pagedSuspects.map((suspect) => (
                    <SuspectCard
                      key={suspect.id}
                      suspect={suspect}
                      viewMode="grid-3"
                      onClick={() => setSelectedSuspect(suspect)}
                      onToast={(msg) => {
                        setSyncToast(msg);
                        setTimeout(() => setSyncToast(null), 3500);
                      }}
                    />
                  ))}
                </div>
              ) : (
                /* Modo 3: Lado a Lado / Grade Padrão */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4 items-stretch">
                  {pagedSuspects.map((suspect) => (
                    <SuspectCard
                      key={suspect.id}
                      suspect={suspect}
                      viewMode="grid"
                      onClick={() => setSelectedSuspect(suspect)}
                      onToast={(msg) => {
                        setSyncToast(msg);
                        setTimeout(() => setSyncToast(null), 3500);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Sentinela de Rolagem Infinita (Carrega automaticamente próximos 50 ao aproximar do final) */}
              <div
                ref={loadMoreSentinelRef}
                className="w-full h-8 flex items-center justify-center my-2 pointer-events-none"
              />

              {/* Painel Tático de Controle de Paginação e Economia de Tráfego */}
              {displayedSuspects.length > CARDS_PER_PAGE && (
                <div className="w-full mt-4 p-4 rounded-2xl bg-[#121622] border border-neutral-800 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold text-neutral-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        Exibindo {pagedSuspects.length} de {displayedSuspects.length} registros
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1c2436] text-[#e5c07b] border border-[#c69c59]/40 font-bold">
                        {Math.round((pagedSuspects.length / displayedSuspects.length) * 100)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {visibleCount < displayedSuspects.length
                        ? 'Novos cards são carregados automaticamente de 50 em 50 ao rolar a página.'
                        : 'Todos os registros do banco de dados foram carregados no dispositivo.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {visibleCount < displayedSuspects.length && (
                      <>
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => Math.min(prev + CARDS_PER_PAGE, displayedSuspects.length))}
                          className="px-3.5 py-1.5 rounded-xl bg-[#1b2333] hover:bg-[#253046] border border-[#c69c59]/60 text-[#e5c07b] text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Carregar Mais (+50)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisibleCount(displayedSuspects.length)}
                          className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <span>Exibir Todos ({displayedSuspects.length})</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Nenhum registro com os filtros ou pesquisa */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 mb-4">
                <ShieldAlert className="w-8 h-8 text-[#c69c59]/60" />
              </div>
              <h3 className="text-base font-bold text-neutral-200">
                {isFilterActive || searchQuery
                  ? 'Nenhum abordado encontrado com os filtros aplicados'
                  : 'Nenhum registro cadastrado'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-md mt-1 leading-relaxed">
                {isFilterActive || searchQuery
                  ? 'Tente ajustar os termos de pesquisa, o bairro selecionado ou o marcador operacional.'
                  : 'O banco de dados está pronto para uso em campo. Clique no botão abaixo para adicionar o primeiro registro.'}
              </p>

              {isFilterActive || searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                    setFilterCriteria({
                      bairro: '',
                      marcador: 'TODOS',
                      artigo: '',
                    });
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  Limpar Pesquisa e Filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSuspect(null);
                    setIsFormOpen(true);
                  }}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c69c59] hover:bg-[#d4af37] text-neutral-950 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Registro</span>
                </button>
              )}
            </div>
          )}
        </main>
      </PullToRefresh>

      {/* Botões Flutuantes Inferiores (Scan Facial IA + Novo Registro) - presentes tanto na versão Web quanto no Celular */}
      <FloatingActionButton
        onClick={() => {
          setEditingSuspect(null);
          setIsFormOpen(true);
        }}
        onOpenFacialScan={() => handleOpenFacialRecognition()}
      />

      {/* Modal 1: Visualização de Detalhes */}
      <DetailModal
        suspect={selectedSuspect}
        onClose={() => setSelectedSuspect(null)}
        onEdit={handleStartEdit}
        onDeleteRequest={handleRequestDelete}
        onOpenFacialMatch={(s) => handleOpenFacialRecognition(s)}
        allSuspects={suspects}
        onUpdate={handleSaveRecord}
        onRequestNovoCadastro={(nomeInicial) => {
          setSelectedSuspect(null);
          setEditingSuspect(
            nomeInicial
              ? ({
                  id: '',
                  nome: nomeInicial,
                  mae: '',
                  dataNasc: '',
                  rg: '',
                  cpf: '',
                  endereco: '',
                  alcunha: '',
                  artigo: '',
                  observacoes: '',
                  fotos: [],
                  dataCriacao: new Date().toISOString(),
                } as any)
              : null
          );
          setIsFormOpen(true);
        }}
      />

      {/* Modal 2: Novo Registro / Editar Registro (com verificação de duplicidade e novos campos) */}
      <RecordFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSuspect(null);
        }}
        onSave={handleSaveRecord}
        initialData={editingSuspect}
        existingSuspects={suspects}
      />

      {/* Modal 3: Autorização de Exclusão (Senha) */}
      <DeleteAuthModal
        suspect={suspectToDelete}
        onClose={() => setSuspectToDelete(null)}
        onConfirmDelete={handleConfirmDelete}
      />

      {/* Modal 4: Google Planilha e Drive */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        suspects={suspects}
        onImportRecords={handleImportRecords}
      />

      {/* Modal 5: Senha de Segurança */}
      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      {/* Modal 6: Cloudflare API (Opção A: D1 SQL + R2) */}
      {isCloudflareModalOpen && (
        <CloudflareModal
          isOpen={isCloudflareModalOpen}
          onClose={() => setIsCloudflareModalOpen(false)}
          currentSuspects={suspects}
          onRefreshData={refreshRecordsFromCloud}
          onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
        />
      )}

      {/* Modal: Integração GitHub & Deploy Automático no Cloudflare */}
      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        onToast={(msg) => {
          setSyncToast(msg);
          setTimeout(() => setSyncToast(null), 4000);
        }}
      />

      {/* Modal 7: Ajustes (Planilha, Cloudflare, Senha, PWA, Exportar Cards e Download ZIP) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        totalRecords={suspects.length}
        suspects={suspects}
        isWeb={viewportMode === 'web'}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
        onOpenCloudflareModal={() => setIsCloudflareModalOpen(true)}
        onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenOrcrimModal={() => setIsOrcrimModalOpen(true)}
        onOpenUserManagementModal={() => setIsUserManagementOpen(true)}
        onOpenSmartImportModal={() => setIsSmartImportOpen(true)}
        onLogout={handleLogout}
        onRefreshAll={handleRefreshAll}
        isRefreshing={isRefreshing}
      />

      {/* Modal PWA: Instalação e Criação de Atalho */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Modal 8: Filtro Avançado (Bairros de BH com contagem, Marcadores e Artigos) */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        suspects={suspects}
        currentFilters={filterCriteria}
        onApplyFilters={(newFilters) => setFilterCriteria(newFilters)}
        onClearFilters={() =>
          setFilterCriteria({
            bairro: '',
            marcador: 'TODOS',
            artigo: '',
          })
        }
      />

      {/* Modal 9: Módulo ORCRIM (Telas 08 a 15) */}
      {isOrcrimModalOpen && (
        <OrcrimModal
          isOpen={isOrcrimModalOpen}
          onClose={() => {
            setIsOrcrimModalOpen(false);
            setActiveModule('cadastrados');
          }}
          allSuspects={suspects}
          initialTab={orcrimInitialTab}
          onSelectSuspect={(suspect) => {
            setIsOrcrimModalOpen(false);
            setSelectedSuspect(suspect);
          }}
        />
      )}

      {/* Modal Prévia: Módulo de Abordagens */}
      <AbordagensPreviewModal
        isOpen={isAbordagensPreviewOpen}
        onClose={() => {
          setIsAbordagensPreviewOpen(false);
          setActiveModule('cadastrados');
        }}
        allSuspects={suspects}
        onUpdateSuspect={handleSaveRecord}
        onOpenSuspectDetail={(suspect) => {
          setIsAbordagensPreviewOpen(false);
          setSelectedSuspect(suspect);
        }}
        onRequestNovoCadastro={(nomeInicial) => {
          setIsAbordagensPreviewOpen(false);
          setEditingSuspect(
            nomeInicial
              ? ({
                  id: '',
                  nome: nomeInicial,
                  mae: '',
                  dataNasc: '',
                  rg: '',
                  cpf: '',
                  endereco: '',
                  alcunha: '',
                  artigo: '',
                  observacoes: '',
                  fotos: [],
                  dataCriacao: new Date().toISOString(),
                } as any)
              : null
          );
          setIsFormOpen(true);
        }}
      />

      {/* Modal 10: Gestão de Usuários e Permissões (Telas 04, 05, 06, 07) */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
      />

      {/* Modal 11: Autenticação, Primeiro Acesso e Sucesso (Telas 01, 02, 03) */}
      <AuthFlowModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(session) => {
          setUserSession(session);
          setSyncToast(`Bem-vindo, ${session.nome}!`);
          setTimeout(() => setSyncToast(null), 3500);
        }}
      />

      {/* Modal 12: Identificação Facial Tática por IA com Termo de Resguardo Operacional */}
      <FacialRecognitionModal
        isOpen={isFacialRecognitionOpen}
        onClose={() => {
          setIsFacialRecognitionOpen(false);
          setFacialInitialSuspect(null);
          setActiveModule('cadastrados');
        }}
        allSuspects={suspects}
        initialSuspect={facialInitialSuspect}
        onSelectSuspectForDetail={(suspect) => {
          setSelectedSuspect(suspect);
        }}
        onStartAbordagemWithSuspect={(suspect) => {
          setSelectedSuspect(suspect);
        }}
      />

      {/* Modal 13: Importador Inteligente (Google Keep, WhatsApp e Arquivos por IA) */}
      <SmartImportModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        onExtractedCandidates={(candidates) => {
          if (!candidates || candidates.length === 0) return;
          if (candidates.length === 1) {
            setEditingSuspect(candidates[0]);
            setIsFormOpen(true);
          } else {
            setMultiReviewCandidates(candidates);
            setIsMultiReviewOpen(true);
          }
        }}
      />

      {/* Modal 14: Revisão e Confirmação de Cadastros Extraídos em Lote */}
      <AiMultiReviewModal
        isOpen={isMultiReviewOpen}
        onClose={() => {
          setIsMultiReviewOpen(false);
          setMultiReviewCandidates([]);
        }}
        candidates={multiReviewCandidates}
        onSaveRecord={async (record) => {
          await handleSaveRecord(record);
        }}
        existingSuspects={suspects}
      />

      {/* Botão Flutuante Voltar ao Topo (Aparece ao descer a rolagem dos cards) */}
      {showBackToTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-24 right-5 z-40 p-3 rounded-full bg-[#141a24] hover:bg-[#1e2638] border border-[#c69c59]/70 text-[#e5c07b] shadow-2xl transition-all duration-200 active:scale-90 hover:scale-110 cursor-pointer flex items-center justify-center animate-fadeIn"
          title="Voltar ao topo da lista"
        >
          <ChevronUp className="w-5 h-5 text-[#c69c59]" />
        </button>
      )}

      {/* Toast de Sincronização */}
      {syncToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#141a24] border border-[#c69c59]/70 text-[#e5c07b] text-xs font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <ShieldCheck className="w-4 h-4 text-[#e5c07b]" />
          <span>{syncToast}</span>
        </div>
      )}
    </div>
  );
}
