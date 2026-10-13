import { SuspectRecord } from '../types';

export const CLOUDFLARE_WORKER_URL_KEY = 'ft_cloudflare_worker_url';
export const CLOUDFLARE_API_KEY_STORAGE = 'ft_cloudflare_api_key';
export const BACKEND_PROVIDER_KEY = 'ft_backend_provider'; // 'cloudflare' | 'google_sheets'

export type BackendProvider = 'cloudflare' | 'google_sheets';

export interface CloudflareConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
}

export function getActiveBackendProvider(): BackendProvider {
  try {
    const val = localStorage.getItem(BACKEND_PROVIDER_KEY);
    if (val === 'cloudflare' || val === 'google_sheets') return val;
    // Padrão do sistema: Cloudflare (D1 SQL + R2)
    return 'cloudflare';
  } catch (_) {}
  return 'cloudflare';
}

export function setActiveBackendProvider(provider: BackendProvider): void {
  try {
    localStorage.setItem(BACKEND_PROVIDER_KEY, provider);
  } catch (_) {}
}

export const DEFAULT_CLOUDFLARE_WORKER_URL = 'https://forca-tatica-api.forcataticacpc.workers.dev';

export function getCloudflareConfig(): CloudflareConfig {
  try {
    const savedUrl = localStorage.getItem(CLOUDFLARE_WORKER_URL_KEY);
    const url = (savedUrl !== null && savedUrl !== undefined && savedUrl.trim() !== '')
      ? savedUrl
      : DEFAULT_CLOUDFLARE_WORKER_URL;
    const apiKey = localStorage.getItem(CLOUDFLARE_API_KEY_STORAGE) || '';
    const enabled = getActiveBackendProvider() === 'cloudflare';
    return { url: url.trim(), apiKey: apiKey.trim(), enabled };
  } catch (_) {
    return { url: DEFAULT_CLOUDFLARE_WORKER_URL, apiKey: '', enabled: true };
  }
}

export function saveCloudflareConfig(config: { url: string; apiKey?: string; enabled?: boolean }): void {
  try {
    const finalUrl = config.url ? config.url.trim() : DEFAULT_CLOUDFLARE_WORKER_URL;
    localStorage.setItem(CLOUDFLARE_WORKER_URL_KEY, finalUrl);
    if (config.apiKey !== undefined) {
      localStorage.setItem(CLOUDFLARE_API_KEY_STORAGE, config.apiKey.trim());
    }
    if (config.enabled !== undefined) {
      setActiveBackendProvider(config.enabled ? 'cloudflare' : 'google_sheets');
    } else {
      setActiveBackendProvider('cloudflare');
    }
  } catch (_) {}
}

/**
 * Testa a conexão em tempo real com o Cloudflare Worker medindo latência
 */
export async function testCloudflareConnection(customUrl?: string): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  data?: any;
}> {
  const config = getCloudflareConfig();
  const targetUrl = (customUrl || config.url || '').trim().replace(/\/+$/, '');

  if (!targetUrl) {
    return {
      success: false,
      latencyMs: 0,
      message: 'URL do Cloudflare Worker não informada.',
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch(`${targetUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
      },
    });

    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return {
        success: true,
        latencyMs,
        message: `Cloudflare Worker Conectado com Sucesso (${latencyMs}ms)!`,
        data,
      };
    } else {
      return {
        success: false,
        latencyMs,
        message: `Cloudflare respondeu com status HTTP ${res.status}. Verifique o Worker.`,
      };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      message: `Falha ao conectar ao Cloudflare: ${err.message || 'Verifique a URL e o CORS'}.`,
    };
  }
}

// Cache em memória de consultas para economia máxima de banda e tráfego da Cloudflare
const cloudflareQueryCache = new Map<string, { data: SuspectRecord[]; timestamp: number }>();
const CACHE_TTL_MS = 180_000; // 3 minutos de cache em memória para leituras repetidas

export function clearCloudflareCache(): void {
  cloudflareQueryCache.clear();
}

/**
 * Busca lista de suspeitos no Cloudflare D1
 * Possui cache inteligente em memória para evitar consumo excessivo de tráfego e requisições à Cloudflare.
 */
export async function fetchSuspectsFromCloudflare(
  termo = '',
  marcador = '',
  forceRefresh = false
): Promise<{ success: boolean; data: SuspectRecord[]; message?: string }> {
  const config = getCloudflareConfig();
  const targetUrl = (config.url || DEFAULT_CLOUDFLARE_WORKER_URL).replace(/\/+$/, '');

  if (!targetUrl) {
    return { success: false, data: [], message: 'Cloudflare Worker não configurado.' };
  }

  const cacheKey = `${termo.trim().toLowerCase()}_${marcador}`;

  // Se não for atualização forçada, verifica cache local em memória (0ms de latência, 0 bytes transferidos)
  if (!forceRefresh && cloudflareQueryCache.has(cacheKey)) {
    const cached = cloudflareQueryCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        success: true,
        data: cached.data,
        message: `${cached.data.length} abordados carregados do cache local (Economia de Banda Ativa).`,
      };
    }
  }

  try {
    const query = new URLSearchParams();
    if (termo) query.set('termo', termo);
    if (marcador && marcador !== 'TODOS') query.set('marcador', marcador);
    if (forceRefresh) {
      query.set('_t', Date.now().toString());
    }

    const url = `${targetUrl}/api/suspects?${query.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
      },
    });

    if (!res.ok) {
      return {
        success: false,
        data: [],
        message: `Erro HTTP ${res.status} ao consultar Cloudflare.`,
      };
    }

    const json = await res.json();
    const records = Array.isArray(json.data) ? json.data : [];

    // Armazena no cache para consultas subsequentes sem custo de rede
    cloudflareQueryCache.set(cacheKey, {
      data: records,
      timestamp: Date.now(),
    });

    return {
      success: true,
      data: records,
      message: json.message || `${records.length} abordados carregados do Cloudflare D1.`,
    };
  } catch (err: any) {
    console.error('Erro fetchSuspectsFromCloudflare:', err);
    return {
      success: false,
      data: [],
      message: err.message || 'Falha ao buscar registros no Cloudflare D1.',
    };
  }
}

/**
 * Salva ou atualiza suspeito no Cloudflare D1
 */
export async function saveSuspectToCloudflare(
  record: SuspectRecord,
  isEdit = false
): Promise<{ success: boolean; message: string; id?: string }> {
  clearCloudflareCache();

  const config = getCloudflareConfig();
  const targetUrl = (config.url || DEFAULT_CLOUDFLARE_WORKER_URL).replace(/\/+$/, '');

  if (!targetUrl) {
    return { success: false, message: 'URL do Cloudflare Worker não configurada.' };
  }

  try {
    const method = isEdit ? 'PUT' : 'POST';
    const endpoint = isEdit ? `${targetUrl}/api/suspects/${record.id}` : `${targetUrl}/api/suspects`;

    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
      },
      body: JSON.stringify({ record }),
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        success: true,
        message: json.message || 'Registro salvo com sucesso no Cloudflare D1.',
        id: json.id || record.id,
      };
    } else {
      return {
        success: false,
        message: json.error || `Erro HTTP ${res.status} no Cloudflare.`,
      };
    }
  } catch (err: any) {
    console.error('Erro saveSuspectToCloudflare:', err);
    return {
      success: false,
      message: err.message || 'Falha de comunicação com o Cloudflare Worker.',
    };
  }
}

/**
 * Exclui suspeito no Cloudflare D1
 */
export async function deleteSuspectFromCloudflare(
  id: string
): Promise<{ success: boolean; message: string }> {
  clearCloudflareCache();
  const config = getCloudflareConfig();
  const targetUrl = (config.url || DEFAULT_CLOUDFLARE_WORKER_URL).replace(/\/+$/, '');

  if (!targetUrl) {
    return { success: false, message: 'Cloudflare Worker não configurado.' };
  }

  try {
    const res = await fetch(`${targetUrl}/api/suspects/${id}`, {
      method: 'DELETE',
      headers: {
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
      },
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        success: true,
        message: json.message || 'Registro excluído do Cloudflare D1.',
      };
    } else {
      return {
        success: false,
        message: json.error || `Erro HTTP ${res.status} ao excluir do Cloudflare.`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha ao excluir no Cloudflare.',
    };
  }
}

/**
 * Envia todos os registros existentes para o Cloudflare D1 em lote
 */
export async function syncAllToCloudflare(
  records: SuspectRecord[]
): Promise<{ success: boolean; message: string; inserted?: number; updated?: number }> {
  clearCloudflareCache();
  const config = getCloudflareConfig();
  const targetUrl = config.url.replace(/\/+$/, '');

  if (!targetUrl) {
    return { success: false, message: 'URL do Cloudflare Worker não configurada.' };
  }

  try {
    const res = await fetch(`${targetUrl}/api/batch-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
      },
      body: JSON.stringify({ records }),
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      return {
        success: true,
        message: json.message || 'Sincronização em lote concluída.',
        inserted: json.inserted,
        updated: json.updated,
      };
    } else {
      return {
        success: false,
        message: json.error || `Erro HTTP ${res.status} no Cloudflare.`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha de conexão com Cloudflare ao sincronizar em lote.',
    };
  }
}
