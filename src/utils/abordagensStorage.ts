import { AbordagemRecord } from '../types';

const ABORDAGENS_STORAGE_KEY = 'ft_abordagens_records_v1';
const ABORDAGENS_INITIALIZED_KEY = 'ft_abordagens_initialized_v1';

/**
 * Retorna todas as abordagens registradas.
 */
export function getAllAbordagens(): AbordagemRecord[] {
  try {
    const raw = localStorage.getItem(ABORDAGENS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler abordagens do storage:', err);
  }
  return [];
}

/**
 * Verifica se o armazenamento de abordagens já foi inicializado pelo menos uma vez.
 */
export function isAbordagensInitialized(): boolean {
  try {
    return localStorage.getItem(ABORDAGENS_INITIALIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Salva a lista completa de abordagens.
 */
export function saveAllAbordagens(list: AbordagemRecord[]): void {
  try {
    localStorage.setItem(ABORDAGENS_STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(ABORDAGENS_INITIALIZED_KEY, 'true');
  } catch (err) {
    console.error('Erro ao salvar abordagens:', err);
  }
}

/**
 * Retorna abordagens vinculadas a um suspeito específico (por ID ou nome).
 */
export function getAbordagensBySuspectId(suspectId: string, suspectNome?: string): AbordagemRecord[] {
  const all = getAllAbordagens();
  return all.filter((ab) => {
    if (ab.suspectId === suspectId) return true;
    if (suspectNome && ab.suspectNome && ab.suspectNome.trim().toUpperCase() === suspectNome.trim().toUpperCase()) {
      return true;
    }
    // Verifica se também consta na lista de outros abordados da ocorrência
    if (ab.outrosAbordados && ab.outrosAbordados.some((o) => o.suspectId === suspectId || (suspectNome && o.nome.toUpperCase() === suspectNome.toUpperCase()))) {
      return true;
    }
    return false;
  });
}

/**
 * Salva uma nova abordagem ou atualiza existente.
 * Se tiver outros abordados cadastrados, sincroniza o vínculo bidirecional!
 */
export function saveAbordagem(abordagem: AbordagemRecord): void {
  const list = getAllAbordagens();
  const index = list.findIndex((a) => a.id === abordagem.id);
  if (index >= 0) {
    list[index] = abordagem;
  } else {
    list.unshift(abordagem);
  }
  saveAllAbordagens(list);
}

/**
 * Remove uma abordagem pelo ID.
 */
export function deleteAbordagem(id: string): void {
  const list = getAllAbordagens();
  const filtered = list.filter((a) => a.id !== id);
  saveAllAbordagens(filtered);
}

/**
 * Remove todas as abordagens vinculadas a um suspeito específico.
 */
export function deleteAbordagensBySuspectId(suspectId: string): void {
  const list = getAllAbordagens();
  const filtered = list.filter((a) => a.suspectId !== suspectId);
  saveAllAbordagens(filtered);
}

