import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SuspectRecord, OrcrimRecord } from '../types';

const OFFLINE_QUEUE_KEY = 'bdo_offline_pending_queue_v1';
const OFFLINE_ORCRIM_QUEUE_KEY = 'bdo_offline_orcrim_pending_queue_v1';

// Inicializa Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicializa Firestore com persistência offline nativa no navegador/celular
let db: Firestore;
const databaseId = firebaseConfig.firestoreDatabaseId || '';

try {
  db = databaseId
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      }, databaseId)
    : initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
} catch (err) {
  // Se já foi inicializado anteriormente
  db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export { db };

export interface CloudSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  mode: 'realtime_cloud' | 'offline_temporary';
}

/**
 * Retorna os itens pendentes salvos offline no celular
 */
export function getPendingOfflineQueue(): { suspects: SuspectRecord[]; orcrims: OrcrimRecord[] } {
  try {
    const rawS = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const rawO = localStorage.getItem(OFFLINE_ORCRIM_QUEUE_KEY);
    return {
      suspects: rawS ? JSON.parse(rawS) : [],
      orcrims: rawO ? JSON.parse(rawO) : [],
    };
  } catch {
    return { suspects: [], orcrims: [] };
  }
}

export function getPendingOfflineCount(): number {
  const { suspects, orcrims } = getPendingOfflineQueue();
  return suspects.length + orcrims.length;
}

function addToOfflineSuspectQueue(record: SuspectRecord) {
  try {
    const { suspects } = getPendingOfflineQueue();
    const filtered = suspects.filter((s) => s.id !== record.id);
    filtered.push(record);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    dispatchStatusEvent();
  } catch (e) {
    console.warn('Erro ao salvar na fila offline:', e);
  }
}

function removePendingSuspect(id: string) {
  try {
    const { suspects } = getPendingOfflineQueue();
    const filtered = suspects.filter((s) => s.id !== id);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    dispatchStatusEvent();
  } catch (_) {}
}

function dispatchStatusEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cloud_sync_status_changed'));
  }
}

/**
 * Assina mudanças em tempo real no banco de dados em nuvem Firestore.
 * Qualquer celular conectado que cadastrar, editar ou apagar refletirá instantaneamente aqui.
 */
export function subscribeToCloudSuspects(
  onUpdate: (suspects: SuspectRecord[]) => void,
  onError?: (error: any) => void
) {
  const suspectsCol = collection(db, 'suspects');
  
  return onSnapshot(
    suspectsCol,
    { includeMetadataChanges: true },
    (snapshot) => {
      const list: SuspectRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SuspectRecord;
        if (data && data.id) {
          list.push(data);
        }
      });
      // Ordena pelos mais recentes
      list.sort((a, b) => {
        const dateA = new Date(a.dataAtualizacao || a.dataCriacao || 0).getTime();
        const dateB = new Date(b.dataAtualizacao || b.dataCriacao || 0).getTime();
        return dateB - dateA;
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('[Firestore] Conexão em tempo real suspensa (operando temporariamente offline):', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Assina mudanças em tempo real nas facções / ORCRIMs.
 */
export function subscribeToCloudOrcrims(
  onUpdate: (orcrims: OrcrimRecord[]) => void,
  onError?: (error: any) => void
) {
  const orcrimsCol = collection(db, 'orcrims');

  return onSnapshot(
    orcrimsCol,
    { includeMetadataChanges: true },
    (snapshot) => {
      const list: OrcrimRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as OrcrimRecord;
        if (data && data.id) {
          list.push(data);
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('[Firestore] ORCRIM em tempo real temporariamente offline:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Salva registro de suspeito diretamente no banco em nuvem.
 * Se o dispositivo estiver sem internet (offline), grava no cache do celular e
 * enfileira para envio automático assim que a rede restabelecer.
 */
export async function saveSuspectToRealtimeCloud(
  record: SuspectRecord
): Promise<{ success: boolean; isOffline: boolean; message: string }> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  try {
    const docRef = doc(db, 'suspects', record.id);
    const cleanedRecord = JSON.parse(JSON.stringify(record));
    await setDoc(docRef, cleanedRecord, { merge: true });

    if (!isOnline) {
      addToOfflineSuspectQueue(record);
      return {
        success: true,
        isOffline: true,
        message: 'Registro gravado temporariamente no celular. Será enviado à nuvem assim que a internet voltar.',
      };
    }

    removePendingSuspect(record.id);
    return {
      success: true,
      isOffline: false,
      message: 'Registro gravado com sucesso no banco em nuvem em tempo real!',
    };
  } catch (err: any) {
    console.warn('Erro ao enviar para Firestore, enfileirando offline:', err);
    addToOfflineSuspectQueue(record);
    return {
      success: true,
      isOffline: true,
      message: 'Sem resposta da nuvem no momento. Registro salvo temporariamente no celular para sincronização automática.',
    };
  }
}

/**
 * Exclui registro de suspeito do banco em nuvem em tempo real.
 */
export async function deleteSuspectFromRealtimeCloud(id: string): Promise<{ success: boolean }> {
  try {
    const docRef = doc(db, 'suspects', id);
    await deleteDoc(docRef);
    removePendingSuspect(id);
    return { success: true };
  } catch (err) {
    console.error('Erro ao excluir no Firestore:', err);
    return { success: false };
  }
}

/**
 * Salva ORCRIM no banco em nuvem em tempo real.
 */
export async function saveOrcrimToRealtimeCloud(
  record: OrcrimRecord
): Promise<{ success: boolean; isOffline: boolean }> {
  try {
    const docRef = doc(db, 'orcrims', record.id);
    const cleaned = JSON.parse(JSON.stringify(record));
    await setDoc(docRef, cleaned, { merge: true });
    return { success: true, isOffline: !navigator.onLine };
  } catch (err) {
    console.error('Erro ao salvar ORCRIM na nuvem:', err);
    return { success: false, isOffline: true };
  }
}

/**
 * Exclui ORCRIM do banco em nuvem em tempo real.
 */
export async function deleteOrcrimFromRealtimeCloud(id: string): Promise<{ success: boolean }> {
  try {
    const docRef = doc(db, 'orcrims', id);
    await deleteDoc(docRef);
    return { success: true };
  } catch (err) {
    console.error('Erro ao excluir ORCRIM no Firestore:', err);
    return { success: false };
  }
}

/**
 * Sincroniza todos os registros pendentes acumulados enquanto o celular estava sem internet.
 */
export async function flushOfflineQueueToCloud(): Promise<number> {
  const { suspects, orcrims } = getPendingOfflineQueue();
  let count = 0;

  if (suspects.length === 0 && orcrims.length === 0) return 0;

  for (const s of suspects) {
    try {
      const docRef = doc(db, 'suspects', s.id);
      await setDoc(docRef, JSON.parse(JSON.stringify(s)), { merge: true });
      removePendingSuspect(s.id);
      count++;
    } catch (e) {
      console.warn('Falha ao reenviar suspeito offline:', e);
    }
  }

  for (const o of orcrims) {
    try {
      const docRef = doc(db, 'orcrims', o.id);
      await setDoc(docRef, JSON.parse(JSON.stringify(o)), { merge: true });
      count++;
    } catch (e) {
      console.warn('Falha ao reenviar orcrim offline:', e);
    }
  }

  if (count > 0) {
    localStorage.removeItem(OFFLINE_ORCRIM_QUEUE_KEY);
    dispatchStatusEvent();
  }

  return count;
}

// Configura monitoramento global de conexão de internet no celular
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Nuvem] Conexão restabelecida! Enviando registros temporários para o banco em nuvem...');
    flushOfflineQueueToCloud().then((synced) => {
      if (synced > 0) {
        window.dispatchEvent(
          new CustomEvent('cloud_sync_notice', {
            detail: `${synced} registro(s) sincronizado(s) automaticamente com o banco em nuvem!`,
          })
        );
      }
    });
  });
}
