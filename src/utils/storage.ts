import { SuspectRecord } from '../types';

const DB_NAME = 'BancoOperacionalDB';
const LEGACY_DB_NAME = 'ForcaTaticaDB';
const DB_VERSION = 1;
const STORE_NAME = 'suspects';
const PASSWORD_STORAGE_KEY = 'bdo_delete_pwd';
const LEGACY_PASSWORD_STORAGE_KEY = 'forca_tatica_delete_pwd';
const SYNC_CONFIG_KEY = 'bdo_sync_config';
const LEGACY_SYNC_CONFIG_KEY = 'forca_tatica_sync_config';

const DEFAULT_DELETE_PASSWORD = '1252300';

export const INITIAL_RECORDS: SuspectRecord[] = [];

function openSpecificDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado neste navegador'));
      return;
    }

    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function openDB(): Promise<IDBDatabase> {
  return openSpecificDB(DB_NAME);
}

async function getRecordsFromSpecificDB(dbName: string): Promise<SuspectRecord[]> {
  try {
    const db = await openSpecificDB(dbName);
    return new Promise((resolve) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve([]);
        return;
      }
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawResults: SuspectRecord[] = request.result || [];
        const results = rawResults.map((r) => ({
          ...r,
          fotos: (r.fotos || []).filter((f) => Boolean(f) && !f.includes('mateus_')),
        }));
        resolve(results);
      };

      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Retorna todos os suspeitos com RESGATE AUTOMÁTICO:
 * 1. Consulta BancoOperacionalDB
 * 2. Consulta o banco original ForcaTaticaDB (preservando todos os cadastros anteriores)
 * 3. Consulta backups de segurança no localStorage
 * 4. Mescla e unifica todos os registros por ID, migrando tudo de forma transparente.
 */
export async function getAllSuspects(): Promise<SuspectRecord[]> {
  try {
    const [newRecords, legacyRecords] = await Promise.all([
      getRecordsFromSpecificDB(DB_NAME),
      getRecordsFromSpecificDB(LEGACY_DB_NAME),
    ]);

    const fallbackRecords = getFallbackRecords();

    const map = new Map<string, SuspectRecord>();

    const mergeRecord = (r: SuspectRecord) => {
      if (!r || !r.id) return;
      const existing = map.get(r.id);
      if (!existing) {
        map.set(r.id, r);
      } else {
        const existingPhotos = existing.fotos?.length || 0;
        const newPhotos = r.fotos?.length || 0;
        if (newPhotos > existingPhotos) {
          map.set(r.id, r);
        } else if (
          new Date(r.dataAtualizacao || r.dataCriacao).getTime() >
          new Date(existing.dataAtualizacao || existing.dataCriacao).getTime()
        ) {
          map.set(r.id, r);
        }
      }
    };

    // Une registros de todas as fontes disponíveis
    legacyRecords.forEach(mergeRecord);
    fallbackRecords.forEach(mergeRecord);
    newRecords.forEach(mergeRecord);

    const merged = Array.from(map.values());

    if (merged.length > 0) {
      merged.sort(
        (a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()
      );

      // Se encontrou dados no banco anterior ou fallback que não estavam no novo, sincroniza imediatamente
      if (newRecords.length < merged.length) {
        console.log(`[STORAGE] Restaurando ${merged.length} abordados para o banco ativo...`);
        try {
          const db = await openSpecificDB(DB_NAME);
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          merged.forEach((item) => store.put(item));
        } catch (_) {}
        saveFallbackRecords(merged);
      }

      return merged;
    }

    return [];
  } catch (err) {
    console.error('Erro ao buscar suspeitos:', err);
    return getFallbackRecords();
  }
}

/**
 * Substitui integralmente a persistência local (IndexedDB e localStorage)
 * pelos registros retornados oficialmente pela nuvem.
 */
export async function replaceAllSuspectsInStorage(records: SuspectRecord[]): Promise<void> {
  const cleanList = Array.isArray(records) ? records : [];

  if (cleanList.length > 0) {
    saveFallbackRecords(cleanList);
  }

  // Atualiza ambos os bancos para garantir persistência total
  for (const targetDb of [DB_NAME, LEGACY_DB_NAME]) {
    try {
      const db = await openSpecificDB(targetDb);
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const clearReq = store.clear();

        clearReq.onsuccess = () => {
          if (cleanList.length === 0) {
            resolve();
            return;
          }
          let completed = 0;
          for (const record of cleanList) {
            const putReq = store.put(record);
            putReq.onsuccess = () => {
              completed++;
              if (completed === cleanList.length) resolve();
            };
            putReq.onerror = () => reject(putReq.error);
          }
        };

        clearReq.onerror = () => reject(clearReq.error);
      });
    } catch (err) {
      console.warn(`Aviso ao sincronizar ${targetDb}:`, err);
    }
  }
}

export async function saveSuspect(record: SuspectRecord): Promise<void> {
  // Salva no banco ativo e no banco de redundância
  for (const targetDb of [DB_NAME, LEGACY_DB_NAME]) {
    try {
      const db = await openSpecificDB(targetDb);
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (_) {}
  }

  const records = getFallbackRecords();
  const index = records.findIndex((r) => r.id === record.id);
  if (index >= 0) {
    records[index] = record;
  } else {
    records.unshift(record);
  }
  saveFallbackRecords(records);
}

export async function deleteSuspect(id: string): Promise<void> {
  for (const targetDb of [DB_NAME, LEGACY_DB_NAME]) {
    try {
      const db = await openSpecificDB(targetDb);
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (_) {}
  }

  const records = getFallbackRecords().filter((r) => r.id !== id);
  saveFallbackRecords(records);
}

/**
 * Limpa o cache local (IndexedDB e localStorage)
 */
export async function clearLocalCache(): Promise<void> {
  try {
    localStorage.removeItem('bdo_suspects_backup');
    localStorage.removeItem('forca_tatica_suspects_backup');
    for (const targetDb of [DB_NAME, LEGACY_DB_NAME]) {
      try {
        const db = await openSpecificDB(targetDb);
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Aviso ao limpar cache local:', err);
  }
}

// Fallback in localStorage if IndexedDB is blocked in private browsing
function sanitizeRecordsForStorage(records: SuspectRecord[]): SuspectRecord[] {
  return records.map((r) => ({
    ...r,
    fotos: (r.fotos || []).filter((f) => typeof f === 'string' && !f.startsWith('data:image')),
  }));
}

function getFallbackRecords(): SuspectRecord[] {
  try {
    const item =
      localStorage.getItem('bdo_suspects_backup') ||
      localStorage.getItem('forca_tatica_suspects_backup');
    if (item) {
      const parsed = JSON.parse(item);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sanitizeRecordsForStorage(parsed);
      }
    }
  } catch {
    // Ignore
  }
  return INITIAL_RECORDS;
}

function saveFallbackRecords(records: SuspectRecord[]) {
  try {
    const cleanRecords = sanitizeRecordsForStorage(records);
    const jsonStr = JSON.stringify(cleanRecords);
    localStorage.setItem('bdo_suspects_backup', jsonStr);
    localStorage.setItem('forca_tatica_suspects_backup', jsonStr);
  } catch (err) {
    console.warn('Aviso ao salvar backup em localStorage:', err);
  }
}

// Limpeza preventiva de strings base64 que possam estar no localStorage
try {
  const existingBackup = localStorage.getItem('forca_tatica_suspects_backup');
  if (existingBackup && existingBackup.includes('data:image')) {
    const parsed = JSON.parse(existingBackup);
    if (Array.isArray(parsed)) {
      saveFallbackRecords(parsed);
    }
  }
} catch {
  // Ignore
}

// Security password for deleting records
export function getDeletePassword(): string {
  try {
    const saved =
      localStorage.getItem(PASSWORD_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_PASSWORD_STORAGE_KEY);
    if (!saved || saved === '190') {
      localStorage.setItem(PASSWORD_STORAGE_KEY, DEFAULT_DELETE_PASSWORD);
      return DEFAULT_DELETE_PASSWORD;
    }
    return saved;
  } catch {
    return DEFAULT_DELETE_PASSWORD;
  }
}

export function setDeletePassword(newPassword: string): void {
  try {
    localStorage.setItem(PASSWORD_STORAGE_KEY, newPassword);
  } catch {
    // Ignore
  }
}

// Sync config for Google Sheets / Apps Script webhook
export const API_URL =
  'https://script.google.com/macros/s/AKfycbwDrSu-3Oid7YqH9RzONE_RJ4DyggPUE00Dqp0Y2ldEjJnXUVKwI9cxAQ-14CbpTh0/exec';

export const DEFAULT_GOOGLE_SHEETS_URL = API_URL;

export function getSyncConfig() {
  try {
    const data =
      localStorage.getItem(SYNC_CONFIG_KEY) ||
      localStorage.getItem(LEGACY_SYNC_CONFIG_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        let url = String(parsed.webhookUrl || '').trim();
        // Migra automaticamente endpoints antigos para a nova URL solicitada pelo comando
        if (url.includes('AKfycbwoy01Le66ylY')) {
          url = DEFAULT_GOOGLE_SHEETS_URL;
        }
        // Aceita a URL oficial padrão ou qualquer URL válida de implantação do Google Apps Script
        if (!url || !url.startsWith('https://script.google.com/macros/s/')) {
          url = DEFAULT_GOOGLE_SHEETS_URL;
        }
        return {
          webhookUrl: url,
          autoSync: parsed.autoSync ?? true,
          lastSync: parsed.lastSync,
        };
      }
    }
  } catch {
    // Ignore
  }
  return {
    webhookUrl: DEFAULT_GOOGLE_SHEETS_URL,
    autoSync: true,
    lastSync: undefined,
  };
}

export function saveSyncConfig(config: { webhookUrl: string; autoSync: boolean; lastSync?: string }) {
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Ignore
  }
}
