import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Users,
  Network,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  MapPin,
  ChevronRight,
  ExternalLink,
  UserPlus,
  Trash2,
  Crown,
  Flame,
  Radio,
  Layers,
  Edit3,
  User,
  Clock,
  FileDown,
  Upload,
  GripVertical,
  Camera,
} from 'lucide-react';
import {
  OrcrimRecord,
  OrcrimMembro,
  OrcrimMembroFuncao,
  OrcrimPericulosidade,
  OrcrimStatus,
  SuspectRecord,
} from '../types';
import {
  getAllOrcrims,
  saveOrcrim,
  deleteOrcrim,
  resetOrcrimsToDefaults,
  checkOrcrimDuplicate,
  linkSuspectToOrcrim,
  unlinkSuspectFromOrcrim,
  getFuncaoLabel,
} from '../utils/orcrimStorage';
import { generateOrganogramaPdf, exportOrganogramaAsImage } from '../utils/orcrimPdfExport';
import { ExportOrcrimPdfModal } from './ExportOrcrimPdfModal';
import { AddNovoMembroModal } from './AddNovoMembroModal';
import { OrcrimEnderecosTab } from './OrcrimEnderecosTab';

interface OrcrimModalProps {
  isOpen: boolean;
  onClose: () => void;
  allSuspects: SuspectRecord[];
  onSelectSuspect?: (suspect: SuspectRecord) => void;
  initialTab?: 'visao_geral' | 'integrantes' | 'enderecos' | 'organograma' | 'historico';
}

export const OrcrimModal: React.FC<OrcrimModalProps> = ({
  isOpen,
  onClose,
  allSuspects = [],
  onSelectSuspect,
  initialTab,
}) => {
  const [orcrims, setOrcrims] = useState<OrcrimRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPericulosidade, setFilterPericulosidade] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<string>('TODAS');

  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'integrantes' | 'enderecos' | 'organograma' | 'historico'>('visao_geral');
  const [selectedOrcrim, setSelectedOrcrim] = useState<OrcrimRecord | null>(null);

  // Formulário de criação/edição da ORCRIM
  const [formData, setFormData] = useState<Partial<OrcrimRecord>>({
    nome: '',
    sigla: '',
    fotoSimbolo: '',
    origem: '',
    dataSurgimento: '',
    coresSimbolos: '',
    territorios: [],
    atividadesCriminosas: [],
    periculosidade: 'ALTA',
    status: 'ATIVA',
    liderPrincipal: '',
    observacoes: '',
  });
  const [territorioInput, setTerritorioInput] = useState('');
  const [atividadeInput, setAtividadeInput] = useState('');

  // Modais de ações adicionais
  const [duplicateWarning, setDuplicateWarning] = useState<OrcrimRecord | null>(null);
  const [isLinkingOpen, setIsLinkingOpen] = useState(false);
  const [isAddNovoMembroOpen, setIsAddNovoMembroOpen] = useState(false);
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false);
  const [isExportingOrganogramaPdf, setIsExportingOrganogramaPdf] = useState(false);
  const [orcrimToDelete, setOrcrimToDelete] = useState<OrcrimRecord | null>(null);
  const [membroToUnlink, setMembroToUnlink] = useState<{ id: string; nome: string } | null>(null);
  const [isDeletingOrcrim, setIsDeletingOrcrim] = useState(false);

  // Vinculação de Abordado Existente
  const [searchSuspectTerm, setSearchSuspectTerm] = useState('');
  const [selectedSuspectToLink, setSelectedSuspectToLink] = useState<SuspectRecord | null>(null);
  const [selectedFuncao, setSelectedFuncao] = useState<OrcrimMembroFuncao>('OPERACIONAL_SOLDADO');
  const [customFuncaoText, setCustomFuncaoText] = useState('');
  const [linkObs, setLinkObs] = useState('');

  // Arrastar e reordenar membros no organograma
  const [draggedMembroId, setDraggedMembroId] = useState<string | null>(null);

  // Edição rápida de função de membro no organograma / integrantes
  const [editingMembroId, setEditingMembroId] = useState<string | null>(null);
  const [editingFuncaoText, setEditingFuncaoText] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const simboloFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (initialTab === 'organograma') {
        getAllOrcrims().then((list) => {
          setOrcrims(list);
          if (list.length > 0) {
            setSelectedOrcrim(list[0]);
            setView('detail');
            setActiveTab('organograma');
          } else {
            setView('list');
          }
        });
      } else {
        setView('list');
      }
      setDuplicateWarning(null);
      setIsLinkingOpen(false);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handler = (e: any) => {
      if (Array.isArray(e.detail)) {
        setOrcrims(e.detail);
      }
    };
    window.addEventListener('orcrim_updated', handler);
    return () => window.removeEventListener('orcrim_updated', handler);
  }, []);

  const loadData = async () => {
    const list = await getAllOrcrims();
    setOrcrims(list);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Abre formulário para Nova ORCRIM
  const handleOpenCreateForm = () => {
    setFormData({
      id: `orcrim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nome: '',
      sigla: '',
      fotoSimbolo: '',
      origem: '',
      dataSurgimento: '',
      coresSimbolos: '',
      territorios: [],
      atividadesCriminosas: [],
      periculosidade: 'ALTA',
      status: 'ATIVA',
      liderPrincipal: '',
      observacoes: '',
      membros: [],
    });
    setTerritorioInput('');
    setAtividadeInput('');
    setDuplicateWarning(null);
    setView('form');
  };

  // Abre edição de ORCRIM existente
  const handleOpenEditForm = (orcrim: OrcrimRecord) => {
    setFormData({ ...orcrim });
    setTerritorioInput('');
    setAtividadeInput('');
    setDuplicateWarning(null);
    setView('form');
  };

  // Abre detalhes da ORCRIM
  const handleOpenDetail = (orcrim: OrcrimRecord, tab: 'visao_geral' | 'integrantes' | 'organograma' = 'visao_geral') => {
    setSelectedOrcrim(orcrim);
    setActiveTab(tab);
    setView('detail');
  };

  // Upload do símbolo / logotipo da ORCRIM
  const handleSimboloUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setFormData((prev) => ({ ...prev, fotoSimbolo: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Salva ORCRIM com checagem de duplicidade
  const handleSaveOrcrim = async (e: React.FormEvent, force: boolean = false) => {
    e.preventDefault();
    if (!formData.nome?.trim() || !formData.sigla?.trim()) {
      showToast('Preencha o nome e a sigla da organização.');
      return;
    }

    if (!force) {
      const duplicate = await checkOrcrimDuplicate(
        formData.nome.trim(),
        formData.sigla.trim(),
        formData.id
      );
      if (duplicate) {
        setDuplicateWarning(duplicate);
        return;
      }
    }

    const recordToSave: OrcrimRecord = {
      id: formData.id || `orcrim-${Date.now()}`,
      nome: formData.nome.trim().toUpperCase(),
      sigla: formData.sigla.trim().toUpperCase(),
      fotoSimbolo: formData.fotoSimbolo || undefined,
      origem: formData.origem?.trim(),
      dataSurgimento: formData.dataSurgimento?.trim(),
      coresSimbolos: formData.coresSimbolos?.trim(),
      territorios: formData.territorios || [],
      atividadesCriminosas: formData.atividadesCriminosas || [],
      periculosidade: (formData.periculosidade as OrcrimPericulosidade) || 'ALTA',
      status: (formData.status as OrcrimStatus) || 'ATIVA',
      liderPrincipal: formData.liderPrincipal?.trim().toUpperCase(),
      observacoes: formData.observacoes?.trim(),
      membros: formData.membros || [],
      dataCriacao: formData.dataCriacao || new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
    };

    await saveOrcrim(recordToSave);
    await loadData();
    setSelectedOrcrim(recordToSave);
    setDuplicateWarning(null);
    showToast(`ORCRIM ${recordToSave.sigla} salva com sucesso!`);
    setView('detail');
  };

  const handleAddTerritorio = () => {
    if (territorioInput.trim()) {
      const updated = [...(formData.territorios || []), territorioInput.trim().toUpperCase()];
      setFormData({ ...formData, territorios: updated });
      setTerritorioInput('');
    }
  };

  const handleAddAtividade = () => {
    if (atividadeInput.trim()) {
      const updated = [...(formData.atividadesCriminosas || []), atividadeInput.trim().toUpperCase()];
      setFormData({ ...formData, atividadesCriminosas: updated });
      setAtividadeInput('');
    }
  };

  // Confirmação de vinculação de abordado do banco
  const handleConfirmLink = async () => {
    if (!selectedOrcrim || !selectedSuspectToLink) return;

    const updated = await linkSuspectToOrcrim(
      selectedOrcrim.id,
      selectedSuspectToLink,
      selectedFuncao,
      customFuncaoText.trim() || undefined,
      linkObs
    );

    if (updated) {
      setSelectedOrcrim(updated);
      await loadData();
      setIsLinkingOpen(false);
      setSelectedSuspectToLink(null);
      setCustomFuncaoText('');
      setLinkObs('');
      showToast(`${selectedSuspectToLink.nome} vinculado à ${selectedOrcrim.sigla}!`);
    }
  };

  // Salva novo membro manual (que não foi abordado ainda)
  const handleSaveNovoMembroManual = async (novoMembro: OrcrimMembro) => {
    if (!selectedOrcrim) return;
    const currentMembros = selectedOrcrim.membros || [];
    const updatedOrcrim: OrcrimRecord = {
      ...selectedOrcrim,
      membros: [...currentMembros, novoMembro],
      dataAtualizacao: new Date().toISOString(),
    };
    await saveOrcrim(updatedOrcrim);
    setSelectedOrcrim(updatedOrcrim);
    await loadData();
    showToast(`Membro ${novoMembro.nome} adicionado com sucesso!`);
  };

  // Salva alteração de função hierárquica digitada
  const handleSaveFuncaoCustom = async (membroId: string) => {
    if (!selectedOrcrim) return;
    const updatedMembros = (selectedOrcrim.membros || []).map((m) => {
      if (m.id === membroId) {
        return {
          ...m,
          funcaoPersonalizada: editingFuncaoText.trim() || undefined,
        };
      }
      return m;
    });

    const updatedOrcrim: OrcrimRecord = {
      ...selectedOrcrim,
      membros: updatedMembros,
      dataAtualizacao: new Date().toISOString(),
    };
    await saveOrcrim(updatedOrcrim);
    setSelectedOrcrim(updatedOrcrim);
    await loadData();
    setEditingMembroId(null);
    showToast('Função na hierarquia atualizada!');
  };

  // Iniciar desvinculação de integrante com modal seguro
  const handleUnlink = (membroId: string) => {
    if (!selectedOrcrim) return;
    const membro = (selectedOrcrim.membros || []).find((m) => m.id === membroId);
    setMembroToUnlink({ id: membroId, nome: membro?.nome || 'Integrante' });
  };

  const handleConfirmUnlink = async () => {
    if (!selectedOrcrim || !membroToUnlink) return;
    try {
      const updated = await unlinkSuspectFromOrcrim(selectedOrcrim.id, membroToUnlink.id);
      if (updated) {
        setSelectedOrcrim(updated);
        await loadData();
        showToast('Integrante desvinculado com sucesso.');
      }
    } catch (err) {
      console.error('Erro ao desvincular integrante:', err);
      showToast('Erro ao desvincular integrante.');
    } finally {
      setMembroToUnlink(null);
    }
  };

  // Iniciar exclusão de ORCRIM com modal seguro in-app
  const handleDeleteOrcrim = (orcrim: OrcrimRecord) => {
    setOrcrimToDelete(orcrim);
  };

  const handleConfirmDeleteOrcrim = async () => {
    if (!orcrimToDelete || isDeletingOrcrim) return;
    setIsDeletingOrcrim(true);
    try {
      const targetId = orcrimToDelete.id;
      const targetSigla = orcrimToDelete.sigla || orcrimToDelete.nome;
      const updatedList = await deleteOrcrim(targetId);
      setOrcrims(updatedList);
      if (selectedOrcrim && (selectedOrcrim.id === targetId || selectedOrcrim.sigla === orcrimToDelete.sigla)) {
        setSelectedOrcrim(null);
        setView('list');
      }
      setOrcrimToDelete(null);
      showToast(`Facção ${targetSigla} excluída com sucesso.`);
    } catch (err) {
      console.error('Erro ao excluir ORCRIM:', err);
      showToast('Erro ao excluir a organização.');
    } finally {
      setIsDeletingOrcrim(false);
    }
  };

  // Drag and drop do Organograma para mover membros
  const handleDragStart = (membroId: string) => {
    setDraggedMembroId(membroId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnTier = async (targetFuncao: OrcrimMembroFuncao) => {
    if (!draggedMembroId || !selectedOrcrim) return;

    const updatedMembros = (selectedOrcrim.membros || []).map((m) => {
      if (m.id === draggedMembroId) {
        return { ...m, funcao: targetFuncao };
      }
      return m;
    });

    const updatedOrcrim: OrcrimRecord = {
      ...selectedOrcrim,
      membros: updatedMembros,
      dataAtualizacao: new Date().toISOString(),
    };

    await saveOrcrim(updatedOrcrim);
    setSelectedOrcrim(updatedOrcrim);
    await loadData();
    setDraggedMembroId(null);
    showToast('Hierarquia do integrante atualizada no organograma!');
  };

  // Exportar Organograma para PDF
  const handleExportOrganogramaPdf = async () => {
    if (!selectedOrcrim) return;
    setIsExportingOrganogramaPdf(true);
    try {
      await generateOrganogramaPdf(selectedOrcrim);
      showToast('PDF do Organograma exportado com sucesso!');
    } catch (e) {
      console.error('Erro ao exportar PDF do organograma:', e);
      showToast('Erro ao exportar PDF do organograma.');
    } finally {
      setIsExportingOrganogramaPdf(false);
    }
  };

  if (!isOpen) return null;

  const filteredOrcrims = orcrims.filter((o) => {
    const matchesSearch =
      o.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.sigla.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.territorios && o.territorios.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesPericulosidade =
      filterPericulosidade === 'TODAS' || o.periculosidade === filterPericulosidade;
    const matchesStatus = filterStatus === 'TODAS' || o.status === filterStatus;
    return matchesSearch && matchesPericulosidade && matchesStatus;
  });

  const availableSuspectsToLink = allSuspects.filter((s) => {
    if (!searchSuspectTerm.trim()) return true;
    const term = searchSuspectTerm.toLowerCase();
    return (
      s.nome.toLowerCase().includes(term) ||
      (s.alcunha && s.alcunha.toLowerCase().includes(term)) ||
      (s.cpf && s.cpf.includes(term)) ||
      (s.rg && s.rg.includes(term))
    );
  });

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto animate-fadeIn"
        onClick={onClose}
      >
      <div
        className="relative w-full max-w-5xl my-auto bg-[#0a0d14] border border-[#c69c59]/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Geral do Módulo ORCRIM */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-800 bg-[#0d111a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-red-900 flex items-center justify-center text-white shadow-lg shadow-rose-900/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider font-mono">
                  Módulo ORCRIM / Facções Criminosas
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#182030] border border-[#c69c59]/60 text-[#f5d799] font-mono text-[10px] font-bold">
                  {orcrims.length} Registradas
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Inteligência territorial, cadeia de comando e organograma tático
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-orcrim-modal"
            onClick={() => {
              if (view !== 'list') {
                setView('list');
              } else {
                onClose();
              }
            }}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title={view !== 'list' ? 'Voltar para lista de ORCRIMs' : 'Fechar'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notificação */}
        {toastMessage && (
          <div className="absolute top-16 right-6 z-50 px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-200 text-xs font-bold shadow-xl flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* ========================================================
              TELA 08: LISTAGEM DE ORCRIMS COM SÍMBOLO
             ======================================================== */}
          {view === 'list' && (
            <div className="space-y-4">
              {/* Barra de Filtros e Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, sigla (CV, PCC, TCP) ou território..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#121622] border border-neutral-800 focus:border-[#c69c59] text-white text-xs outline-none uppercase font-semibold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={filterPericulosidade}
                    onChange={(e) => setFilterPericulosidade(e.target.value)}
                    className="px-3 py-2.5 rounded-2xl bg-[#121622] border border-neutral-800 text-xs text-neutral-300 font-semibold outline-none"
                  >
                    <option value="TODAS">Periculosidade: Todas</option>
                    <option value="EXTREMA">Extrema</option>
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Média</option>
                  </select>

                  {/* Botão + Nova ORCRIM */}
                  <button
                    type="button"
                    onClick={handleOpenCreateForm}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-[#c69c59]/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4 text-neutral-950 stroke-[3]" />
                    <span>+ Nova ORCRIM</span>
                  </button>
                </div>
              </div>

              {/* Grid das ORCRIMs Cadastradas - Clicar no card abre a facção diretamente */}
              {filteredOrcrims.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#121622] border border-dashed border-neutral-800 space-y-3">
                  <ShieldAlert className="w-10 h-10 text-neutral-600 mx-auto" />
                  <h4 className="text-sm font-bold text-neutral-300">Nenhuma Organização Criminosa encontrada</h4>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    {searchTerm || filterPericulosidade !== 'TODAS'
                      ? 'Nenhum resultado corresponde aos filtros aplicados.'
                      : 'O banco de dados operacional não possui facções registradas no momento.'}
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleOpenCreateForm}
                      className="px-4 py-2 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] text-neutral-950 font-bold text-xs uppercase cursor-pointer"
                    >
                      + Cadastrar Nova ORCRIM
                    </button>
                    {orcrims.length === 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          const defaults = await resetOrcrimsToDefaults();
                          setOrcrims(defaults);
                          showToast('Facções padrão restauradas.');
                        }}
                        className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer"
                      >
                        Restaurar Facções Padrão
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrcrims.map((orcrim) => (
                  <div
                    key={orcrim.id}
                    onClick={() => handleOpenDetail(orcrim, 'visao_geral')}
                    className="group bg-[#121622] hover:bg-[#161c2c] border border-neutral-800 hover:border-[#c69c59]/70 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between space-y-3 shadow-md cursor-pointer"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {/* Símbolo / Brasão Opcional da ORCRIM */}
                          {orcrim.fotoSimbolo ? (
                            <div className="w-11 h-11 rounded-xl overflow-hidden bg-black border border-[#c69c59]/50 flex-shrink-0">
                              <img src={orcrim.fotoSimbolo} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-[#1b2234] border border-rose-500/40 text-rose-300 flex items-center justify-center font-mono font-black text-sm flex-shrink-0">
                              {orcrim.sigla}
                            </div>
                          )}

                          <div>
                            <span className="font-mono font-black text-xs text-[#e5c07b] tracking-wider block">
                              {orcrim.sigla}
                            </span>
                            <h3 className="font-extrabold text-white text-xs uppercase tracking-wide leading-tight">
                              {orcrim.nome}
                            </h3>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase border ${
                            String(orcrim.periculosidade).toUpperCase() === 'EXTREMA'
                              ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                              : 'bg-amber-950 text-amber-300 border-amber-500/50'
                          }`}
                        >
                          {orcrim.periculosidade}
                        </span>
                      </div>

                      {orcrim.liderPrincipal && (
                        <div className="text-[11px] text-neutral-300">
                          <span className="text-neutral-500 font-bold uppercase text-[10px]">Cúpula:</span>{' '}
                          <span className="text-rose-400 font-bold">{orcrim.liderPrincipal}</span>
                        </div>
                      )}

                      {orcrim.territorios && orcrim.territorios.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {orcrim.territorios.slice(0, 3).map((t, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-[#182030] text-neutral-300 text-[10px] font-medium"
                            >
                              {t}
                            </span>
                          ))}
                          {orcrim.territorios.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-neutral-400 text-[9px] font-mono">
                              +{orcrim.territorios.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#e5c07b] font-mono font-bold">
                        <Users className="w-3.5 h-3.5 text-[#c69c59]" />
                        <span>{orcrim.membros?.length || 0} Integrantes</span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(orcrim, 'organograma')}
                          className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#222c42] text-[#e5c07b] border border-[#c69c59]/40 transition-colors cursor-pointer"
                          title="Ver Organograma com Fotos"
                        >
                          <Network className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          id={`btn-delete-orcrim-${orcrim.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteOrcrim(orcrim);
                          }}
                          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-300 border border-neutral-800 hover:border-rose-500/50 transition-colors cursor-pointer"
                          title={`Excluir ${orcrim.sigla || orcrim.nome}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

          {/* ========================================================
              FORMULÁRIO DE CADASTRO / EDIÇÃO DE ORCRIM
             ======================================================== */}
          {view === 'form' && (
            <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {formData.nome ? `Editar: ${formData.nome}` : 'Cadastrar Nova ORCRIM'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Preenchimento de dados de inteligência criminal, símbolos e territorialidade
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
                >
                  ← Voltar
                </button>
              </div>

              <form onSubmit={(e) => handleSaveOrcrim(e)} className="space-y-4 text-xs">
                {/* Nome e Sigla */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Nome da Organização <span className="text-[#c69c59]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nome || ''}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="EX: COMANDO VERMELHO"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white outline-none uppercase font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Sigla <span className="text-[#c69c59]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.sigla || ''}
                      onChange={(e) => setFormData({ ...formData, sigla: e.target.value })}
                      placeholder="EX: CV"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-[#e5c07b] outline-none uppercase font-black tracking-widest text-center"
                      required
                    />
                  </div>
                </div>

                {/* Símbolo / Fotografia da Facção (Opcional - solicitado pelo usuário) */}
                <div className="p-3.5 rounded-2xl bg-[#111622] border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-300 uppercase block">
                        Fotografia do Símbolo / Brasão da ORCRIM
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        Opcional (tatuagens, pichações de muro ou emblemas conhecidos)
                      </span>
                    </div>

                    {formData.fotoSimbolo && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, fotoSimbolo: '' }))}
                        className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>

                  {formData.fotoSimbolo ? (
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-[#c69c59] bg-black mx-auto">
                      <img src={formData.fotoSimbolo} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        ref={simboloFileInputRef}
                        accept="image/*"
                        onChange={handleSimboloUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => simboloFileInputRef.current?.click()}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#182030] hover:bg-[#202c44] border border-neutral-700 text-neutral-200 font-bold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-[#c69c59]" />
                        <span>Carregar Imagem do Símbolo (Opcional)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Origem e Líder Principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Origem / Estado
                    </label>
                    <input
                      type="text"
                      value={formData.origem || ''}
                      onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                      placeholder="Ex: Rio de Janeiro / RJ"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Líder Principal Identificado
                    </label>
                    <input
                      type="text"
                      value={formData.liderPrincipal || ''}
                      onChange={(e) => setFormData({ ...formData, liderPrincipal: e.target.value })}
                      placeholder="Nome ou Vulgo da Cúpula"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none uppercase"
                    />
                  </div>
                </div>

                {/* Periculosidade e Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Grau de Periculosidade (Digitável de Acordo com Inteligência)
                    </label>
                    <input
                      type="text"
                      list="periculosidade-suggestions"
                      value={formData.periculosidade || ''}
                      onChange={(e) => setFormData({ ...formData, periculosidade: e.target.value })}
                      placeholder="Ex: EXTREMA, ALTA, MÉDIA, BAIXA ou nota de inteligência"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white outline-none uppercase font-bold"
                    />
                    <datalist id="periculosidade-suggestions">
                      <option value="EXTREMA" />
                      <option value="ALTA" />
                      <option value="MEDIA" />
                      <option value="BAIXA" />
                      <option value="ALVO PRIORITÁRIO" />
                      <option value="GUERRA DE FACÇÃO" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Status Operacional
                    </label>
                    <select
                      value={formData.status || 'ATIVA'}
                      onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none"
                    >
                      <option value="ATIVA">Ativa</option>
                      <option value="EM_CONFLITO">Em Guerra / Conflito</option>
                      <option value="MONITORADA">Monitorada</option>
                      <option value="DESARTICULADA">Desarticulada</option>
                    </select>
                  </div>
                </div>

                {/* Territórios */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                    Territórios e Bairros de Atuação
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={territorioInput}
                      onChange={(e) => setTerritorioInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTerritorio();
                        }
                      }}
                      placeholder="Ex: Aglomerado da Serra, Cabana..."
                      className="flex-1 px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleAddTerritorio}
                      className="px-3.5 py-2 rounded-xl bg-[#182030] hover:bg-[#222c42] border border-[#c69c59]/50 text-[#e5c07b] font-bold cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                  {formData.territorios && formData.territorios.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {formData.territorios.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-[#182030] border border-neutral-700 text-neutral-200 text-xs flex items-center gap-1.5"
                        >
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                territorios: formData.territorios?.filter((_, i) => i !== idx),
                              })
                            }
                            className="text-neutral-400 hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações de Inteligência */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                    Observações de Inteligência
                  </label>
                  <textarea
                    rows={3}
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Informações táticas, rotas de fuga, histórico de operações, etc."
                    className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none resize-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-3">
                  {formData.id && orcrims.some((o) => o.id === formData.id) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = orcrims.find((o) => o.id === formData.id) || (formData as OrcrimRecord);
                        handleDeleteOrcrim(target);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-700/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Excluir esta facção"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Facção</span>
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setView('list')}
                      className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer"
                    >
                      Salvar ORCRIM
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================
              DETALHAMENTO DA ORCRIM (COM ABAS E BOTÕES DE PDF)
             ======================================================== */}
          {view === 'detail' && selectedOrcrim && (
            <div className="space-y-4 animate-fadeIn">
              {/* Header da ORCRIM Selecionada com Botões de PDF */}
              <div className="p-4 rounded-2xl bg-[#121622] border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedOrcrim.fotoSimbolo ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-black border border-[#c69c59]/60 flex-shrink-0">
                      <img src={selectedOrcrim.fotoSimbolo} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-rose-950/80 border border-rose-500/60 flex items-center justify-center text-rose-300 font-mono font-black text-lg flex-shrink-0">
                      {selectedOrcrim.sigla}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white uppercase">
                        {selectedOrcrim.nome}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                        {selectedOrcrim.periculosidade}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      Origem: {selectedOrcrim.origem || 'Não informada'} • Status: {selectedOrcrim.status}
                    </p>
                  </div>
                </div>

                {/* Ações: Exportar PDF da Ficha, Editar, Voltar */}
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExportPdfModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#c69c59]/20 transition-all cursor-pointer"
                    title="Exportar Ficha da ORCRIM para PDF"
                  >
                    <FileDown className="w-3.5 h-3.5 text-neutral-950" />
                    <span>Exportar PDF da Ficha</span>
                  </button>

                  <button
                    type="button"
                    id="btn-delete-orcrim-detail"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDeleteOrcrim(selectedOrcrim);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-300 border border-neutral-800 hover:border-rose-500/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    title={`Excluir ${selectedOrcrim.sigla || selectedOrcrim.nome}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Facção</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditForm(selectedOrcrim)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
                  >
                    ← Lista
                  </button>
                </div>
              </div>

              {/* Abas de Navegação Interna: Centralizadas, um pouco maiores e com destaque chamativo */}
              <div className="flex items-center justify-center gap-2 border-b border-neutral-800 pb-3 flex-wrap">
                <button
                  type="button"
                  id="tab-btn-visao-geral"
                  onClick={() => setActiveTab('visao_geral')}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase transition-all cursor-pointer flex items-center gap-2 tracking-wide shadow-sm active:scale-95 ${
                    activeTab === 'visao_geral'
                      ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 border border-[#d8ab62] shadow-md shadow-[#c69c59]/25 scale-102 ring-2 ring-[#c69c59]/40'
                      : 'bg-[#151923] text-neutral-300 hover:text-white hover:bg-[#1f2637] border border-neutral-700/80 hover:border-[#c69c59]/50'
                  }`}
                >
                  <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span>Visão Geral & Ficha</span>
                </button>

                <button
                  type="button"
                  id="tab-btn-integrantes"
                  onClick={() => setActiveTab('integrantes')}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase transition-all cursor-pointer flex items-center gap-2 tracking-wide shadow-sm active:scale-95 ${
                    activeTab === 'integrantes'
                      ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 border border-[#d8ab62] shadow-md shadow-[#c69c59]/25 scale-102 ring-2 ring-[#c69c59]/40'
                      : 'bg-[#151923] text-neutral-300 hover:text-white hover:bg-[#1f2637] border border-neutral-700/80 hover:border-[#c69c59]/50'
                  }`}
                >
                  <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span>Integrantes ({selectedOrcrim.membros?.length || 0})</span>
                </button>

                <button
                  type="button"
                  id="tab-btn-enderecos"
                  onClick={() => setActiveTab('enderecos')}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase transition-all cursor-pointer flex items-center gap-2 tracking-wide shadow-sm active:scale-95 ${
                    activeTab === 'enderecos'
                      ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 border border-[#d8ab62] shadow-md shadow-[#c69c59]/25 scale-102 ring-2 ring-[#c69c59]/40'
                      : 'bg-[#151923] text-neutral-300 hover:text-white hover:bg-[#1f2637] border border-neutral-700/80 hover:border-[#c69c59]/50'
                  }`}
                >
                  <MapPin className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span>Endereços ({selectedOrcrim.enderecos?.length || 0})</span>
                </button>

                <button
                  type="button"
                  id="tab-btn-organograma"
                  onClick={() => setActiveTab('organograma')}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase transition-all cursor-pointer flex items-center gap-2 tracking-wide shadow-sm active:scale-95 ${
                    activeTab === 'organograma'
                      ? 'bg-gradient-to-r from-[#c69c59] to-[#d8ab62] text-neutral-950 border border-[#d8ab62] shadow-md shadow-[#c69c59]/25 scale-102 ring-2 ring-[#c69c59]/40'
                      : 'bg-[#151923] text-neutral-300 hover:text-white hover:bg-[#1f2637] border border-neutral-700/80 hover:border-[#c69c59]/50'
                  }`}
                >
                  <Network className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span>Organograma Tático</span>
                </button>
              </div>

              {/* ABA 1: VISÃO GERAL */}
              {activeTab === 'visao_geral' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[#121622] border border-neutral-800 space-y-2">
                      <span className="text-neutral-500 font-bold uppercase text-[10px]">Liderança Principal:</span>
                      <p className="text-white font-bold text-sm">
                        {selectedOrcrim.liderPrincipal || 'Em processo de qualificação'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#121622] border border-neutral-800 space-y-2">
                      <span className="text-neutral-500 font-bold uppercase text-[10px]">Origem e Fundação:</span>
                      <p className="text-white font-semibold">
                        {selectedOrcrim.origem || 'Não informada'} {selectedOrcrim.dataSurgimento ? `(${selectedOrcrim.dataSurgimento})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Territórios */}
                  <div className="p-4 rounded-2xl bg-[#121622] border border-neutral-800 space-y-3">
                    <h4 className="text-xs font-black uppercase text-[#e5c07b] tracking-wider border-b border-neutral-800 pb-2">
                      Territórios Sob Controle
                    </h4>
                    {selectedOrcrim.territorios && selectedOrcrim.territorios.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedOrcrim.territorios.map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#182030] border border-[#c69c59]/40 text-[#f5d799] font-semibold text-xs"
                          >
                            <MapPin className="w-3 h-3 text-[#c69c59]" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-neutral-500">Nenhum território cadastrado.</span>
                    )}

                    <div className="pt-2">
                      <span className="text-neutral-500 font-bold uppercase text-[10px] block mb-1">
                        Observações de Inteligência:
                      </span>
                      <p className="text-neutral-300 leading-relaxed bg-[#0e1219] p-2.5 rounded-xl border border-neutral-800">
                        {selectedOrcrim.observacoes || 'Sem observações complementares registradas.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: INTEGRANTES (Com Adicionar Membro + Vincular Abordado) */}
              {activeTab === 'integrantes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase">
                        Integrantes e Alvos Mapeados
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        Abordados no sistema e membros conhecidos vinculados
                      </p>
                    </div>

                    {/* Botões lado a lado: + Adicionar Membro e + Vincular Abordado */}
                    <div className="flex items-center gap-2">
                      {/* Botão solicitado: Adicionar Membro (sem foto obrigatória, sabe quem é mas ainda não abordou) */}
                      <button
                        type="button"
                        id="btn-add-membro-orcrim"
                        onClick={() => setIsAddNovoMembroOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-[#182030] hover:bg-[#202c44] border border-[#c69c59]/60 text-[#f5d799] font-bold text-xs uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        title="Adicionar Membro sem foto obrigatória"
                      >
                        <UserPlus className="w-4 h-4 text-[#c69c59]" />
                        <span>+ Adicionar Membro</span>
                      </button>

                      {/* Botão: Vincular Abordado */}
                      <button
                        type="button"
                        id="btn-link-suspect-to-orcrim"
                        onClick={() => setIsLinkingOpen(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-md shadow-[#c69c59]/20 transition-all cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-neutral-950" />
                        <span>Vincular Abordado</span>
                      </button>
                    </div>
                  </div>

                  {selectedOrcrim.membros && selectedOrcrim.membros.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedOrcrim.membros.map((membro) => (
                        <div
                          key={membro.id}
                          className="p-3 rounded-2xl bg-[#121622] border border-neutral-800 flex items-start gap-3 relative group"
                        >
                          <div className="w-14 h-16 rounded-xl overflow-hidden bg-black border border-neutral-700 flex-shrink-0">
                            {membro.foto ? (
                              <img src={membro.foto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                                <User className="w-6 h-6 text-neutral-500" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h5 className="font-extrabold text-white text-xs uppercase truncate">
                              {membro.nome}
                            </h5>
                            {membro.alcunha && (
                              <div className="text-[11px] text-[#e5c07b] font-bold">
                                Vulgo: {membro.alcunha}
                              </div>
                            )}

                            {/* Função Hierárquica com Edição Rápida Digitável */}
                            <div className="mt-1">
                              {editingMembroId === membro.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={editingFuncaoText}
                                    onChange={(e) => setEditingFuncaoText(e.target.value)}
                                    placeholder="Função real..."
                                    className="px-1.5 py-0.5 rounded bg-black border border-[#c69c59] text-white text-[10px] w-full outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveFuncaoCustom(membro.id);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveFuncaoCustom(membro.id)}
                                    className="text-emerald-400 text-xs font-bold px-1"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingMembroId(null)}
                                    className="text-neutral-400 text-xs px-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMembroId(membro.id);
                                    setEditingFuncaoText(
                                      membro.funcaoPersonalizada || getFuncaoLabel(membro.funcao)
                                    );
                                  }}
                                  className="px-2 py-0.5 rounded bg-[#1c2434] hover:bg-[#253046] border border-[#c69c59]/60 text-[#f5d799] font-mono text-[9px] uppercase font-bold inline-flex items-center gap-1 transition-all cursor-pointer text-left"
                                  title="Clique para editar a função na hierarquia"
                                >
                                  <span>{membro.funcaoPersonalizada || getFuncaoLabel(membro.funcao)}</span>
                                  <Edit3 className="w-2.5 h-2.5 text-neutral-400" />
                                </button>
                              )}
                            </div>

                            <div className="text-[10px] text-neutral-500 mt-1">
                              {membro.rg ? `RG: ${membro.rg} • ` : ''}
                              {membro.cpf ? `CPF: ${membro.cpf}` : ''}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleUnlink(membro.id)}
                            className="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Desvincular da ORCRIM"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-neutral-800 bg-[#0e1219]">
                      <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                      <p className="text-xs text-neutral-400 font-semibold">
                        Nenhum integrante vinculado a esta organização ainda.
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Utilize os botões "+ Adicionar Membro" ou "Vincular Abordado" acima para cadastrar integrantes.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA: ENDEREÇOS DA ORGANIZAÇÃO (Pontos de droga, bocas, sedes, esconderijos e GPS) */}
              {activeTab === 'enderecos' && (
                <OrcrimEnderecosTab
                  orcrim={selectedOrcrim}
                  onUpdateOrcrim={(updated) => {
                    setSelectedOrcrim(updated);
                    setOrcrims((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
                  }}
                  onToast={(msg) => {
                    setToastMessage(msg);
                    setTimeout(() => setToastMessage(null), 3000);
                  }}
                />
              )}

              {/* ABA 3: ORGANOGRAMA TÁTICO COM DRAG-AND-DROP E EXPORTAR PARA PDF */}
              {activeTab === 'organograma' && (
                <div className="p-4 sm:p-6 rounded-3xl bg-[#0c1017] border border-neutral-800 space-y-6">
                  {/* Topo do Organograma com Botão de Exportar para PDF */}
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-neutral-800 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">
                        Organograma Hierárquico: {selectedOrcrim.sigla}
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        Cliquem, segurem e arrastem os integrantes para mudar de escalão de acordo com a liderança
                      </p>
                    </div>

                    <button
                      type="button"
                      id="btn-export-organograma-pdf"
                      disabled={isExportingOrganogramaPdf}
                      onClick={handleExportOrganogramaPdf}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-extrabold text-xs flex items-center gap-2 shadow-md shadow-[#c69c59]/20 transition-all cursor-pointer disabled:opacity-50"
                      title="Exportar Organograma com fotos, nomes e documentos para PDF"
                    >
                      <FileDown className="w-4 h-4 text-neutral-950 stroke-[2.5]" />
                      <span>{isExportingOrganogramaPdf ? 'Exportando PDF...' : 'Exportar Organograma PDF'}</span>
                    </button>
                  </div>

                  {/* NÍVEL 1: CÚPULA / LIDERANÇA GERAL (Área Drop) */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropOnTier('LIDER_GERAL')}
                    className="p-3 rounded-2xl bg-[#141925]/70 border-2 border-dashed border-amber-500/40 space-y-2 transition-all hover:border-amber-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-[1px] w-12 bg-amber-500/40" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/50 flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span>Nível 1 • Cúpula & Liderança Geral (Soltar aqui)</span>
                      </span>
                      <div className="h-[1px] w-12 bg-amber-500/40" />
                    </div>

                    <div className="flex justify-center flex-wrap gap-4 pt-2">
                      {selectedOrcrim.membros?.filter(
                        (m) => m.funcao === 'LIDER_GERAL' || m.funcao === 'SUB_LIDER'
                      ).map((m) => (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={() => handleDragStart(m.id)}
                          className="w-48 p-3 rounded-2xl bg-[#141925] border-2 border-amber-500/70 shadow-lg shadow-amber-500/10 text-center space-y-2 cursor-grab active:cursor-grabbing hover:scale-102 transition-transform select-none"
                        >
                          <div className="flex items-center justify-between text-[10px] text-amber-400 px-1">
                            <div className="flex items-center gap-1">
                              <GripVertical className="w-3.5 h-3.5 opacity-60" />
                              <span className="font-mono text-[9px]">Arrastar</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlink(m.id);
                              }}
                              className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800/80 transition-colors cursor-pointer"
                              title="Desvincular do Organograma"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="w-16 h-20 mx-auto rounded-xl overflow-hidden bg-black border border-amber-500/50">
                            {m.foto ? (
                              <img src={m.foto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-500 bg-neutral-900">
                                <User className="w-6 h-6 text-neutral-400" />
                              </div>
                            )}
                          </div>

                          <div>
                            <h5 className="font-black text-white text-xs uppercase truncate">
                              {m.nome}
                            </h5>
                            {m.alcunha && (
                              <div className="text-[11px] text-[#e5c07b] font-bold">
                                "{m.alcunha}"
                              </div>
                            )}

                            {/* Função Digitada */}
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 font-bold text-[9px] uppercase">
                              {m.funcaoPersonalizada || getFuncaoLabel(m.funcao)}
                            </span>

                            {/* RG / CPF exibidos no card */}
                            <div className="text-[9px] text-neutral-400 font-mono mt-1">
                              {m.rg ? `RG: ${m.rg}` : ''} {m.cpf ? `CPF: ${m.cpf}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}

                      {selectedOrcrim.membros?.filter(
                        (m) => m.funcao === 'LIDER_GERAL' || m.funcao === 'SUB_LIDER'
                      ).length === 0 && (
                        <div className="px-4 py-3 text-neutral-500 text-xs text-center">
                          Nenhum líder neste nível. Arraste um integrante para cá para definir como liderança.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Linha de Conexão Vertical */}
                  <div className="w-[2px] h-5 bg-neutral-700 mx-auto" />

                  {/* NÍVEL 2: GERENTES, DISCIPLINAS & ARMEIROS (Área Drop) */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropOnTier('GERENTE_FRENTE')}
                    className="p-3 rounded-2xl bg-[#101624]/70 border-2 border-dashed border-blue-500/40 space-y-2 transition-all hover:border-blue-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-[1px] w-12 bg-blue-500/40" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-950/80 px-3 py-1 rounded-full border border-blue-500/50">
                        Nível 2 • Gerências, Disciplinas & Armeiros (Soltar aqui)
                      </span>
                      <div className="h-[1px] w-12 bg-blue-500/40" />
                    </div>

                    <div className="flex justify-center flex-wrap gap-3 pt-2">
                      {selectedOrcrim.membros?.filter(
                        (m) =>
                          m.funcao === 'DISCIPLINA' ||
                          m.funcao === 'GERENTE_FRENTE' ||
                          m.funcao === 'ARMEIRO_LOGISTICA'
                      ).map((m) => (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={() => handleDragStart(m.id)}
                          className="w-40 p-2.5 rounded-2xl bg-[#121622] border border-blue-500/50 text-center space-y-1.5 shadow-md cursor-grab active:cursor-grabbing hover:scale-102 transition-transform select-none"
                        >
                          <div className="flex items-center justify-between text-[10px] text-blue-400 px-1">
                            <div className="flex items-center gap-1">
                              <GripVertical className="w-3.5 h-3.5 opacity-60" />
                              <span className="font-mono text-[9px]">Arrastar</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlink(m.id);
                              }}
                              className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800/80 transition-colors cursor-pointer"
                              title="Desvincular da ORCRIM"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="w-14 h-16 mx-auto rounded-xl overflow-hidden bg-black border border-blue-500/40">
                            {m.foto ? (
                              <img src={m.foto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-500 bg-neutral-900">
                                <User className="w-5 h-5 text-neutral-400" />
                              </div>
                            )}
                          </div>

                          <div>
                            <h5 className="font-bold text-white text-[11px] uppercase truncate">
                              {m.nome}
                            </h5>
                            {m.alcunha && (
                              <div className="text-[10px] text-neutral-300 font-semibold truncate">
                                "{m.alcunha}"
                              </div>
                            )}
                            <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-blue-950/80 border border-blue-500/50 text-blue-300 text-[8px] font-bold uppercase">
                              {m.funcaoPersonalizada || getFuncaoLabel(m.funcao)}
                            </span>

                            <div className="text-[8px] text-neutral-400 font-mono mt-1">
                              {m.rg ? `RG: ${m.rg}` : ''} {m.cpf ? `CPF: ${m.cpf}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}

                      {selectedOrcrim.membros?.filter(
                        (m) =>
                          m.funcao === 'DISCIPLINA' ||
                          m.funcao === 'GERENTE_FRENTE' ||
                          m.funcao === 'ARMEIRO_LOGISTICA'
                      ).length === 0 && (
                        <div className="px-4 py-3 text-neutral-500 text-xs text-center">
                          Nenhum gerente neste nível. Arraste integrantes para cá.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Linha de Conexão Vertical */}
                  <div className="w-[2px] h-5 bg-neutral-700 mx-auto" />

                  {/* NÍVEL 3: OPERACIONAIS, SOLDADOS & APOIO (Área Drop) */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropOnTier('OPERACIONAL_SOLDADO')}
                    className="p-3 rounded-2xl bg-[#0e1219]/70 border-2 border-dashed border-neutral-700/60 space-y-2 transition-all hover:border-neutral-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-[1px] w-12 bg-neutral-700" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-700">
                        Nível 3 • Operacional, Soldados & Apoio (Soltar aqui)
                      </span>
                      <div className="h-[1px] w-12 bg-neutral-700" />
                    </div>

                    <div className="flex justify-center flex-wrap gap-2.5 pt-2">
                      {selectedOrcrim.membros?.filter(
                        (m) =>
                          m.funcao === 'OPERACIONAL_SOLDADO' ||
                          m.funcao === 'CONTATO_APOIO' ||
                          m.funcao === 'OUTRO'
                      ).map((m) => (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={() => handleDragStart(m.id)}
                          className="w-36 p-2 rounded-xl bg-[#10141d] border border-neutral-700/80 text-center space-y-1 shadow-sm cursor-grab active:cursor-grabbing hover:scale-102 transition-transform select-none"
                        >
                          <div className="flex items-center justify-between text-[10px] text-neutral-400 px-1">
                            <div className="flex items-center gap-1">
                              <GripVertical className="w-3 h-3 opacity-60" />
                              <span className="font-mono text-[8px]">Arrastar</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlink(m.id);
                              }}
                              className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800/80 transition-colors cursor-pointer"
                              title="Desvincular da ORCRIM"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="w-12 h-14 mx-auto rounded-lg overflow-hidden bg-black border border-neutral-700">
                            {m.foto ? (
                              <img src={m.foto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                                <User className="w-4 h-4 text-neutral-400" />
                              </div>
                            )}
                          </div>

                          <div>
                            <h5 className="font-bold text-white text-[10px] uppercase truncate">
                              {m.nome}
                            </h5>
                            {m.alcunha && (
                              <div className="text-[9px] text-[#e5c07b] truncate">
                                "{m.alcunha}"
                              </div>
                            )}
                            <span className="inline-block mt-0.5 px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 text-[8px] font-mono">
                              {m.funcaoPersonalizada || getFuncaoLabel(m.funcao)}
                            </span>

                            <div className="text-[8px] text-neutral-500 font-mono mt-0.5">
                              {m.rg ? `RG: ${m.rg}` : ''} {m.cpf ? `CPF: ${m.cpf}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}

                      {selectedOrcrim.membros?.filter(
                        (m) =>
                          m.funcao === 'OPERACIONAL_SOLDADO' ||
                          m.funcao === 'CONTATO_APOIO' ||
                          m.funcao === 'OUTRO'
                      ).length === 0 && (
                        <div className="px-4 py-3 text-neutral-500 text-xs text-center">
                          Nenhum operacional neste nível.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal de Alerta de Duplicidade */}
        {duplicateWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-md bg-[#121622] border-2 border-amber-500 rounded-3xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Alerta: Possível Duplicidade de ORCRIM
                </h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Já existe uma organização cadastrada com nome ou sigla semelhante:
                </p>
                <div className="p-3 rounded-xl bg-[#182030] border border-[#c69c59]/50 text-left text-xs">
                  <div className="font-black text-[#e5c07b] font-mono text-sm">
                    {duplicateWarning.sigla} - {duplicateWarning.nome}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
                >
                  Corrigir Nome
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenDetail(duplicateWarning);
                    setDuplicateWarning(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Abrir Existente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Vincular Abordado Existente */}
        {isLinkingOpen && selectedOrcrim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-[#0e121a] border border-[#c69c59]/50 rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div>
                  <h4 className="font-black text-white text-sm uppercase">
                    Vincular Abordado à {selectedOrcrim.sigla}
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Selecione o indivíduo já cadastrado e defina sua função na organização
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLinkingOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchSuspectTerm}
                  onChange={(e) => setSearchSuspectTerm(e.target.value)}
                  placeholder="Buscar por nome, vulgo ou documento..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase"
                />
              </div>

              <div className="flex-1 overflow-y-auto max-h-48 border border-neutral-800 rounded-2xl p-2 space-y-1.5 bg-[#121620]">
                {availableSuspectsToLink.slice(0, 20).map((suspect) => {
                  const isSelected = selectedSuspectToLink?.id === suspect.id;
                  return (
                    <div
                      key={suspect.id}
                      onClick={() => setSelectedSuspectToLink(suspect)}
                      className={`p-2 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#1e273a] border border-[#c69c59] text-white'
                          : 'hover:bg-[#182030] text-neutral-300'
                      }`}
                    >
                      <div className="w-10 h-12 rounded-lg overflow-hidden bg-black border border-neutral-700 flex-shrink-0">
                        {suspect.fotos && suspect.fotos[0] ? (
                          <img src={suspect.fotos[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                            <User className="w-4 h-4 text-neutral-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-xs uppercase truncate text-white">
                          {suspect.nome}
                        </div>
                        {suspect.alcunha && (
                          <div className="text-[10px] text-[#e5c07b] font-bold">
                            Vulgo: {suspect.alcunha}
                          </div>
                        )}
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#c69c59] flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* Definição de Função Hierárquica Digitável */}
              <div className="space-y-3 pt-2 border-t border-neutral-800 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                      Nível Base
                    </label>
                    <select
                      value={selectedFuncao}
                      onChange={(e: any) => setSelectedFuncao(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none"
                    >
                      <option value="LIDER_GERAL">Nível 1: Líder Geral / Cúpula</option>
                      <option value="SUB_LIDER">Nível 1: Sub-Líder</option>
                      <option value="DISCIPLINA">Nível 2: Disciplina</option>
                      <option value="GERENTE_FRENTE">Nível 2: Gerente de Ponto</option>
                      <option value="ARMEIRO_LOGISTICA">Nível 2: Armeiro</option>
                      <option value="OPERACIONAL_SOLDADO">Nível 3: Operacional / Soldado</option>
                      <option value="CONTATO_APOIO">Nível 3: Contato / Apoio</option>
                      <option value="OUTRO">Outro Escalão</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                      Função Digitada Real
                    </label>
                    <input
                      type="text"
                      value={customFuncaoText}
                      onChange={(e) => setCustomFuncaoText(e.target.value)}
                      placeholder="Ex: Chefe da Rua, Soldado da Pista..."
                      className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-[#e5c07b] font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                    Observações sobre o Vínculo
                  </label>
                  <input
                    type="text"
                    value={linkObs}
                    onChange={(e) => setLinkObs(e.target.value)}
                    placeholder="Informações operacionais..."
                    className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkingOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedSuspectToLink}
                  onClick={handleConfirmLink}
                  className="px-5 py-2 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  Confirmar Vínculo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Adicionar Novo Membro Conhecido (Sem foto obrigatória) */}
        {isAddNovoMembroOpen && selectedOrcrim && (
          <AddNovoMembroModal
            isOpen={isAddNovoMembroOpen}
            onClose={() => setIsAddNovoMembroOpen(false)}
            onSave={handleSaveNovoMembroManual}
          />
        )}

        {/* Modal Exportar PDF da Ficha de ORCRIM com Chavinhas de Seleção */}
        {isExportPdfModalOpen && selectedOrcrim && (
          <ExportOrcrimPdfModal
            isOpen={isExportPdfModalOpen}
            onClose={() => setIsExportPdfModalOpen(false)}
            orcrim={selectedOrcrim}
          />
        )}
      </div>
    </div>

    {/* ========================================================
        MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE ORCRIM (TOP-LEVEL z-[9999])
       ======================================================== */}
    {orcrimToDelete && (
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
        onClick={() => setOrcrimToDelete(null)}
      >
        <div
          className="relative w-full max-w-md bg-[#121622] border-2 border-rose-500/80 rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-rose-950/80 border-b border-rose-900/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-900 text-rose-200 border border-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-100 uppercase tracking-wider">
                  Excluir Organização Criminosa
                </h3>
                <p className="text-[10px] text-rose-300 font-mono">
                  Ação definitiva do banco de inteligência
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOrcrimToDelete(null)}
              disabled={isDeletingOrcrim}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Corpo */}
          <div className="p-5 space-y-4 text-xs">
            <p className="text-neutral-300 leading-relaxed">
              Você está prestes a excluir permanentemente esta facção do sistema:
            </p>

            <div className="p-4 rounded-xl bg-[#161c28] border border-rose-900/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-xs px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-700/60">
                  {orcrimToDelete.sigla}
                </span>
                <span className="font-extrabold text-white text-sm uppercase">
                  {orcrimToDelete.nome}
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 flex items-center gap-3 pt-1">
                <span>
                  Integrantes vinculados: <strong className="text-white">{orcrimToDelete.membros?.length || 0}</strong>
                </span>
                <span>•</span>
                <span>
                  Endereços: <strong className="text-white">{orcrimToDelete.enderecos?.length || 0}</strong>
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/50 text-[11px] text-rose-300 leading-relaxed">
              ⚠️ Esta exclusão apagará a ficha da organização, símbolos e o organograma. O histórico individual de abordagens dos suspeitos continuará salvo.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setOrcrimToDelete(null)}
                disabled={isDeletingOrcrim}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-orcrim"
                onClick={handleConfirmDeleteOrcrim}
                disabled={isDeletingOrcrim}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-900/50 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingOrcrim ? 'Excluindo...' : 'Sim, Excluir ORCRIM'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Confirmação de Desvinculação de Integrante */}
    {membroToUnlink && (
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
        onClick={() => setMembroToUnlink(null)}
      >
        <div
          className="relative w-full max-w-md bg-[#121622] border-2 border-amber-500/80 rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 bg-amber-950/70 border-b border-amber-900/50">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-xs font-black text-amber-200 uppercase tracking-wider">
                Desvincular Integrante
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setMembroToUnlink(null)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <p className="text-neutral-300 leading-relaxed">
              Deseja realmente desvincular <strong className="text-white uppercase">{membroToUnlink.nome}</strong> da facção{' '}
              <strong className="text-[#e5c07b]">{selectedOrcrim?.sigla || selectedOrcrim?.nome}</strong>?
            </p>
            <p className="text-[11px] text-neutral-400">
              O registro do indivíduo no banco de dados de abordagens continuará salvo normalmente.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMembroToUnlink(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlink}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-black text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Confirmar Desvinculação
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};
