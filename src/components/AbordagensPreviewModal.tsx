import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Clock,
  Calendar,
  Search,
  Plus,
  ExternalLink,
  ChevronRight,
  User,
  Car,
  FileText,
  Users,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { SuspectRecord, AbordagemRecord } from '../types';
import {
  getAllAbordagens,
  deleteAbordagem,
  saveAllAbordagens,
  isAbordagensInitialized,
} from '../utils/abordagensStorage';
import { saveSuspect } from '../utils/storage';
import { saveSuspectToRealtimeCloud } from '../utils/firebaseSync';
import { saveSuspectToCloudflare, getActiveBackendProvider } from '../utils/cloudflareApi';
import { NovaAbordagemModal } from './NovaAbordagemModal';

interface AbordagensPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  allSuspects: SuspectRecord[];
  onOpenSuspectDetail?: (suspect: SuspectRecord) => void;
  onRequestNovoCadastro?: (nomeInicial: string) => void;
  onUpdateSuspect?: (updatedSuspect: SuspectRecord) => void;
}

export const AbordagensPreviewModal: React.FC<AbordagensPreviewModalProps> = ({
  isOpen,
  onClose,
  allSuspects,
  onOpenSuspectDetail,
  onRequestNovoCadastro,
  onUpdateSuspect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewAbordagemModalOpen, setIsNewAbordagemModalOpen] = useState(false);
  const [selectedSuspectToAbordar, setSelectedSuspectToAbordar] = useState<SuspectRecord | null>(null);
  const [storedAbordagens, setStoredAbordagens] = useState<AbordagemRecord[]>([]);
  const [abordagemToDelete, setAbordagemToDelete] = useState<AbordagemRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAbordagens();
    }
  }, [isOpen]);

  const loadAbordagens = () => {
    let list = getAllAbordagens();
    // Apenas se NUNCA foi inicializado antes e houver histórico de abordagem nos cadastros
    if (!isAbordagensInitialized() && list.length === 0) {
      const initialFromSuspects: AbordagemRecord[] = allSuspects
        .filter((s) => s.localAbordagem || s.horaAbordagem || s.coordenadas)
        .slice(0, 15)
        .map((s, idx) => ({
          id: `ab-auto-${s.id}-${idx}`,
          suspectId: s.id,
          suspectNome: s.nome,
          suspectAlcunha: s.alcunha || undefined,
          suspectRg: s.rg || undefined,
          suspectCpf: s.cpf || undefined,
          suspectFoto: s.fotos && s.fotos[0] ? s.fotos[0] : undefined,
          data: s.dataCriacao ? new Date(s.dataCriacao).toLocaleDateString('pt-BR') : '10/10/2026',
          hora: s.horaAbordagem || '15:30',
          endereco: s.localAbordagem || s.endereco || 'Endereço registrado no banco',
          coordenadas: s.coordenadas || undefined,
          viatura: s.bpm ? `Equipe ${s.bpm}` : 'VP Operacional',
          natureza: 'Abordagem Policial e Identificação',
          observacoes: s.observacoes || undefined,
          criadoEm: s.dataCriacao || new Date().toISOString(),
        }));
      if (initialFromSuspects.length > 0) {
        saveAllAbordagens(initialFromSuspects);
        list = initialFromSuspects;
      } else {
        saveAllAbordagens([]);
      }
    }
    setStoredAbordagens(list);
  };

  const handleConfirmDelete = async () => {
    if (!abordagemToDelete) return;
    const target = abordagemToDelete;
    
    // Remove do storage definitivo
    deleteAbordagem(target.id);
    const updated = storedAbordagens.filter((a) => a.id !== target.id);
    saveAllAbordagens(updated);
    setStoredAbordagens(updated);

    // Se a abordagem tiver vínculo com algum abordado cadastrado, limpa os campos de abordagem
    if (target.suspectId) {
      const matched = allSuspects.find((s) => s.id === target.suspectId);
      if (matched) {
        const updatedSuspect: SuspectRecord = {
          ...matched,
          localAbordagem: '',
          horaAbordagem: '',
          localAbordagemCoords: undefined,
        };
        await saveSuspect(updatedSuspect);
        saveSuspectToRealtimeCloud(updatedSuspect).catch(() => {});
        if (getActiveBackendProvider() === 'cloudflare') {
          saveSuspectToCloudflare(updatedSuspect).catch(() => {});
        }
        if (onUpdateSuspect) {
          onUpdateSuspect(updatedSuspect);
        }
      }
    }

    setToastMessage(`Abordagem de "${target.suspectNome}" excluída com sucesso!`);
    setTimeout(() => setToastMessage(null), 3000);
    setAbordagemToDelete(null);
    window.dispatchEvent(new CustomEvent('abordagens_updated'));
  };

  const displayAbordagens: AbordagemRecord[] = storedAbordagens;

  if (!isOpen) return null;

  const filtered = displayAbordagens.filter((ab) => {
    const matchSearch =
      ab.suspectNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ab.suspectAlcunha && ab.suspectAlcunha.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ab.endereco.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ab.suspectRg && ab.suspectRg.includes(searchTerm));
    return matchSearch;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[#11141c] border border-[#c69c59]/40 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header da Tela de Abordagens */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#0d111a] border-b border-[#c69c59]/30">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#c69c59]/20 border border-[#c69c59]/50 text-[#c69c59]">
              <Car className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base md:text-lg font-black text-white uppercase tracking-wider font-mono">
                  Módulo de Novas Abordagens
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#c69c59] text-neutral-950 uppercase">
                  {displayAbordagens.length} Registros
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-400">
                Histórico cronológico de abordagens e intervenções realizadas pelo Banco de Dados
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Filtros e Busca de Abordagens */}
        <div className="p-4 sm:p-5 border-b border-neutral-800/80 bg-[#131722] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, vulgo, RG ou endereço..."
              className="w-full pl-10 pr-4 py-2 bg-[#0c0f17] border border-neutral-700/80 focus:border-[#c69c59] rounded-xl text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-all uppercase"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (allSuspects.length > 0) {
                setSelectedSuspectToAbordar(allSuspects[0]);
                setIsNewAbordagemModalOpen(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-neutral-950 stroke-[3]" />
            <span>+ Nova Abordagem</span>
          </button>
        </div>

        {/* Lista de Abordagens */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <Car className="w-10 h-10 mx-auto mb-2 text-neutral-600" />
              <p className="text-sm font-semibold">Nenhuma abordagem encontrada com esses critérios.</p>
            </div>
          ) : (
            filtered.map((ab) => {
              const matchedSuspect = allSuspects.find((s) => s.id === ab.suspectId);
              const googleMapsUrl = ab.coordenadas
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ab.coordenadas)}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ab.endereco)}`;

              return (
                <div
                  key={ab.id}
                  className="p-4 rounded-xl bg-[#161a25] border border-neutral-800 hover:border-[#c69c59]/50 transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-sm"
                >
                  {/* Foto e Identificação do Cadastrado */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-14 sm:w-14 sm:h-16 rounded-lg bg-neutral-900 border border-neutral-700/70 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {ab.suspectFoto ? (
                        <img
                          src={ab.suspectFoto}
                          alt={ab.suspectNome}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-7 h-7 text-neutral-500" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm sm:text-base text-white uppercase truncate">
                          {ab.suspectNome}
                        </h3>
                      </div>

                      {ab.suspectAlcunha && (
                        <div className="text-xs text-[#e5c07b] font-mono font-bold">
                          Vulgo: "{ab.suspectAlcunha}"
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-mono">
                        {ab.suspectRg && <span>RG: {ab.suspectRg}</span>}
                        {ab.suspectCpf && <span>• CPF: {ab.suspectCpf}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Informações da Ocorrência */}
                  <div className="flex-1 min-w-0 md:px-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-neutral-300">
                      <Calendar className="w-3.5 h-3.5 text-[#c69c59] flex-shrink-0" />
                      <span className="font-mono font-bold text-white">{ab.data}</span>
                      <span className="text-neutral-500">•</span>
                      <Clock className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                      <span className="font-mono text-neutral-300">{ab.hora}</span>
                      {ab.viatura && (
                        <>
                          <span className="text-neutral-500">•</span>
                          <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[10px] font-mono text-[#e5c07b]">
                            {ab.viatura}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-neutral-300 truncate">
                      <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span className="truncate">{ab.endereco}</span>
                    </div>

                    {ab.natureza && (
                      <div className="text-[11px] text-neutral-400 truncate">
                        <strong>Natureza:</strong> {ab.natureza}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
                      title="Abrir no Google Maps"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {matchedSuspect && onOpenSuspectDetail && (
                      <button
                        type="button"
                        onClick={() => onOpenSuspectDetail(matchedSuspect)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1e2536] hover:bg-[#273248] border border-[#c69c59]/50 text-[#e5c07b] text-xs font-bold transition-all cursor-pointer"
                      >
                        <span>Abrir Ficha</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setAbordagemToDelete(ab)}
                      className="p-2 rounded-xl bg-neutral-800 hover:bg-rose-950/80 text-neutral-400 hover:text-rose-400 border border-neutral-700 hover:border-rose-800/80 transition-all cursor-pointer"
                      title="Excluir Registro de Abordagem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Confirmação de Exclusão de Abordagem */}
      {abordagemToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div
            className="relative w-full max-w-sm bg-[#121622] border border-red-500/60 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Excluir Abordagem?</span>
            </h4>
            <div className="p-2.5 rounded-xl bg-[#181d2a] border border-neutral-800 text-xs space-y-1">
              <span className="font-bold text-white block uppercase">{abordagemToDelete.suspectNome}</span>
              <span className="text-[11px] text-[#e5c07b] block">{abordagemToDelete.data} às {abordagemToDelete.hora}</span>
              <span className="text-[11px] text-neutral-400 block truncate">{abordagemToDelete.endereco}</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Deseja realmente excluir este registro de abordagem? Esta ação atualizará o histórico e os dados do abordado no banco de dados.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAbordagemToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer transition-colors shadow"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Nova Abordagem */}
      {isNewAbordagemModalOpen && selectedSuspectToAbordar && (
        <NovaAbordagemModal
          isOpen={isNewAbordagemModalOpen}
          onClose={() => setIsNewAbordagemModalOpen(false)}
          suspect={selectedSuspectToAbordar}
          allSuspects={allSuspects}
          onSuccess={() => {
            loadAbordagens();
          }}
          onRequestNovoCadastro={onRequestNovoCadastro}
        />
      )}
    </div>
  );
};
