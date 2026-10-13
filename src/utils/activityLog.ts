export interface ActivityLogEntry {
  id: string;
  tipo: 'TENTATIVA_EXCLUSAO' | 'NOVO_USUARIO' | 'PERMISSAO_ALTERADA' | 'LOGIN' | 'SENHA_ALTERADA' | 'ORCRIM_CRIADA' | 'VINCULO_CRIADO';
  titulo: string;
  descricao: string;
  usuarioLogin: string;
  usuarioNome: string;
  dataHora: string;
  lidoPorMaster?: boolean;
  detalhes?: Record<string, any>;
}

const ACTIVITY_LOG_KEY = 'ft_activity_logs_v1';

export function getAllActivityLogs(): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler logs de atividade:', e);
  }
  return [];
}

export function saveAllActivityLogs(logs: ActivityLogEntry[]): void {
  try {
    localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(logs.slice(0, 200)));
  } catch (e) {
    console.error('Erro ao salvar logs de atividade:', e);
  }
}

export function logActivity(entry: Omit<ActivityLogEntry, 'id' | 'dataHora'>): ActivityLogEntry {
  const newEntry: ActivityLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    dataHora: new Date().toISOString(),
    lidoPorMaster: false,
  };

  const current = getAllActivityLogs();
  current.unshift(newEntry);
  saveAllActivityLogs(current);
  return newEntry;
}

export function markLogsAsReadByMaster(): void {
  const current = getAllActivityLogs();
  const updated = current.map((log) => ({ ...log, lidoPorMaster: true }));
  saveAllActivityLogs(updated);
}

export function getUnreadDeletionAttemptsCount(): number {
  const current = getAllActivityLogs();
  return current.filter((log) => log.tipo === 'TENTATIVA_EXCLUSAO' && !log.lidoPorMaster).length;
}
