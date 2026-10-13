import { AppUserProfile, UserPermissions } from '../types';
import { getAuthorizedUsers, saveUsersLocally, AppUser } from './userAuth';
import { logActivity } from './activityLog';

const USER_PROFILES_KEY = 'ft_user_profiles_v2';
const RESET_FLAG_KEY = 'ft_user_profiles_reset_v3_teixeira';

const DEFAULT_PERMISSIONS: UserPermissions = {
  cadastrarAbordagem: true,
  editarAbordagem: true,
  excluirAbordagem: false,
  visualizarDadosSigilosos: true,
  moduloOrcrimVisualizar: true,
  moduloOrcrimCadastrar: false,
  moduloOrcrimOrganograma: true,
  exportarRelatorios: true,
  gerenciarUsuarios: false,
};

const ADMIN_PERMISSIONS: UserPermissions = {
  cadastrarAbordagem: true,
  editarAbordagem: true,
  excluirAbordagem: true,
  visualizarDadosSigilosos: true,
  moduloOrcrimVisualizar: true,
  moduloOrcrimCadastrar: true,
  moduloOrcrimOrganograma: true,
  exportarRelatorios: true,
  gerenciarUsuarios: true,
};

const MASTER_PERMISSIONS: UserPermissions = {
  cadastrarAbordagem: true,
  editarAbordagem: true,
  excluirAbordagem: true,
  visualizarDadosSigilosos: true,
  moduloOrcrimVisualizar: true,
  moduloOrcrimCadastrar: true,
  moduloOrcrimOrganograma: true,
  exportarRelatorios: true,
  gerenciarUsuarios: true,
};

/**
 * Carrega a lista completa de perfis de usuários com suas permissões.
 * Reset efetuado preservando exclusivamente o Soldado Teixeira 1779958 como Master.
 */
export function getAllUserProfiles(): AppUserProfile[] {
  try {
    if (localStorage.getItem(RESET_FLAG_KEY) !== 'true') {
      localStorage.setItem(RESET_FLAG_KEY, 'true');
      const resetMaster: AppUserProfile[] = [
        {
          login: '1779958',
          nome: 'SD TEIXEIRA',
          postoGraduacao: 'Soldado',
          batalhaoUnidade: 'BANCO DE DADOS',
          perfil: 'MASTER',
          status: 'ATIVO',
          mustChangePassword: false,
          permissoes: { ...MASTER_PERMISSIONS },
          criadoEm: new Date().toISOString(),
          ultimoAcesso: new Date().toISOString(),
        },
      ];
      saveAllUserProfiles(resetMaster);
      return resetMaster;
    }

    const raw = localStorage.getItem(USER_PROFILES_KEY);
    if (raw) {
      const parsed: AppUserProfile[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p) => {
          if (p.login === '1779958') {
            return {
              ...p,
              nome: 'SD TEIXEIRA',
              perfil: 'MASTER',
              status: 'ATIVO',
              permissoes: { ...MASTER_PERMISSIONS },
            };
          }
          return p;
        });
      }
    }
  } catch (e) {
    console.error('Erro ao ler perfis de usuários:', e);
  }

  // Fallback padrão: SD Teixeira 1779958 Master
  const initialMaster: AppUserProfile[] = [
    {
      login: '1779958',
      nome: 'SD TEIXEIRA',
      postoGraduacao: 'Soldado',
      batalhaoUnidade: 'BANCO DE DADOS',
      perfil: 'MASTER',
      status: 'ATIVO',
      mustChangePassword: false,
      permissoes: { ...MASTER_PERMISSIONS },
      criadoEm: new Date().toISOString(),
      ultimoAcesso: new Date().toISOString(),
    },
  ];

  saveAllUserProfiles(initialMaster);
  return initialMaster;
}

export function saveAllUserProfiles(profiles: AppUserProfile[]): void {
  try {
    localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Erro ao salvar perfis de usuários:', e);
  }
}

/**
 * Cria ou atualiza um usuário no sistema (sincronizando auth e permissões).
 */
export function saveUserProfile(profile: AppUserProfile, operatorInfo?: { login: string; nome: string }): void {
  const list = getAllUserProfiles();
  const index = list.findIndex((p) => p.login === profile.login);

  const isMaster = profile.login === '1779958' || profile.perfil === 'MASTER';
  const finalProfile: AppUserProfile = {
    ...profile,
    perfil: isMaster ? 'MASTER' : profile.perfil,
    permissoes: isMaster
      ? { ...MASTER_PERMISSIONS }
      : profile.perfil === 'ADMIN'
      ? { ...ADMIN_PERMISSIONS }
      : profile.permissoes || { ...DEFAULT_PERMISSIONS },
  };

  const isNew = index < 0;

  if (index >= 0) {
    list[index] = finalProfile;
  } else {
    list.unshift(finalProfile);
  }

  saveAllUserProfiles(list);

  // Sincroniza com a lista de autenticação
  const authUsers = getAuthorizedUsers();
  const authIdx = authUsers.findIndex((u) => u.login === finalProfile.login);
  if (authIdx >= 0) {
    authUsers[authIdx].nome = finalProfile.nome;
    authUsers[authIdx].isMaster = isMaster || finalProfile.perfil === 'ADMIN';
    if (finalProfile.senhaTemporaria) {
      authUsers[authIdx].senha = finalProfile.senhaTemporaria;
      authUsers[authIdx].mustChangePassword = finalProfile.mustChangePassword;
    }
  } else {
    authUsers.push({
      login: finalProfile.login,
      nome: finalProfile.nome,
      senha: finalProfile.senhaTemporaria || finalProfile.login,
      isMaster: isMaster || finalProfile.perfil === 'ADMIN',
      isRoot: finalProfile.login === '1779958',
      mustChangePassword: finalProfile.mustChangePassword,
      criadoEm: finalProfile.criadoEm,
    });
  }
  saveUsersLocally(authUsers);

  // Registra no log de atividade
  logActivity({
    tipo: isNew ? 'NOVO_USUARIO' : 'PERMISSAO_ALTERADA',
    titulo: isNew ? `Novo Militar Cadastrado: ${finalProfile.nome}` : `Dados de Usuário Atualizados: ${finalProfile.nome}`,
    descricao: `Matrícula: ${finalProfile.login} | Posto: ${finalProfile.postoGraduacao || 'Militar'} | Perfil: ${finalProfile.perfil} | Status: ${finalProfile.status}`,
    usuarioLogin: operatorInfo?.login || '1779958',
    usuarioNome: operatorInfo?.nome || 'SD TEIXEIRA',
    detalhes: {
      matricula: finalProfile.login,
      perfil: finalProfile.perfil,
      status: finalProfile.status,
    },
  });
}

/**
 * Exclui um usuário (exceto root/master 1779958)
 */
export function deleteUserProfile(login: string, operatorInfo?: { login: string; nome: string }): boolean {
  if (login === '1779958') return false;

  const list = getAllUserProfiles().filter((p) => p.login !== login);
  saveAllUserProfiles(list);

  const authUsers = getAuthorizedUsers().filter((u) => u.login !== login);
  saveUsersLocally(authUsers);

  logActivity({
    tipo: 'PERMISSAO_ALTERADA',
    titulo: `Militar Removido do Sistema: ${login}`,
    descricao: `O usuário de matrícula ${login} foi excluído da base de acesso pelo operador.`,
    usuarioLogin: operatorInfo?.login || '1779958',
    usuarioNome: operatorInfo?.nome || 'SD TEIXEIRA',
  });

  return true;
}

/**
 * Atualiza apenas as permissões modulares de um usuário.
 */
export function updateUserPermissions(login: string, permissoes: UserPermissions, operatorInfo?: { login: string; nome: string }): void {
  const list = getAllUserProfiles();
  const profile = list.find((p) => p.login === login);
  if (profile) {
    profile.permissoes = permissoes;
    saveAllUserProfiles(list);

    logActivity({
      tipo: 'PERMISSAO_ALTERADA',
      titulo: `Permissões Modulares Alteradas: ${profile.nome}`,
      descricao: `Funções do operador ${profile.login} foram atualizadas na matriz de controle.`,
      usuarioLogin: operatorInfo?.login || '1779958',
      usuarioNome: operatorInfo?.nome || 'SD TEIXEIRA',
    });
  }
}

/**
 * Gera uma senha temporária alfanumérica segura.
 */
export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = 'FT@';
  for (let i = 0; i < 5; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}
