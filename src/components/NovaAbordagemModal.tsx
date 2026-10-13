import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  Clock,
  Camera,
  Upload,
  UserPlus,
  Trash2,
  CheckCircle2,
  Loader2,
  Search,
  Navigation,
  FileText,
  User,
  AlertTriangle,
} from 'lucide-react';
import { AbordagemRecord, SuspectRecord } from '../types';
import { getActiveGPS, reverseGeocodeLocation } from '../utils/gpsService';
import { saveAbordagem } from '../utils/abordagensStorage';

interface NovaAbordagemModalProps {
  isOpen: boolean;
  onClose: () => void;
  suspect: SuspectRecord;
  allSuspects: SuspectRecord[];
  onSuccess: (saved: AbordagemRecord) => void;
  onRequestNovoCadastro?: (nomeInicial: string) => void;
}

export const NovaAbordagemModal: React.FC<NovaAbordagemModalProps> = ({
  isOpen,
  onClose,
  suspect,
  allSuspects,
  onSuccess,
  onRequestNovoCadastro,
}) => {
  const [data, setData] = useState(() => {
    const d = new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
  });

  const [hora, setHora] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const [endereco, setEndereco] = useState(suspect.localAbordagem || suspect.endereco || '');
  const [bairro, setBairro] = useState('');
  const [coordenadas, setCoordenadas] = useState(suspect.coordenadas || '');
  const [viatura, setViatura] = useState('');
  const [natureza, setNatureza] = useState('Abordagem Preventiva / Busca Pessoal');
  const [observacoes, setObservacoes] = useState('');
  const [foto, setFoto] = useState<string | null>(null);

  // GPS automático
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Outras pessoas abordadas com campo de busca opcional e botão + para novo registro
  const [searchOtherTerm, setSearchOtherTerm] = useState('');
  const [outrosAbordados, setOutrosAbordados] = useState<Array<{
    suspectId?: string;
    nome: string;
    alcunha?: string;
    rg?: string;
  }>>([]);

  const [showOtherSuggestions, setShowOtherSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Busca GPS e hora automáticos ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const dia = String(now.getDate()).padStart(2, '0');
      const mes = String(now.getMonth() + 1).padStart(2, '0');
      setData(`${dia}/${mes}/${now.getFullYear()}`);
      setHora(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      handleGetGPSAutomatic();
    }
  }, [isOpen]);

  const handleGetGPSAutomatic = async () => {
    setIsLocating(true);
    setGeoError(null);
    try {
      const coords = await getActiveGPS();
      if (coords) {
        const coordStr = `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
        setCoordenadas(coordStr);

        // Busca endereço aproximado por geocodificação reversa
        try {
          const rev = await reverseGeocodeLocation(coords.lat, coords.lng);
          if (rev && rev.address) {
            setEndereco(rev.address);
            if (rev.neighborhood) setBairro(rev.neighborhood);
          }
        } catch (_) {}
      }
    } catch (err: any) {
      setGeoError(err?.message || 'GPS indisponível no momento.');
    } finally {
      setIsLocating(false);
    }
  };

  if (!isOpen) return null;

  // Filtragem para sugestão de outras pessoas abordadas
  const otherMatches = searchOtherTerm.trim().length >= 2
    ? allSuspects
        .filter((s) => s.id !== suspect.id)
        .filter((s) =>
          s.nome.toLowerCase().includes(searchOtherTerm.toLowerCase()) ||
          (s.alcunha && s.alcunha.toLowerCase().includes(searchOtherTerm.toLowerCase())) ||
          (s.rg && s.rg.includes(searchOtherTerm))
        )
        .slice(0, 5)
    : [];

  const handleAddExistingOther = (otherSuspect: SuspectRecord) => {
    if (!outrosAbordados.some((o) => o.suspectId === otherSuspect.id)) {
      setOutrosAbordados((prev) => [
        ...prev,
        {
          suspectId: otherSuspect.id,
          nome: otherSuspect.nome,
          alcunha: otherSuspect.alcunha,
          rg: otherSuspect.rg,
        },
      ]);
    }
    setSearchOtherTerm('');
    setShowOtherSuggestions(false);
  };

  const handleRemoveOther = (index: number) => {
    setOutrosAbordados((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Botão quadradinho com símbolo [+] de pessoa para criar novo abordado que não existe no banco
  const handleAddNewSuspectQuick = () => {
    const nomeToRegister = searchOtherTerm.trim();
    if (onRequestNovoCadastro) {
      onRequestNovoCadastro(nomeToRegister);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setFoto(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newAbordagem: AbordagemRecord = {
      id: `abord-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      suspectId: suspect.id,
      suspectNome: suspect.nome,
      suspectAlcunha: suspect.alcunha,
      suspectRg: suspect.rg,
      suspectCpf: suspect.cpf,
      suspectFoto: suspect.fotos?.[0] || undefined,
      data,
      hora,
      endereco: endereco || 'Local não informado',
      bairro: bairro || undefined,
      coordenadas: coordenadas || undefined,
      viatura: viatura || undefined,
      natureza,
      observacoes: observacoes || undefined,
      foto: foto || undefined,
      outrosAbordados: outrosAbordados.length > 0 ? outrosAbordados : undefined,
      criadoEm: new Date().toISOString(),
    };

    saveAbordagem(newAbordagem);
    setIsSubmitting(false);
    onSuccess(newAbordagem);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl my-auto bg-[#0a0d14] border border-[#c69c59]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-neutral-800 bg-[#0d111a]">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#c69c59] shadow-[0_0_8px_rgba(198,156,89,0.7)]" />
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Registrar Nova Abordagem
              </h3>
              <p className="text-[11px] text-[#e5c07b] font-medium truncate max-w-[280px] sm:max-w-md">
                Abordado: {suspect.nome} {suspect.alcunha ? `(${suspect.alcunha})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Data e Hora (Automáticos) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Data do Registro
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white font-mono font-bold focus:border-[#c69c59] outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-neutral-300 uppercase">
                  Hora da Abordagem
                </label>
                <span className="text-[9px] text-[#e5c07b] font-mono">Automático</span>
              </div>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-[#c69c59] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white font-mono font-bold focus:border-[#c69c59] outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Localização GPS Automática */}
          <div className="p-3 rounded-xl bg-[#111622] border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-300 uppercase flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#c69c59]" />
                <span>GPS e Local da Intervenção</span>
              </span>
              <button
                type="button"
                onClick={handleGetGPSAutomatic}
                disabled={isLocating}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#182030] hover:bg-[#202c44] border border-[#c69c59]/40 text-[#f5d799] text-[10px] font-bold transition-all cursor-pointer"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-[#c69c59]" />
                    <span>Obtendo GPS...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3 h-3 text-[#c69c59]" />
                    <span>Recarregar GPS</span>
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Endereço ou Ponto de Referência"
              className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white focus:border-[#c69c59] outline-none"
              required
            />

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={coordenadas}
                onChange={(e) => setCoordenadas(e.target.value)}
                placeholder="Latitude, Longitude (ex: -19.916681, -43.934493)"
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#0c0f16] border border-neutral-800 text-[11px] font-mono text-neutral-300 outline-none"
              />
              {coordenadas && (
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-1 rounded-lg">
                  GPS OK
                </span>
              )}
            </div>

            {geoError && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>{geoError}</span>
              </p>
            )}
          </div>

          {/* Viatura / Natureza */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Viatura / Equipe
              </label>
              <input
                type="text"
                value={viatura}
                onChange={(e) => setViatura(e.target.value)}
                placeholder="Ex: VP 31.840 / ROCCA"
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white focus:border-[#c69c59] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
                Natureza da Ação
              </label>
              <input
                type="text"
                value={natureza}
                onChange={(e) => setNatureza(e.target.value)}
                placeholder="Ex: Averiguação em Ponto de Tráfico"
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white focus:border-[#c69c59] outline-none"
              />
            </div>
          </div>

          {/* Foto Opcional da Abordagem */}
          <div className="p-3 rounded-xl bg-[#111622] border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-neutral-300 uppercase block">
                  Fotografia da Abordagem
                </span>
                <span className="text-[10px] text-neutral-500">
                  (Opcional - registro da intervenção ou material)
                </span>
              </div>

              {foto && (
                <button
                  type="button"
                  onClick={() => setFoto(null)}
                  className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remover</span>
                </button>
              )}
            </div>

            {foto ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden bg-black border border-neutral-700 flex items-center justify-center">
                <img src={foto} alt="Abordagem" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#182030] hover:bg-[#202c44] border border-neutral-700 text-neutral-200 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#c69c59]" />
                  <span>Tirar Foto</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#182030] hover:bg-[#202c44] border border-neutral-700 text-neutral-200 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Galeria</span>
                </button>
              </div>
            )}
          </div>

          {/* Outras Pessoas Abordadas Juntas (Opcional) */}
          <div className="p-3 rounded-xl bg-[#111622] border border-neutral-800 space-y-2.5">
            <div>
              <span className="text-[11px] font-bold text-neutral-300 uppercase block">
                Outras Pessoas Abordadas na Mesma Ocorrência
              </span>
              <span className="text-[10px] text-neutral-500">
                Opcional. Se não estiver no banco, clique no botão [+] ao lado para cadastrar.
              </span>
            </div>

            {/* Input com Busca e Botão Quadradinho [+] */}
            <div className="relative flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchOtherTerm}
                  onChange={(e) => {
                    setSearchOtherTerm(e.target.value);
                    setShowOtherSuggestions(true);
                  }}
                  onFocus={() => setShowOtherSuggestions(true)}
                  placeholder="Pesquisar por nome, vulgo ou RG..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white placeholder-neutral-500 outline-none focus:border-[#c69c59]"
                />
              </div>

              {/* Botão quadradinho com símbolo de uma pessoa com um maiszinho [+] */}
              <button
                type="button"
                id="btn-add-novo-abordado-inline"
                onClick={handleAddNewSuspectQuick}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0"
                title="Cadastrar Novo Abordado no Banco de Dados"
              >
                <UserPlus className="w-4 h-4 text-neutral-950 stroke-[2.5]" />
              </button>
            </div>

            {/* Dropdown de sugestões do banco */}
            {showOtherSuggestions && otherMatches.length > 0 && (
              <div className="bg-[#141923] border border-neutral-700 rounded-xl overflow-hidden shadow-xl max-h-40 overflow-y-auto">
                {otherMatches.map((other) => (
                  <button
                    key={other.id}
                    type="button"
                    onClick={() => handleAddExistingOther(other)}
                    className="w-full text-left px-3 py-2 hover:bg-[#1f2637] border-b border-neutral-800/80 flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-white block uppercase">{other.nome}</span>
                      <span className="text-[10px] text-neutral-400">
                        {other.alcunha ? `Vulgo: ${other.alcunha} • ` : ''}RG: {other.rg || 'N/A'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#c69c59]">+ Vincular</span>
                  </button>
                ))}
              </div>
            )}

            {/* Lista dos outros abordados adicionados */}
            {outrosAbordados.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {outrosAbordados.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#182030] border border-[#c69c59]/50 text-white text-[11px]"
                  >
                    <User className="w-3 h-3 text-[#c69c59]" />
                    <span className="font-bold">{item.nome}</span>
                    {item.alcunha && <span className="text-[#e5c07b]">({item.alcunha})</span>}
                    <button
                      type="button"
                      onClick={() => handleRemoveOther(idx)}
                      className="text-neutral-400 hover:text-red-400 ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-300 uppercase mb-1">
              Observação da Abordagem
            </label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Descreva detalhes da abordagem, atitude suspeita, materiais apreendidos, etc."
              className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 text-white focus:border-[#c69c59] outline-none resize-y min-h-[90px]"
            />
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-bold shadow-lg shadow-[#c69c59]/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-neutral-950" />
              <span>Salvar Abordagem</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
