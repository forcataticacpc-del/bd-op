import { INITIAL_USERS, UserData } from '../data/initialUsers';
import { getSyncConfig } from './storage';

export interface AppUser {
  login: string;
  nome: string;
  senha?: string;
  isMaster: boolean;
  isRoot?: boolean;
  mustChangePassword?: boolean;
  criadoEm?: string;
  ultimoAcesso?: string;
}

export interface UserSession {
  login: string;
  nome: string;
  isMaster: boolean;
  isRoot: boolean;
  loginTime: number;
  expiresAt: number; // 24 horas a partir do login
  rememberMe: boolean;
}

const USERS_STORAGE_KEY = 'ft_authorized_users_v2';
const SESSION_STORAGE_KEY = 'ft_user_session_v2';
const ROOT_LOGIN = '1779958'; // SD TEIXEIRA - Imunidade total

const RESET_FLAG_KEY = 'ft_users_reset_v3_teixeira';

/**
 * Carrega a lista de usuários autorizados do armazenamento local.
 * Reset efetuado mantendo exclusivamente Soldado Teixeira 1779958.
 */
export function getAuthorizedUsers(): AppUser[] {
  try {
    // Verifica se já realizou o reset solicitado
    if (localStorage.getItem(RESET_FLAG_KEY) !== 'true') {
      localStorage.setItem(RESET_FLAG_KEY, 'true');
      const resetList: AppUser[] = [
        {
          login: ROOT_LOGIN,
          nome: 'SD TEIXEIRA',
          senha: ROOT_LOGIN,
          isMaster: true,
          isRoot: true,
          mustChangePassword: false,
          criadoEm: new Date().toISOString(),
        },
      ];
      saveUsersLocally(resetList);
      return resetList;
    }

    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed: AppUser[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((u) => {
          if (u.login === ROOT_LOGIN) {
            return { ...u, isMaster: true, isRoot: true };
          }
          return u;
        });
      }
    }
  } catch (e) {
    console.error('Erro ao ler usuários autorizados do localStorage:', e);
  }

  // Inicializa com SD Teixeira
  const initialized: AppUser[] = [
    {
      login: ROOT_LOGIN,
      nome: 'SD TEIXEIRA',
      senha: ROOT_LOGIN,
      isMaster: true,
      isRoot: true,
      mustChangePassword: false,
      criadoEm: new Date().toISOString(),
    },
  ];

  saveUsersLocally(initialized);
  return initialized;
}

export function saveUsersLocally(users: AppUser[]): void {
  try {
    // Garante que o Root nunca seja modificado para não-master
    const safeUsers = users.map((u) => {
      if (u.login === ROOT_LOGIN) {
        return { ...u, isMaster: true, isRoot: true };
      }
      return u;
    });
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(safeUsers));
  } catch (e) {
    console.error('Erro ao salvar usuários autorizados:', e);
  }
}

/**
 * Obtém a sessão ativa do usuário.
 * Sessão tem validade estrita de 24 horas (1 dia inteiro).
 */
export function getCurrentSession(): UserSession | null {
  try {
    let raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    }
    if (!raw) return null;

    const session: UserSession = JSON.parse(raw);
    const now = Date.now();

    // Valida a expiração de 24 horas
    if (!session.expiresAt || now > session.expiresAt) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    clearSession();
    return null;
  }
}

/**
 * Salva a sessão ativa com duração de 24 horas (mesmo fechando o app).
 */
export function saveSession(user: AppUser, rememberMe: boolean = true): UserSession {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 horas exatas

  const session: UserSession = {
    login: user.login,
    nome: user.nome,
    isMaster: Boolean(user.isMaster || user.isRoot),
    isRoot: Boolean(user.isRoot || user.login === ROOT_LOGIN),
    loginTime: now,
    expiresAt: now + ONE_DAY_MS,
    rememberMe,
  };

  try {
    const serialized = JSON.stringify(session);
    // Grava sempre no localStorage para persistir fechamento do app conforme especificado
    localStorage.setItem(SESSION_STORAGE_KEY, serialized);
    sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Erro ao salvar sessão de usuário:', e);
  }

  return session;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

export const logoutUser = clearSession;

/**
 * Autentica o usuário com número funcional e senha.
 */
export async function authenticateUser(
  login: string,
  senhaDigitada: string
): Promise<{
  success: boolean;
  user?: AppUser;
  mustChangePassword?: boolean;
  message?: string;
}> {
  const cleanLogin = login.trim();
  const cleanSenha = senhaDigitada.trim();

  if (!cleanLogin || !cleanSenha) {
    return { success: false, message: 'Informe o número funcional e a senha.' };
  }

  // Sincroniza usuários com a nuvem em background se disponível
  syncUsersFromCloud().catch(() => {});

  const users = getAuthorizedUsers();
  const user = users.find((u) => u.login === cleanLogin);

  if (!user) {
    return {
      success: false,
      message: 'Número funcional não autorizado ou não cadastrado no sistema.',
    };
  }

  const expectedSenha = user.senha || user.login;
  if (cleanSenha !== expectedSenha) {
    return {
      success: false,
      message: 'Senha incorreta. Verifique os dados digitados.',
    };
  }

  // Verifica se é o primeiro acesso (senha igual ao login ou flag ativa)
  const isFirstAccess = Boolean(user.mustChangePassword || cleanSenha === user.login);

  // Atualiza último acesso
  user.ultimoAcesso = new Date().toISOString();
  saveUsersLocally(users);

  return {
    success: true,
    user,
    mustChangePassword: isFirstAccess,
  };
}

/**
 * Altera a senha do usuário (obrigatório no 1º acesso ou sob demanda).
 */
export async function changeUserPassword(
  login: string,
  novaSenha: string
): Promise<{ success: boolean; message: string }> {
  const cleanLogin = login.trim();
  const cleanNova = novaSenha.trim();

  if (!cleanNova) {
    return { success: false, message: 'A nova senha não pode ser vazia.' };
  }
  if (cleanNova === cleanLogin) {
    return {
      success: false,
      message: 'A nova senha deve ser diferente do número funcional.',
    };
  }
  if (cleanNova.length < 4) {
    return {
      success: false,
      message: 'A nova senha deve ter pelo menos 4 caracteres.',
    };
  }

  const users = getAuthorizedUsers();
  const userIndex = users.findIndex((u) => u.login === cleanLogin);

  if (userIndex === -1) {
    return { success: false, message: 'Usuário não encontrado.' };
  }

  users[userIndex].senha = cleanNova;
  users[userIndex].mustChangePassword = false;
  users[userIndex].ultimoAcesso = new Date().toISOString();

  saveUsersLocally(users);

  // Envia a alteração para a aba dedicada USUARIOS na Planilha Google
  sendUserUpdateToCloud(users[userIndex], 'update_password').catch((err) => {
    console.warn('Aviso sincronização de senha na nuvem:', err);
  });

  return {
    success: true,
    message: 'Senha alterada com sucesso!',
  };
}

/**
 * Adiciona um novo militar à lista autorizada (Exige senha master).
 */
export async function addUserByMaster(
  operatorLogin: string,
  masterPasswordConfirmation: string,
  newLogin: string,
  newNome: string
): Promise<{ success: boolean; message: string; newUser?: AppUser }> {
  const cleanNewLogin = newLogin.trim();
  const cleanNewNome = newNome.trim().toUpperCase();

  if (!cleanNewLogin || !cleanNewNome) {
    return { success: false, message: 'Preencha o número funcional e o nome.' };
  }

  // Validação da autorização Master do operador
  const users = getAuthorizedUsers();
  const operator = users.find((u) => u.login === operatorLogin);
  if (!operator || (!operator.isMaster && !operator.isRoot)) {
    return {
      success: false,
      message: 'Apenas operadores com perfil Master podem adicionar novos usuários.',
    };
  }

  if ((operator.senha || operator.login) !== masterPasswordConfirmation.trim()) {
    return {
      success: false,
      message: 'Senha Master incorreta. Operação cancelada.',
    };
  }

  // Verifica duplicidade
  if (users.some((u) => u.login === cleanNewLogin)) {
    return {
      success: false,
      message: `O militar com login ${cleanNewLogin} já está cadastrado no sistema.`,
    };
  }

  const newUser: AppUser = {
    login: cleanNewLogin,
    nome: cleanNewNome,
    senha: cleanNewLogin, // Padrão igual ao login
    mustChangePassword: true,
    isMaster: false,
    isRoot: false,
    criadoEm: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsersLocally(users);

  // Sincroniza com a aba de usuários na Planilha Google
  sendUserUpdateToCloud(newUser, 'add_user').catch((err) => {
    console.warn('Aviso ao sincronizar novo usuário na nuvem:', err);
  });

  return {
    success: true,
    message: `Usuário ${cleanNewLogin} – ${cleanNewNome} adicionado com sucesso!`,
    newUser,
  };
}

/**
 * Apaga um usuário do sistema e da aba da planilha (Exige senha master).
 * Proteção da Conta Raiz: 1779958 NUNCA pode ser apagada.
 */
export async function deleteUserByMaster(
  operatorLogin: string,
  masterPasswordConfirmation: string,
  targetLogin: string
): Promise<{ success: boolean; message: string }> {
  const cleanTarget = targetLogin.trim();

  if (cleanTarget === ROOT_LOGIN) {
    return {
      success: false,
      message: 'A conta raiz 1779958 (SD TEIXEIRA) possui imunidade absoluta e NÃO pode ser excluída.',
    };
  }

  const users = getAuthorizedUsers();
  const operator = users.find((u) => u.login === operatorLogin);
  if (!operator || (!operator.isMaster && !operator.isRoot)) {
    return {
      success: false,
      message: 'Apenas operadores com perfil Master podem excluir usuários.',
    };
  }

  if ((operator.senha || operator.login) !== masterPasswordConfirmation.trim()) {
    return {
      success: false,
      message: 'Senha Master incorreta. Operação cancelada.',
    };
  }

  const targetIndex = users.findIndex((u) => u.login === cleanTarget);
  if (targetIndex === -1) {
    return { success: false, message: 'Usuário não localizado.' };
  }

  const removedUser = users.splice(targetIndex, 1)[0];
  saveUsersLocally(users);

  // Remove da planilha Google
  sendUserDeleteToCloud(cleanTarget).catch((err) => {
    console.warn('Aviso ao excluir usuário na nuvem:', err);
  });

  return {
    success: true,
    message: `Usuário ${removedUser.login} – ${removedUser.nome} excluído com sucesso do sistema e do banco de dados em nuvem.`,
  };
}

/**
 * Concede ou revoga privilégios Master em cadeia.
 * Proteção da Conta Raiz: 1779958 NUNCA pode perder privilégios master.
 */
export async function setMasterPrivileges(
  operatorLogin: string,
  masterPasswordConfirmation: string,
  targetLogin: string,
  grantMaster: boolean
): Promise<{ success: boolean; message: string }> {
  const cleanTarget = targetLogin.trim();

  if (cleanTarget === ROOT_LOGIN && !grantMaster) {
    return {
      success: false,
      message: 'A conta raiz 1779958 (SD TEIXEIRA) possui imunidade total e em hipótese alguma poderá perder os privilégios master.',
    };
  }

  const users = getAuthorizedUsers();
  const operator = users.find((u) => u.login === operatorLogin);
  if (!operator || (!operator.isMaster && !operator.isRoot)) {
    return {
      success: false,
      message: 'Apenas operadores com perfil Master podem conceder ou revogar privilégios.',
    };
  }

  if ((operator.senha || operator.login) !== masterPasswordConfirmation.trim()) {
    return {
      success: false,
      message: 'Senha Master incorreta. Operação cancelada.',
    };
  }

  const targetUser = users.find((u) => u.login === cleanTarget);
  if (!targetUser) {
    return { success: false, message: 'Usuário não localizado.' };
  }

  targetUser.isMaster = grantMaster;
  saveUsersLocally(users);

  sendUserUpdateToCloud(targetUser, 'set_master').catch((err) => {
    console.warn('Aviso ao sincronizar privilégios master na nuvem:', err);
  });

  return {
    success: true,
    message: grantMaster
      ? `Privilégios de Administrador Master CONCEDIDOS com sucesso a ${targetUser.login} – ${targetUser.nome}.`
      : `Privilégios Master REVOGADOS de ${targetUser.login} – ${targetUser.nome}.`,
  };
}

// ============================================================================
// SINCRONIZAÇÃO COM A ABA DEDICADA "USUARIOS" NA PLANILHA GOOGLE
// ============================================================================

async function sendUserUpdateToCloud(user: AppUser, action: string): Promise<void> {
  const config = getSyncConfig();
  const webhookUrl = config?.webhookUrl;
  if (!webhookUrl) return;

  const payload = {
    action: 'save_user',
    userAction: action,
    webhookUrl,
    user: {
      login: user.login,
      nome: user.nome,
      senha: user.senha || user.login,
      isMaster: Boolean(user.isMaster),
      isRoot: Boolean(user.isRoot),
      mustChangePassword: Boolean(user.mustChangePassword),
      statusExibicao: '****', // Sempre oculto
      criadoEm: user.criadoEm || new Date().toISOString(),
      ultimoAcesso: user.ultimoAcesso || new Date().toISOString(),
    },
  };

  try {
    await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('Falha no envio de usuário ao servidor proxy, tentando direto:', e);
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch {}
  }
}

async function sendUserDeleteToCloud(login: string): Promise<void> {
  const config = getSyncConfig();
  const webhookUrl = config?.webhookUrl;
  if (!webhookUrl) return;

  const payload = {
    action: 'delete_user',
    webhookUrl,
    login,
  };

  try {
    await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch {}
  }
}

export async function syncUsersFromCloud(): Promise<void> {
  const config = getSyncConfig();
  const webhookUrl = config?.webhookUrl;
  if (!webhookUrl) return;

  try {
    const res = await fetch(`/api/sheets?action=get_users&webhookUrl=${encodeURIComponent(webhookUrl)}&_t=${Date.now()}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.status === 'success' && Array.isArray(json.users) && json.users.length > 0) {
        const local = getAuthorizedUsers();
        const map = new Map<string, AppUser>();
        local.forEach((u) => map.set(u.login, u));

        for (const cloudUser of json.users) {
          if (!cloudUser.login) continue;
          const existing = map.get(cloudUser.login);
          if (existing) {
            // Se a nuvem tiver senha atualizada
            if (cloudUser.senha && cloudUser.senha !== '****') {
              existing.senha = cloudUser.senha;
            }
            if (typeof cloudUser.isMaster === 'boolean') {
              existing.isMaster = cloudUser.isMaster;
            }
            if (typeof cloudUser.mustChangePassword === 'boolean') {
              existing.mustChangePassword = cloudUser.mustChangePassword;
            }
          } else {
            map.set(cloudUser.login, {
              login: cloudUser.login,
              nome: cloudUser.nome || cloudUser.login,
              senha: cloudUser.senha || cloudUser.login,
              isMaster: Boolean(cloudUser.isMaster),
              isRoot: cloudUser.login === ROOT_LOGIN,
              mustChangePassword: Boolean(cloudUser.mustChangePassword),
            });
          }
        }

        saveUsersLocally(Array.from(map.values()));
      }
    }
  } catch (err) {
    console.warn('Aviso sincronização de usuários da nuvem:', err);
  }
}
