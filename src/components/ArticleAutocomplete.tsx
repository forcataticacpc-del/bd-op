import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Check, Plus, Tag, Trash2, X, AlertCircle } from 'lucide-react';
import {
  LegalArticle,
  filterLegalArticles,
  getShortArticleFormat,
  parseArticlesString,
  formatCustomArticle,
} from '../data/legalArticles';

interface ArticleAutocompleteProps {
  /** Array de tags de artigos já selecionados */
  articles?: string[];
  /** String legada unificada (ex: "(157 - Roubo), (33 - Tráfico)") */
  value?: string;
  /** Callback acionado ao adicionar/remover tags. Devolve tanto o array quanto a string concatenada */
  onChange: (articles: string[], joinedString: string) => void;
  id?: string;
  maxArticles?: number;
}

export const ArticleAutocomplete: React.FC<ArticleAutocompleteProps> = ({
  articles: propArticles,
  value: propValue,
  onChange,
  id = 'input-artigo',
  maxArticles = 30,
}) => {
  // Inicializa a lista de artigos selecionados garantindo até 30 itens
  const selectedArticles: string[] = React.useMemo(() => {
    if (propArticles && Array.isArray(propArticles)) {
      return propArticles.slice(0, maxArticles);
    }
    if (propValue) {
      return parseArticlesString(propValue).slice(0, maxArticles);
    }
    return [];
  }, [propArticles, propValue, maxArticles]);

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtra sugestões baseadas no que o operador está digitando no momento
  const suggestions = filterLegalArticles(inputValue);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notifica o componente pai sobre a alteração
  const triggerChange = (updatedList: string[]) => {
    const cleanList = updatedList.slice(0, maxArticles);
    const joined = cleanList.join(', ');
    onChange(cleanList, joined);
  };

  const showTemporaryFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 2500);
  };

  // Adiciona um crime como tag
  const handleAddArticle = (articleText: string) => {
    const formatted = formatCustomArticle(articleText);
    if (!formatted) return;

    if (selectedArticles.length >= maxArticles) {
      showTemporaryFeedback(`Limite máximo de ${maxArticles} crimes atingido.`);
      return;
    }

    // Evita duplicatas idênticas
    const normalizedTarget = formatted.toLowerCase();
    const alreadyExists = selectedArticles.some(
      (a) => a.toLowerCase() === normalizedTarget
    );

    if (alreadyExists) {
      showTemporaryFeedback(`O crime ${formatted} já está na lista.`);
      setInputValue('');
      setIsOpen(false);
      return;
    }

    const updated = [...selectedArticles, formatted];
    triggerChange(updated);
    setInputValue('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Remove um crime selecionado
  const handleRemoveArticle = (indexToRemove: number) => {
    const updated = selectedArticles.filter((_, idx) => idx !== indexToRemove);
    triggerChange(updated);
  };

  // Limpa todos os crimes
  const handleClearAll = () => {
    triggerChange([]);
    setInputValue('');
    inputRef.current?.focus();
  };

  // Seleciona do dropdown de sugestões
  const handleSelectSuggestion = (article: LegalArticle) => {
    const shortText = getShortArticleFormat(article);
    handleAddArticle(shortText);
  };

  // Teclado (Enter, ArrowDown, ArrowUp, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else if (inputValue.trim()) {
        handleAddArticle(inputValue.trim());
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    } else if (e.key === 'Backspace' && !inputValue && selectedArticles.length > 0) {
      // Remove o último se o input estiver vazio
      handleRemoveArticle(selectedArticles.length - 1);
    }
  };

  // Badges de categoria
  const getBadgeStyle = (category: LegalArticle['category']) => {
    switch (category) {
      case 'DROGAS':
        return 'bg-emerald-950/80 border-emerald-700/70 text-emerald-400';
      case 'ARMAS':
        return 'bg-rose-950/80 border-rose-700/70 text-rose-400';
      case 'CTB':
        return 'bg-blue-950/80 border-blue-700/70 text-blue-400';
      case 'ESPECIAIS':
        return 'bg-purple-950/80 border-purple-700/70 text-purple-400';
      case 'CONTRAVENCOES':
        return 'bg-amber-950/80 border-amber-700/70 text-amber-400';
      default:
        return 'bg-neutral-800 border-neutral-700 text-[#e5c07b]';
    }
  };

  const isLimitReached = selectedArticles.length >= maxArticles;

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {/* Header com rótulo e contador tático */}
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-[#c69c59]" />
          <span>Artigo / Crimes do Abordado</span>
        </label>

        <div className="flex items-center gap-2">
          {selectedArticles.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-neutral-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer font-mono"
              title="Limpar todos os crimes selecionados"
            >
              <Trash2 className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}

          {isLimitReached && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border bg-red-950/80 border-red-700 text-red-300">
              Limite Atingido
            </span>
          )}
        </div>
      </div>

      {/* Box de Tags / Chips com visual tático de alta legibilidade */}
      <div className="p-2.5 min-h-[44px] rounded-xl bg-[#13161f] border border-neutral-700/90 focus-within:border-[#c69c59] transition-all space-y-2 shadow-inner">
        {selectedArticles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {selectedArticles.map((tag, idx) => (
              <span
                key={`${tag}-${idx}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a202c] border border-[#c69c59]/70 text-xs font-mono font-semibold text-[#e5c07b] shadow-sm animate-fadeIn"
              >
                <Tag className="w-3 h-3 text-[#c69c59] flex-shrink-0" />
                <span className="truncate max-w-[240px] sm:max-w-xs">{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveArticle(idx)}
                  className="p-0.5 rounded-full hover:bg-neutral-700/80 text-neutral-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                  title={`Remover ${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Linha de entrada de texto + botão Adicionar */}
        <div className="relative flex items-center gap-2 pt-1 border-t border-neutral-800/80">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              id={id}
              value={inputValue}
              disabled={isLimitReached}
              onChange={(e) => {
                const val = e.target.value;
                setInputValue(val);
                setIsOpen(val.trim().length > 0);
                setSelectedIndex(-1);
              }}
              onFocus={() => {
                if (!isLimitReached && inputValue.trim().length > 0) {
                  setIsOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isLimitReached
                  ? `Limite de ${maxArticles} crimes atingido`
                  : 'Digite número ou nome do crime (ex: 157, roubo, 33, tráfico)...'
              }
              autoComplete="off"
              className="w-full px-3 py-1.5 pr-8 rounded-lg bg-[#181d28] border border-neutral-700/80 focus:border-[#c69c59] text-white text-xs outline-none transition-colors font-mono placeholder:font-sans placeholder:text-neutral-500 disabled:opacity-50"
            />

            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue('');
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Limpar texto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (inputValue.trim()) {
                handleAddArticle(inputValue.trim());
              }
            }}
            disabled={isLimitReached || !inputValue.trim()}
            className="px-3 py-1.5 rounded-lg bg-[#c69c59]/20 hover:bg-[#c69c59]/30 text-[#e5c07b] border border-[#c69c59]/60 hover:border-[#c69c59] text-xs font-medium flex items-center gap-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-sm flex-shrink-0"
            title="Adicionar crime como tag"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      {/* Feedback temporário de alerta (ex: limite atingido ou crime já existente) */}
      {feedbackMsg && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-600/70 text-amber-300 text-xs font-sans animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Dropdown Flutuante de Sugestões Inteligentes - Apenas enquanto o operador estiver a digitar */}
      {inputValue.trim().length > 0 && isOpen && !isLimitReached && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#12161f] border border-neutral-700 rounded-xl shadow-2xl overflow-hidden max-h-72 flex flex-col">
          <div className="px-3 py-1.5 bg-[#181d28] border-b border-neutral-700/80 text-[10px] text-neutral-400 font-mono flex items-center justify-between">
            <span>SUGESTÕES LEGAIS ({suggestions.length})</span>
            <span className="text-[#e5c07b]">Insere como Tag: (Número - Nome)</span>
          </div>

          <div className="overflow-y-auto divide-y divide-neutral-800/80 p-1">
            {suggestions.length === 0 ? (
              <div className="px-4 py-3 text-center text-xs text-neutral-400 space-y-2">
                <p>Nenhum artigo pré-catalogado para &quot;{inputValue}&quot;.</p>
                {inputValue.trim() && (
                  <button
                    type="button"
                    onClick={() => handleAddArticle(inputValue.trim())}
                    className="px-3 py-1 rounded bg-[#c69c59]/20 hover:bg-[#c69c59]/30 text-[#e5c07b] text-xs font-mono border border-[#c69c59]/60 transition-colors"
                  >
                    + Adicionar &quot;{formatCustomArticle(inputValue.trim())}&quot; mesmo assim
                  </button>
                )}
              </div>
            ) : (
              suggestions.map((item, index) => {
                const isSelected = selectedIndex === index;
                const shortFormatted = getShortArticleFormat(item);
                const isAlreadyAdded = selectedArticles.some(
                  (a) => a.toLowerCase() === shortFormatted.toLowerCase()
                );

                return (
                  <div
                    key={`${item.code}-${index}`}
                    onClick={() => handleSelectSuggestion(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#1e2536] text-white'
                        : isAlreadyAdded
                        ? 'bg-[#161a24] text-[#e5c07b]'
                        : 'hover:bg-[#171c26] text-neutral-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-white tracking-wide">
                          {item.code}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border ${getBadgeStyle(
                            item.category
                          )}`}
                        >
                          {item.legislation}
                        </span>
                        {isAlreadyAdded && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                            <Check className="w-3 h-3" /> Adicionado
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-neutral-300 mt-0.5 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] font-mono text-[#e5c07b] font-semibold mt-1 flex items-center gap-1.5">
                        <span className="text-neutral-500 font-sans text-[10px]">Formato da Tag:</span>
                        <span className="bg-black/50 px-1.5 py-0.5 rounded border border-[#c69c59]/40">
                          {shortFormatted}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSuggestion(item);
                      }}
                      className="self-center px-2.5 py-1 rounded bg-[#1e2536] hover:bg-[#c69c59]/20 text-[#e5c07b] hover:text-white border border-[#c69c59]/50 text-[11px] font-mono whitespace-nowrap transition-colors"
                      title={`Adicionar ${shortFormatted}`}
                    >
                      {isAlreadyAdded ? 'Já adicionado' : '+ Adicionar'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
