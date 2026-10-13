import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Key,
  Lock,
  Unlock,
  Check,
  X,
  Sliders,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Copy,
  Share2,
  MessageSquare,
  History,
  ShieldAlert,
  Send,
} from 'lucide-react';
import { AppUserProfile, UserPermissions } from '../types';
import {
  getAllUserProfiles,
  saveUserProfile,
  updateUserPermissions,
  deleteUserProfile,
  generateTemporaryPassword,
} from '../utils/userManagementStorage';
import { getCurrentSession } from '../utils/userAuth';
import {
  getAllActivityLogs,
  ActivityLogEntry,
  markLogsAsReadByMaster,
  getUnreadDeletionAttemptsCount,
} from '../utils/activityLog';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const POSTOS_GRADUACOES = [
  'Soldado',
  'Cabo',
  'Sargento',
  'Subtenente',
  'Tenente',
  'Capitão',
  'Major',
  'Tenente-coronel',
  'Coronel',
];

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<AppUserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPerfil, setFilterPerfil] = useState<'TODOS' | 'MASTER' | 'ADMIN' | 'OPERADOR_TATICO'>('TODOS');

  // Sub-telas no gerenciador:
  // 'list' -> Listagem de militares
  // 'create' -> Lançamento de novo usuário
  // 'permissions' -> Liberação de funções modulares
  // 'logs' -> Log de Atividade / Tentativas de exclusão
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'permissions' | 'logs'>('list');

  const [selectedUser, setSelectedUser] = useState<AppUserProfile | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

  // Formulário de Criação / Edição
  const [formData, setFormData] = useState({
    login: '',
    nome: '', // Nome funcional
    postoGraduacao: 'Soldado',
    batalhaoUnidade: 'BANCO DE DADOS',
    perfil: 'OPERADOR_TATICO' as 'MASTER' | 'ADMIN' | 'OPERADOR_TATICO',
    senhaTemporaria: '',
    mustChangePassword: true,
  });

  // Matriz de Permissões
  const [tempPermissions, setTempPermissions] = useState<UserPermissions>({
    cadastrarAbordagem: true,
    editarAbordagem: true,
    excluirAbordagem: false,
    visualizarDadosSigilosos: true,
    moduloOrcrimVisualizar: true,
    moduloOrcrimCadastrar: false,
    moduloOrcrimOrganograma: true,
    exportarRelatorios: true,
    gerenciarUsuarios: false,
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const currentSession = getCurrentSession();

  useEffect(() => {
    if (isOpen) {
      loadData();
      setCurrentView('list');
      setFeedback(null);
    }
  }, [isOpen]);

  const loadData = () => {
    const list = getAllUserProfiles();
    setUsers(list);
    setActivityLogs(getAllActivityLogs());
  };

  if (!isOpen) return null;

  const handleOpenCreate = () => {
    const autoPwd = generateTemporaryPassword();
    setFormData({
      login: '',
      nome: '',
      postoGraduacao: 'Soldado',
      batalhaoUnidade: 'BANCO DE DADOS',
      perfil: 'OPERADOR_TATICO',
      senhaTemporaria: autoPwd,
      mustChangePassword: true,
    });
    setSelectedUser(null);
    setCurrentView('create');
  };

  const handleOpenPermissions = (user: AppUserProfile) => {
    setSelectedUser(user);
    setTempPermissions({ ...user.permissoes });
    setCurrentView('permissions');
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.login.trim() || !formData.nome.trim()) {
      setFeedback('Preencha a matrícula e o nome funcional do militar.');
      return;
    }

    const isMaster = formData.login.trim() === '1779958' || formData.perfil === 'MASTER';

    const newUser: AppUserProfile = {
      login: formData.login.trim(),
      nome: formData.nome.trim().toUpperCase(),
      postoGraduacao: formData.postoGraduacao,
      batalhaoUnidade: formData.batalhaoUnidade.trim() || 'BANCO DE DADOS',
      perfil: isMaster ? 'MASTER' : formData.perfil,
      status: 'PENDENTE', // Nunca foi acessado ainda: pendente de 1º acesso
      mustChangePassword: formData.mustChangePassword,
      senhaTemporaria: formData.senhaTemporaria || formData.login.trim(),
      permissoes: isMaster
        ? {
            cadastrarAbordagem: true,
            editarAbordagem: true,
            excluirAbordagem: true,
            visualizarDadosSigilosos: true,
            moduloOrcrimVisualizar: true,
            moduloOrcrimCadastrar: true,
            moduloOrcrimOrganograma: true,
            exportarRelatorios: true,
            gerenciarUsuarios: true,
          }
        : formData.perfil === 'ADMIN'
        ? {
            cadastrarAbordagem: true,
            editarAbordagem: true,
            excluirAbordagem: true,
            visualizarDadosSigilosos: true,
            moduloOrcrimVisualizar: true,
            moduloOrcrimCadastrar: true,
            moduloOrcrimOrganograma: true,
            exportarRelatorios: true,
            gerenciarUsuarios: true,
          }
        : {
            cadastrarAbordagem: true,
            editarAbordagem: true,
            excluirAbordagem: false,
            visualizarDadosSigilosos: true,
            moduloOrcrimVisualizar: true,
            moduloOrcrimCadastrar: false,
            moduloOrcrimOrganograma: true,
            exportarRelatorios: true,
            gerenciarUsuarios: false,
          },
      criadoEm: new Date().toISOString(),
    };

    saveUserProfile(newUser, {
      login: currentSession?.login || '1779958',
      nome: currentSession?.nome || 'SD TEIXEIRA',
    });

    loadData();
    setFeedback(`Militar ${newUser.nome} (${newUser.login}) cadastrado com sucesso!`);
    setTimeout(() => {
      setFeedback(null);
      setCurrentView('list');
    }, 1500);
  };

  const handleSavePermissions = () => {
    if (!selectedUser) return;
    updateUserPermissions(selectedUser.login, tempPermissions, {
      login: currentSession?.login || '1779958',
      nome: currentSession?.nome || 'SD TEIXEIRA',
    });
    loadData();
    setFeedback(`Permissões atualizadas para ${selectedUser.nome}!`);
    setTimeout(() => {
      setFeedback(null);
      setCurrentView('list');
    }, 1500);
  };

  const handleDeleteUser = (user: AppUserProfile) => {
    if (user.login === '1779958') {
      setFeedback('⚠️ A conta Master raiz 1779958 possui imunidade total e não pode ser excluída.');
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    if (confirm(`Confirma a exclusão do militar ${user.nome} (Matrícula: ${user.login})?`)) {
      deleteUserProfile(user.login, {
        login: currentSession?.login || '1779958',
        nome: currentSession?.nome || 'SD TEIXEIRA',
      });
      loadData();
      setFeedback(`Militar ${user.login} excluído do sistema.`);
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const handleGenerateNewPwd = () => {
    const pwd = generateTemporaryPassword();
    setFormData((prev) => ({ ...prev, senhaTemporaria: pwd }));
  };

  const handleCopyPwd = () => {
    if (formData.senhaTemporaria) {
      navigator.clipboard.writeText(formData.senhaTemporaria);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  // Monta a mensagem de compartilhamento via WhatsApp
  const shareUserViaWhatsApp = (user: {
    nome: string;
    login: string;
    postoGraduacao?: string;
    perfil: string;
    senhaTemporaria?: string;
  }) => {
    const perfilLabel =
      user.perfil === 'MASTER'
        ? 'Master (Controle Total e Gestão)'
        : user.perfil === 'ADMIN'
        ? 'Administrador (Controle e Gestão)'
        : 'Operador Tático (Cadastros e Consultas)';

    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const message = `*SISTEMA TÁTICO OPERACIONAL - LIBERAÇÃO DE ACESSO*\n\nPrezado(a) *${user.postoGraduacao || ''} ${user.nome}*, seu acesso ao aplicativo operacional foi disponibilizado.\n\n*DADOS DO MILITAR:*\n• *Nome Funcional:* ${user.nome}\n• *Matrícula / ID Militar:* ${user.login}\n• *Posto / Graduação:* ${user.postoGraduacao || 'Militar'}\n• *Perfil de Acesso:* ${perfilLabel}\n• *Código de Acesso Provisório:* ${user.senhaTemporaria || user.login}\n• *Situação:* Pendente de Primeiro Acesso\n\n*LINK DE ACESSO AO SISTEMA:*\n${appUrl}\n\n_Orienta-se efetuar o primeiro acesso e alterar a senha de forma segura._`;

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Filtragem dos usuários
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.login.includes(searchTerm) ||
      (u.postoGraduacao && u.postoGraduacao.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesPerfil = filterPerfil === 'TODOS' || u.perfil === filterPerfil;
    return matchesSearch && matchesPerfil;
  });

  const unreadDeletionAttempts = getUnreadDeletionAttemptsCount();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        id="user-management-modal"
        className="relative w-full max-w-4xl bg-[#10141d] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Gerenciador de Usuários */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/90 bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-white">
                  Gestão de Usuários e Operadores
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 font-mono text-[10px] font-bold">
                  {users.length} {users.length === 1 ? 'Militar' : 'Militares'}
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 block">
                Cadastros, permissões táticas e auditoria de ações
              </span>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-users-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navegação entre Abas: Militares, Novo Usuário e Logs */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#0f121a] border-b border-neutral-800/80 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentView('list')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                currentView === 'list'
                  ? 'bg-[#182030] text-[#e5c07b] border border-[#c69c59]/50 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Militares Cadastrados ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                markLogsAsReadByMaster();
                setCurrentView('logs');
                loadData();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
                currentView === 'logs'
                  ? 'bg-[#182030] text-[#e5c07b] border border-[#c69c59]/50 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Log de Atividades</span>
              {unreadDeletionAttempts > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white font-mono text-[9px] font-black animate-pulse">
                  {unreadDeletionAttempts}
                </span>
              )}
            </button>
          </div>

          {currentView === 'list' && (
            <button
              type="button"
              id="btn-add-user"
              onClick={handleOpenCreate}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-md shadow-[#c69c59]/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-neutral-950 stroke-[2.5]" />
              <span>+ Novo Militar</span>
            </button>
          )}
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/70 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* ========================================================
              ABA 1: LISTAGEM DE MILITARES
             ======================================================== */}
          {currentView === 'list' && (
            <div className="space-y-4">
              {/* Barra de Busca e Filtro de Perfil */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome funcional, matrícula ou posto..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={filterPerfil}
                    onChange={(e: any) => setFilterPerfil(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-xs text-neutral-300 font-semibold outline-none"
                  >
                    <option value="TODOS">Todos os Perfis</option>
                    <option value="MASTER">Master (1779958)</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="OPERADOR_TATICO">Operador Tático</option>
                  </select>
                </div>
              </div>

              {/* Tabela / Cards de Militares */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredUsers.map((u) => {
                  const isMasterUser = u.login === '1779958' || u.perfil === 'MASTER';
                  const isPendente = u.status === 'PENDENTE' || u.status === 'PRIMEIRO_ACESSO';

                  return (
                    <div
                      key={u.login}
                      className="p-3.5 rounded-2xl bg-[#141923] border border-neutral-800 hover:border-[#c69c59]/50 transition-all flex flex-col justify-between gap-3 shadow-md"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-[#e5c07b] bg-[#1a2233] px-2 py-0.5 rounded-md border border-[#c69c59]/30">
                                {u.login}
                              </span>
                              <span className="font-extrabold text-white text-xs uppercase">
                                {u.postoGraduacao ? `${u.postoGraduacao} ` : ''}{u.nome}
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-400 block mt-0.5">
                              Unidade: {u.batalhaoUnidade || 'BANCO DE DADOS'}
                            </span>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {isMasterUser ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-black uppercase">
                                MASTER
                              </span>
                            ) : u.perfil === 'ADMIN' ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px] font-mono font-bold uppercase">
                                ADMIN
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-[10px] font-mono font-bold uppercase">
                                OPERADOR
                              </span>
                            )}

                            {isPendente ? (
                              <span className="px-2 py-0.2 rounded-full bg-amber-900/60 border border-amber-600/50 text-amber-300 text-[9px] font-bold">
                                ⏳ Pendente
                              </span>
                            ) : u.status === 'BLOQUEADO' ? (
                              <span className="px-2 py-0.2 rounded-full bg-red-950 border border-red-500 text-red-400 text-[9px] font-bold">
                                🚫 Bloqueado
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 text-[9px] font-bold">
                                ✓ Ativo
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Senha provisória para compartilhar se pendente */}
                        {u.senhaTemporaria && (
                          <div className="flex items-center justify-between text-[10px] bg-[#0f131c] px-2.5 py-1.5 rounded-lg border border-neutral-800">
                            <span className="text-neutral-400">
                              Código / Senha Provisória: <strong className="text-amber-300 font-mono">{u.senhaTemporaria}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Ações do Card */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/80 flex-wrap">
                        {/* Botão de Compartilhar via WhatsApp */}
                        <button
                          type="button"
                          onClick={() => shareUserViaWhatsApp(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Enviar credenciais via WhatsApp"
                        >
                          <Send className="w-3 h-3 text-emerald-400" />
                          <span>WhatsApp</span>
                        </button>

                        <div className="flex items-center gap-1.5 ml-auto">
                          {/* Liberação de Funções */}
                          <button
                            type="button"
                            onClick={() => handleOpenPermissions(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#182030] hover:bg-[#202c44] text-[#e5c07b] border border-[#c69c59]/40 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="Ajustar permissões do militar"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Funções</span>
                          </button>

                          {/* Exclusão (exceto master 1779958) */}
                          {!isMasterUser && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-800 transition-colors cursor-pointer"
                              title="Remover militar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              ABA 2: LANÇAMENTO DE NOVO USUÁRIO COM WHATSAPP
             ======================================================== */}
          {currentView === 'create' && (
            <div className="max-w-2xl mx-auto space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Lançamento de Novo Usuário Militar
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Definição de matrícula, nome funcional, posto e perfil de acesso
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
                >
                  ← Voltar
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Nome Funcional <span className="text-[#c69c59]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: SD SILVA / CB BARROSO"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Matrícula / ID Militar <span className="text-[#c69c59]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      placeholder="Ex: 1845209"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none font-mono font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Pós-Graduação / Posto
                    </label>
                    <select
                      value={formData.postoGraduacao}
                      onChange={(e) => setFormData({ ...formData, postoGraduacao: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 text-white text-xs outline-none font-semibold"
                    >
                      {POSTOS_GRADUACOES.map((posto) => (
                        <option key={posto} value={posto}>
                          {posto}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Batalhão / Unidade
                    </label>
                    <input
                      type="text"
                      value={formData.batalhaoUnidade}
                      onChange={(e) => setFormData({ ...formData, batalhaoUnidade: e.target.value })}
                      placeholder="Ex: BANCO DE DADOS / ROTAM"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 text-white text-xs outline-none uppercase font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                    Perfil de Acesso
                  </label>
                  <select
                    value={formData.perfil}
                    onChange={(e: any) => setFormData({ ...formData, perfil: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 text-white text-xs outline-none font-semibold"
                  >
                    <option value="OPERADOR_TATICO">Operador Tático (Cadastros & Consultas)</option>
                    <option value="ADMIN">Administrador (Controle e Gestão)</option>
                    <option value="MASTER">Master (Controle Total & Gestão Total do Aplicativo)</option>
                  </select>
                </div>

                {/* Código de Acesso / Senha Temporária */}
                <div className="p-4 rounded-2xl bg-[#141923] border border-[#c69c59]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#e5c07b] flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-[#c69c59]" />
                      <span>Código de Acesso Provisório (Primeiro Acesso)</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateNewPwd}
                      className="text-[11px] text-[#e5c07b] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Gerar Outro</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formData.senhaTemporaria}
                      onChange={(e) => setFormData({ ...formData, senhaTemporaria: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#0f131a] border border-neutral-700 text-white font-mono text-sm tracking-wider font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPwd}
                      className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedKey ? 'Copiada!' : 'Copiar'}</span>
                    </button>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={formData.mustChangePassword}
                      onChange={(e) => setFormData({ ...formData, mustChangePassword: e.target.checked })}
                      className="rounded bg-neutral-900 border-neutral-700 text-[#c69c59]"
                    />
                    <span className="text-[11px] text-neutral-300">
                      Exigir alteração obrigatória de senha no primeiro login
                    </span>
                  </label>
                </div>

                {/* Botões de Ação com WhatsApp */}
                <div className="flex items-center justify-between gap-3 pt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.nome || !formData.login) {
                        setFeedback('Preencha o nome funcional e a matrícula antes de compartilhar.');
                        return;
                      }
                      shareUserViaWhatsApp(formData);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>Compartilhar via WhatsApp</span>
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setCurrentView('list')}
                      className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer"
                    >
                      Salvar Usuário
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================
              ABA 3: LIBERAÇÃO DE FUNÇÕES NO APP
             ======================================================== */}
          {currentView === 'permissions' && selectedUser && (
            <div className="max-w-xl mx-auto space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Liberação de Funções no App
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Defina individualmente os privilégios operacionais de{' '}
                    <span className="text-white font-bold">{selectedUser.nome}</span> ({selectedUser.login})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
                >
                  ← Voltar
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                {[
                  { key: 'cadastrarAbordagem', label: 'Cadastrar Novos Abordados / Registros' },
                  { key: 'editarAbordagem', label: 'Editar Fichas e Registros Existentes' },
                  { key: 'excluirAbordagem', label: 'Excluir Registros do Banco de Dados' },
                  { key: 'visualizarDadosSigilosos', label: 'Visualizar Dados Sigilosos (CPF, RG, Mãe)' },
                  { key: 'moduloOrcrimVisualizar', label: 'Visualizar Módulo ORCRIM e Facções' },
                  { key: 'moduloOrcrimCadastrar', label: 'Cadastrar / Editar Novas Facções' },
                  { key: 'moduloOrcrimOrganograma', label: 'Acessar e Mover Integrantes no Organograma' },
                  { key: 'exportarRelatorios', label: 'Gerar e Exportar Relatórios em PDF' },
                  { key: 'gerenciarUsuarios', label: 'Gestão de Usuários e Operadores' },
                ].map(({ key, label }) => {
                  const permKey = key as keyof UserPermissions;
                  const isChecked = Boolean(tempPermissions[permKey]);

                  return (
                    <label
                      key={key}
                      className="p-3 rounded-xl bg-[#141923] border border-neutral-800 hover:border-neutral-700 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="font-semibold text-neutral-200">{label}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setTempPermissions((prev) => ({
                            ...prev,
                            [permKey]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-[#c69c59] focus:ring-0"
                      />
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  className="px-6 py-2.5 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer"
                >
                  Confirmar Funções
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              ABA 4: LOG DE ATIVIDADE E AUDITORIA (Com Alerta de Exclusão)
             ======================================================== */}
          {currentView === 'logs' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-[#c69c59]" />
                    <span>Log de Atividades e Auditoria Tática</span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Histórico de acessos, cadastros e tentativas de exclusão de cards bloqueadas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
                >
                  ← Voltar
                </button>
              </div>

              {activityLogs.length > 0 ? (
                <div className="space-y-2.5">
                  {activityLogs.map((log) => {
                    const isExclusao = log.tipo === 'TENTATIVA_EXCLUSAO';

                    return (
                      <div
                        key={log.id}
                        className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all ${
                          isExclusao
                            ? 'bg-rose-950/40 border-rose-600/70 shadow-rose-900/20 shadow-md'
                            : 'bg-[#141923] border-neutral-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isExclusao ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                            )}
                            <h4
                              className={`font-black uppercase tracking-wider text-xs ${
                                isExclusao ? 'text-rose-200 font-mono' : 'text-white'
                              }`}
                            >
                              {log.titulo}
                            </h4>
                          </div>

                          <span className="text-[10px] font-mono text-neutral-400 flex-shrink-0">
                            {new Date(log.dataHora).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        <p className="text-neutral-300 text-xs leading-relaxed pl-4">
                          {log.descricao}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 pl-4 border-t border-neutral-800/60 font-mono">
                          <span>
                            Operador / Solicitante: <strong className="text-white">{log.usuarioNome}</strong> ({log.usuarioLogin})
                          </span>
                          {isExclusao && (
                            <span className="px-2 py-0.5 rounded bg-rose-900 text-rose-200 font-bold uppercase text-[9px]">
                              Ação Bloqueada
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl border border-dashed border-neutral-800 bg-[#0d1017]">
                  <History className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400 font-semibold">
                    Nenhuma atividade registrada no log até o momento.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
