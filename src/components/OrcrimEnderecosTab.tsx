import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Navigation,
  Search,
  Crosshair,
  ExternalLink,
  X,
  AlertTriangle,
  Building,
  ShieldAlert,
  Home,
  CheckCircle2,
  Compass,
  Layers,
  Info,
} from 'lucide-react';
import { OrcrimEndereco, OrcrimRecord } from '../types';
import { getActiveGPS, reverseGeocodeLocation, searchAddressLocations, AddressSuggestion } from '../utils/gpsService';
import { addEnderecoToOrcrim, removeEnderecoFromOrcrim } from '../utils/orcrimStorage';

interface OrcrimEnderecosTabProps {
  orcrim: OrcrimRecord;
  onUpdateOrcrim: (updatedOrcrim: OrcrimRecord) => void;
  onToast?: (message: string) => void;
}

const TIPOS_ENDERECO = [
  { value: 'PONTO_DE_TRAFICO', label: 'Ponto de Tráfico / Boca', color: 'bg-red-500/20 text-red-300 border-red-500/40', badge: 'bg-red-500 text-white' },
  { value: 'SEDE', label: 'Sede / Reunião', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', badge: 'bg-amber-500 text-neutral-950 font-black' },
  { value: 'ESCONDERIJO', label: 'Esconderijo / Refúgio', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', badge: 'bg-purple-500 text-white' },
  { value: 'PONTO_DE_APOIO', label: 'Ponto de Apoio / Logística', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', badge: 'bg-blue-500 text-white' },
  { value: 'DEPOSITO_DE_ARMAS', label: 'Depósito de Armas / Drogas', color: 'bg-rose-900/40 text-rose-200 border-rose-700/60', badge: 'bg-rose-700 text-white font-bold' },
  { value: 'OUTRO', label: 'Outro Local Operacional', color: 'bg-neutral-800 text-neutral-300 border-neutral-700', badge: 'bg-neutral-700 text-white' },
];

export const OrcrimEnderecosTab: React.FC<OrcrimEnderecosTabProps> = ({
  orcrim,
  onUpdateOrcrim,
  onToast,
}) => {
  const enderecos = orcrim.enderecos || [];
  const [selectedEndereco, setSelectedEndereco] = useState<OrcrimEndereco | null>(
    enderecos.length > 0 ? enderecos[0] : null
  );

  const [isModalAddOpen, setIsModalAddOpen] = useState(false);
  const [logradouroInput, setLogradouroInput] = useState('');
  const [bairroInput, setBairroInput] = useState('');
  const [tipoInput, setTipoInput] = useState<string>('PONTO_DE_TRAFICO');
  const [observacoesInput, setObservacoesInput] = useState('');
  const [coordsInput, setCoordsInput] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Autocomplete / Busca de endereços
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [enderecoToDelete, setEnderecoToDelete] = useState<string | null>(null);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (enderecos.length > 0 && !selectedEndereco) {
      setSelectedEndereco(enderecos[0]);
    } else if (selectedEndereco && !enderecos.find((e) => e.id === selectedEndereco.id)) {
      setSelectedEndereco(enderecos.length > 0 ? enderecos[0] : null);
    }
  }, [enderecos]);

  // Captura localização atual do GPS pelo celular
  const handleCaptureGPS = async () => {
    setIsLocatingGPS(true);
    setGeoError(null);
    try {
      const coords = await getActiveGPS();
      setCoordsInput(coords);
      const geo = await reverseGeocodeLocation(coords.lat, coords.lng);
      if (geo.address) {
        setLogradouroInput(geo.address);
      }
      if (geo.neighborhood) {
        setBairroInput(geo.neighborhood);
      }
      if (onToast) {
        onToast(`📍 GPS capturado: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
      }
    } catch (err: any) {
      console.warn('Erro ao obter GPS:', err);
      setGeoError('Não foi possível obter sinal de GPS com precisão. Digite o endereço ou verifique as permissões.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  // Autocomplete ao digitar o endereço
  const handleAddressInputChange = (val: string) => {
    setLogradouroInput(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length >= 3) {
      setIsSearchingAddress(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const list = await searchAddressLocations(val);
          setSuggestions(list);
          setShowSuggestions(list.length > 0);
        } catch {
          setSuggestions([]);
        } finally {
          setIsSearchingAddress(false);
        }
      }, 400);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearchingAddress(false);
    }
  };

  const handleSelectSuggestion = (sug: AddressSuggestion) => {
    setLogradouroInput(sug.formattedAddress || sug.road);
    if (sug.suburb) {
      setBairroInput(sug.suburb);
    }
    setCoordsInput({ lat: sug.lat, lng: sug.lng });
    setShowSuggestions(false);
  };

  const handleSaveEndereco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logradouroInput.trim()) {
      setGeoError('Informe o logradouro / endereço do local.');
      return;
    }

    // Se ainda não tiver coordenadas, tenta resolver via busca de endereço ou padrão
    let finalCoords = coordsInput;
    if (!finalCoords) {
      try {
        const found = await searchAddressLocations(`${logradouroInput.trim()}, ${bairroInput.trim()}`);
        if (found.length > 0) {
          finalCoords = { lat: found[0].lat, lng: found[0].lng };
        } else {
          // Padrão centro Belo Horizonte
          finalCoords = { lat: -19.916681, lng: -43.934493 };
        }
      } catch {
        finalCoords = { lat: -19.916681, lng: -43.934493 };
      }
    }

    const res = await addEnderecoToOrcrim(orcrim.id, {
      logradouro: logradouroInput.trim().toUpperCase(),
      bairro: bairroInput.trim().toUpperCase() || undefined,
      tipo: tipoInput,
      coordenadas: finalCoords,
      observacoes: observacoesInput.trim() || undefined,
    });

    if (res) {
      onUpdateOrcrim(res);
      const novo = res.enderecos && res.enderecos[0];
      if (novo) setSelectedEndereco(novo);
      setIsModalAddOpen(false);
      setLogradouroInput('');
      setBairroInput('');
      setTipoInput('PONTO_DE_TRAFICO');
      setObservacoesInput('');
      setCoordsInput(null);
      if (onToast) onToast('Endereço operacional adicionado com sucesso!');
    }
  };

  const handleDeleteEndereco = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEnderecoToDelete(id);
  };

  const handleConfirmDeleteEndereco = async () => {
    if (!enderecoToDelete) return;
    const res = await removeEnderecoFromOrcrim(orcrim.id, enderecoToDelete);
    if (res) {
      onUpdateOrcrim(res);
      if (onToast) onToast('Endereço removido.');
    }
    setEnderecoToDelete(null);
  };

  const getTipoInfo = (tipo: string) => {
    return (
      TIPOS_ENDERECO.find((t) => t.value === tipo) || {
        value: tipo,
        label: tipo.replace(/_/g, ' '),
        color: 'bg-neutral-800 text-neutral-300 border-neutral-700',
        badge: 'bg-neutral-700 text-white',
      }
    );
  };

  // Coordenadas padrão para o mapa
  const activeLat = selectedEndereco?.coordenadas?.lat ?? -19.916681;
  const activeLng = selectedEndereco?.coordenadas?.lng ?? -43.934493;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Topo da Aba: Título, contagem e Botão Adicionar Endereço */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 p-3.5 rounded-2xl bg-[#121622] border border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <MapPin className="w-5 h-5 text-[#c69c59]" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Endereços da Organização</span>
              <span className="px-2 py-0.5 rounded-full bg-[#c69c59] text-neutral-950 font-black text-xs font-mono">
                {enderecos.length}
              </span>
            </h4>
            <p className="text-[11px] text-neutral-400">
              Locais vinculados: pontos de tráfico (bocas de fumo), sedes, esconderijos e depósitos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setGeoError(null);
            setIsModalAddOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-md shadow-[#c69c59]/20 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 text-neutral-950" />
          <span>+ Adicionar Endereço</span>
        </button>
      </div>

      {enderecos.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-neutral-800 bg-[#0e1219]">
          <MapPin className="w-10 h-10 text-neutral-600 mx-auto mb-2.5" />
          <h5 className="text-sm font-bold text-white uppercase">Nenhum Ponto ou Endereço Mapeado</h5>
          <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
            Cadastre os pontos de droga, locais de encontro, esconderijos ou sedes associados à facção {orcrim.sigla}.
            Você pode buscar pelo endereço ou capturar o GPS instantaneamente pelo celular.
          </p>
          <button
            type="button"
            onClick={() => setIsModalAddOpen(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-[#1c2434] hover:bg-[#253046] border border-[#c69c59]/50 text-[#f5d799] text-xs font-bold cursor-pointer transition-all"
          >
            + Cadastrar Primeiro Local
          </button>
        </div>
      ) : (
        /* Layout Grid: Lista na Esquerda + Mapa Tático na Direita */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Coluna Esquerda: Lista de Endereços */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {enderecos.map((end) => {
              const isSelected = selectedEndereco?.id === end.id;
              const info = getTipoInfo(end.tipo);

              return (
                <div
                  key={end.id}
                  onClick={() => setSelectedEndereco(end)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'bg-[#182030] border-[#c69c59] shadow-lg shadow-[#c69c59]/10 ring-1 ring-[#c69c59]/50'
                      : 'bg-[#121622] border-neutral-800 hover:border-neutral-700 hover:bg-[#151a26]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        isSelected
                          ? 'bg-[#c69c59] text-neutral-950 border-[#d8ab62]'
                          : 'bg-[#1b2230] text-neutral-400 border-neutral-700/60'
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <h5 className="font-extrabold text-xs text-white uppercase truncate">
                        {end.logradouro}
                      </h5>
                      {end.bairro && (
                        <div className="text-[11px] text-neutral-400 truncate">
                          Bairro: <span className="text-neutral-300 font-semibold">{end.bairro}</span>
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${info.color}`}>
                          {info.label}
                        </span>
                        {end.coordenadas && (
                          <span className="text-[9px] font-mono text-neutral-500">
                            {end.coordenadas.lat.toFixed(4)}, {end.coordenadas.lng.toFixed(4)}
                          </span>
                        )}
                      </div>

                      {end.observacoes && (
                        <p className="text-[10px] text-neutral-400 mt-1.5 line-clamp-2 italic bg-[#0c0f16]/60 p-1.5 rounded-lg border border-neutral-800/80">
                          "{end.observacoes}"
                        </p>
                      )}
                    </div>

                    {/* Botão de Excluir */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteEndereco(e, end.id)}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Excluir este endereço"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Coluna Direita: Mapa Interativo com Alfinete do Ponto Selecionado */}
          <div className="lg:col-span-7 space-y-3">
            <div className="rounded-3xl bg-[#10141d] border border-[#c69c59]/40 p-3 shadow-xl space-y-2.5">
              {/* Header do Mapa com Card de Informação do Ponto */}
              <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#c69c59]" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    {selectedEndereco ? selectedEndereco.logradouro : 'Mapa Operacional'}
                  </span>
                </div>

                {selectedEndereco?.coordenadas && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedEndereco.coordenadas.lat},${selectedEndereco.coordenadas.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#e5c07b] hover:text-white transition-colors"
                  >
                    <span>Abrir no Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Iframe do Mapa com Alfinete Fixado */}
              <div className="relative w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-neutral-800 bg-black shadow-inner">
                <iframe
                  title="Mapa de Endereços da ORCRIM"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  src={`https://maps.google.com/maps?q=${activeLat},${activeLng}&hl=pt-BR&z=17&output=embed`}
                />

                {/* Card Flutuante de Identificação do Local (conforme imagem anexa) */}
                {selectedEndereco && (
                  <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-xs z-10 bg-[#0e121a]/95 backdrop-blur-md border border-[#c69c59]/80 rounded-2xl p-3 shadow-2xl text-xs space-y-1 animate-fadeIn">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-white uppercase truncate">
                        {selectedEndereco.logradouro}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-red-500 text-white flex-shrink-0">
                        {getTipoInfo(selectedEndereco.tipo).label}
                      </span>
                    </div>

                    {selectedEndereco.bairro && (
                      <div className="text-[11px] text-[#e5c07b] font-semibold">
                        Bairro: {selectedEndereco.bairro}
                      </div>
                    )}

                    {selectedEndereco.observacoes && (
                      <p className="text-[10px] text-neutral-300 leading-tight pt-1 border-t border-neutral-800">
                        {selectedEndereco.observacoes}
                      </p>
                    )}

                    <div className="text-[9px] font-mono text-neutral-400 pt-1 flex items-center justify-between">
                      <span>📍 Alfinete ativo</span>
                      <span>
                        {activeLat.toFixed(5)}, {activeLng.toFixed(5)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dica Operacional */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#c69c59]" />
                  <span>Clique em qualquer endereço na lista para mover o alfinete no mapa</span>
                </span>
                <span className="font-mono text-[10px] text-neutral-500 hidden sm:inline">
                  Satélite & Ruas
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR NOVO ENDEREÇO OPERACIONAL COM CAPTURA DE GPS */}
      {isModalAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0e121a] border border-[#c69c59]/50 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <MapPin className="w-4 h-4 text-[#c69c59]" />
                </div>
                <div>
                  <h4 className="font-black text-white text-sm uppercase">Novo Local da Organização</h4>
                  <p className="text-[11px] text-neutral-400">
                    Cadastre ponto de tráfico, sede ou refúgio da facção {orcrim.sigla}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalAddOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEndereco} className="space-y-3.5 text-xs">
              {/* Botão de Destaque: Capturar GPS Atual pelo Celular */}
              <div className="p-3 rounded-2xl bg-[#141924] border border-[#c69c59]/40 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#1c2436] flex items-center justify-center text-[#e5c07b]">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">
                      Está no local pelo celular?
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Captura a coordenada GPS e fixa o alfinete automaticamente
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCaptureGPS}
                  disabled={isLocatingGPS}
                  className="px-3.5 py-2 rounded-xl bg-[#c69c59] hover:bg-[#d8ab60] text-neutral-950 font-black text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex-shrink-0"
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isLocatingGPS ? 'animate-spin' : ''}`} />
                  <span>{isLocatingGPS ? 'Localizando...' : 'Pegar GPS'}</span>
                </button>
              </div>

              {geoError && (
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>{geoError}</span>
                </div>
              )}

              {/* Campo 1: Logradouro com Autocomplete */}
              <div className="relative">
                <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                  Endereço / Logradouro <span className="text-[#c69c59]">*</span>
                </label>
                <input
                  type="text"
                  value={logradouroInput}
                  onChange={(e) => handleAddressInputChange(e.target.value)}
                  placeholder="Ex: RUA DAS FLORES, 100"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase font-semibold"
                  required
                />

                {/* Dropdown de sugestões do endereço */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#121622] border border-[#c69c59]/70 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {suggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(sug)}
                        className="p-2.5 hover:bg-[#1c2436] border-b border-neutral-800 text-neutral-200 text-[11px] cursor-pointer flex items-center gap-2 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#c69c59] flex-shrink-0" />
                        <span className="truncate">{sug.formattedAddress}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campo 2: Bairro e Tipo de Local */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={bairroInput}
                    onChange={(e) => setBairroInput(e.target.value)}
                    placeholder="Ex: SANTA TEREZA"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none uppercase font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                    Tipo do Ponto / Local <span className="text-[#c69c59]">*</span>
                  </label>
                  <select
                    value={tipoInput}
                    onChange={(e) => setTipoInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-[#e5c07b] font-bold text-xs outline-none"
                  >
                    {TIPOS_ENDERECO.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Coordenadas GPS (se capturadas ou digitadas) */}
              {coordsInput && (
                <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-600/40 text-emerald-300 text-[11px] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Alfinete definido: {coordsInput.lat.toFixed(6)}, {coordsInput.lng.toFixed(6)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoordsInput(null)}
                    className="text-neutral-400 hover:text-red-400 text-[10px] cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              )}

              {/* Campo 3: Observações de Campo / Inteligência */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-neutral-300 mb-1">
                  Observações de Inteligência / Tráfico
                </label>
                <textarea
                  rows={3}
                  value={observacoesInput}
                  onChange={(e) => setObservacoesInput(e.target.value)}
                  placeholder="Informações sobre horários de pico, olheiros, rotas de fuga, comparsas do ponto..."
                  className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none resize-none"
                />
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalAddOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#c69c59] to-[#d8ab62] hover:from-[#d8ab62] hover:to-[#e5c07b] text-neutral-950 font-black text-xs uppercase shadow-md shadow-[#c69c59]/20 transition-all cursor-pointer"
                >
                  Salvar Ponto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Endereço */}
      {enderecoToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div
            className="relative w-full max-w-sm bg-[#121622] border border-rose-500/60 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Remover Ponto Operacional?</span>
            </h4>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Deseja realmente remover este endereço da organização criminosa? O registro do local será excluído.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEnderecoToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteEndereco}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Sim, Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
