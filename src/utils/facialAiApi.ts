/**
 * Utilitário de Reconhecimento e Comparação Facial Tática por IA
 * BANCO DE DADOS OPERACIONAL - ULTRA-OTIMIZADO PARA DISPOSITIVOS MÓVEIS E REDES 5G/4G
 */

export type CompatibilidadeNivel = 'ALTA' | 'MODERADA' | 'BAIXA';

export interface FacialMatchResult {
  candidateId: string;
  candidateNome: string;
  candidateAlcunha?: string;
  candidateRg?: string;
  candidateFoto?: string;
  percentual: number; // 0 - 100
  nivel: CompatibilidadeNivel;
  resumoDiagnostico: string;
  pontosCoincidentes: string[];
  pontosDivergentes: string[];
  recomendacaoTatica: string;
  avisoResguardo: string;
}

export interface FacialComparisonResponse {
  status: 'success' | 'error';
  matches?: FacialMatchResult[];
  message?: string;
}

export interface CandidateForComparison {
  id: string;
  nome: string;
  alcunha?: string;
  rg?: string;
  photo: string;
}

/**
 * Comprime e redimensiona imagens para biometria forense ultra-leve (máx 512px, ~30-50KB)
 * Evita que o app envie payloads pesados pela rede 5G/4G, eliminando erros de timeout e quedas de conexão.
 */
export async function compressImageForBiometrics(
  source: string | File,
  maxDimension = 512,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    try {
      let srcUrl = '';
      let shouldRevoke = false;

      if (source instanceof File) {
        srcUrl = URL.createObjectURL(source);
        shouldRevoke = true;
      } else if (typeof source === 'string') {
        srcUrl = source;
      } else {
        return resolve('');
      }

      // Se for uma URL remota HTTP/HTTPS, mantém para resolução server-side direta
      if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))) {
        return resolve(source);
      }

      // Se for Base64 já leve (< 60KB), não gasta CPU no celular reprocessando
      if (typeof source === 'string' && source.startsWith('data:') && source.length < 80_000) {
        return resolve(source);
      }

      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            if (shouldRevoke) URL.revokeObjectURL(srcUrl);
            return resolve(typeof source === 'string' ? source : '');
          }

          // Fundo neutro preto para evitar distorções de alfa
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', quality);
          if (shouldRevoke) URL.revokeObjectURL(srcUrl);
          resolve(compressed);
        } catch {
          if (shouldRevoke) URL.revokeObjectURL(srcUrl);
          resolve(typeof source === 'string' ? source : '');
        }
      };

      img.onerror = () => {
        if (shouldRevoke) URL.revokeObjectURL(srcUrl);
        resolve(typeof source === 'string' ? source : '');
      };

      img.src = srcUrl;
    } catch {
      resolve(typeof source === 'string' ? source : '');
    }
  });
}

/**
 * Envia a foto capturada do abordado e os candidatos cadastrados para análise pelo Gemini Vision
 * Implementa compressão prévia no cliente, timeout adaptativo e auto-retry em conexões móveis 5G/4G.
 */
export async function compareFacesWithAI(
  targetPhotoBase64: string,
  candidates: CandidateForComparison[],
  onProgress?: (stage: string) => void,
  signal?: AbortSignal
): Promise<FacialComparisonResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      status: 'error',
      message: 'Dispositivo sem conexão de rede. Verifique seu sinal 5G ou Wi-Fi.',
    };
  }

  if (!targetPhotoBase64) {
    return {
      status: 'error',
      message: 'Foto do abordado não fornecida.',
    };
  }

  if (!candidates || candidates.length === 0) {
    return {
      status: 'error',
      message: 'Nenhum candidato selecionado para confronto.',
    };
  }

  const maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    if (signal?.aborted) {
      return { status: 'error', message: 'Operação cancelada pelo usuário.' };
    }

    try {
      if (onProgress) {
        if (attempt === 0) {
          onProgress('Otimizando fotos para envio ultraleve em 5G...');
        } else {
          onProgress(`Estabilizando sinal e reenviando (tentativa ${attempt + 1}/${maxRetries + 1})...`);
        }
      }

      // 1. Comprime a foto alvo para no máximo 512px (~35KB)
      let optimizedTarget = targetPhotoBase64;
      if (targetPhotoBase64.length > 80_000) {
        optimizedTarget = await compressImageForBiometrics(targetPhotoBase64, 512, 0.72);
      }

      // 2. Comprime fotos dos candidatos se forem Base64 locais grandes
      const optimizedCandidates = await Promise.all(
        candidates.map(async (c) => {
          let photoStr = c.photo || '';
          if (photoStr.startsWith('data:') && photoStr.length > 80_000) {
            photoStr = await compressImageForBiometrics(photoStr, 320, 0.70);
          }
          return {
            ...c,
            photo: photoStr,
          };
        })
      );

      if (onProgress) {
        onProgress('Enviando biometria leve ao servidor...');
      }

      // 3. Timeout adaptativo de 35 segundos para conexões móveis
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 35_000);

      const combinedSignal = signal || timeoutController.signal;

      const res = await fetch('/api/ai/facial-match', {
        method: 'POST',
        signal: combinedSignal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          targetPhoto: optimizedTarget,
          candidates: optimizedCandidates,
        }),
      });

      clearTimeout(timeoutId);

      if (onProgress) {
        onProgress('IA concluindo diagnóstico forense...');
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        // Se for erro temporário de servidor (502, 503, 504), tenta novamente
        if (res.status >= 500 && attempt < maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 800 * attempt));
          continue;
        }

        return {
          status: 'error',
          message: `Falha no servidor (${res.status}): ${errText || 'Tente novamente.'}`,
        };
      }

      const data = await res.json();
      return data;
    } catch (err: any) {
      console.warn(`[Facial AI Attempt ${attempt + 1} Failed]:`, err);

      if (signal?.aborted) {
        return { status: 'error', message: 'Varredura interrompida pelo usuário.' };
      }

      if (err.name === 'AbortError') {
        if (attempt < maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        return {
          status: 'error',
          message: 'Tempo limite na conexão 5G/4G. Verifique o sinal e tente novamente.',
        };
      }

      // Erro de conexão móvel passageiro (queda de sinal na rua)
      if (attempt < maxRetries) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      return {
        status: 'error',
        message:
          'Oscilação momentânea na rede 5G/4G. Sua foto está salva — toque em "Refazer" para reconectar.',
      };
    }
  }

  return {
    status: 'error',
    message: 'Não foi possível completar a verificação biométrica. Tente novamente.',
  };
}

/**
 * Varredura progressiva do banco completo em micro-lotes (8 por lote).
 * Permite varrer 100+ suspeitos com segurança total em redes móveis 5G/4G,
 * reportando progresso contínuo e ordenando todos os resultados por compatibilidade.
 */
export async function scanAllDatabaseProgressive(
  targetPhotoBase64: string,
  allCandidates: CandidateForComparison[],
  onProgressUpdate: (progress: {
    processedCount: number;
    totalCount: number;
    currentBatch: number;
    totalBatches: number;
    stageMessage: string;
    partialMatches: FacialMatchResult[];
  }) => void,
  abortSignal?: AbortSignal,
  batchSize = 8
): Promise<{ success: boolean; matches: FacialMatchResult[]; message?: string }> {
  if (!allCandidates || allCandidates.length === 0) {
    return { success: false, matches: [], message: 'Nenhum cadastro com foto para varredura.' };
  }

  const totalCount = allCandidates.length;
  const totalBatches = Math.ceil(totalCount / batchSize);
  const collectedMatches: FacialMatchResult[] = [];

  for (let bIndex = 0; bIndex < totalBatches; bIndex++) {
    if (abortSignal?.aborted) {
      break;
    }

    const start = bIndex * batchSize;
    const end = Math.min(start + batchSize, totalCount);
    const chunk = allCandidates.slice(start, end);

    const stageMsg = `Varrendo lote ${bIndex + 1} de ${totalBatches} (${start + 1} a ${end} de ${totalCount})...`;
    onProgressUpdate({
      processedCount: start,
      totalCount,
      currentBatch: bIndex + 1,
      totalBatches,
      stageMessage: stageMsg,
      partialMatches: [...collectedMatches],
    });

    const res = await compareFacesWithAI(
      targetPhotoBase64,
      chunk,
      (stage) => {
        onProgressUpdate({
          processedCount: start,
          totalCount,
          currentBatch: bIndex + 1,
          totalBatches,
          stageMessage: `[Lote ${bIndex + 1}/${totalBatches}] ${stage}`,
          partialMatches: [...collectedMatches],
        });
      },
      abortSignal
    );

    if (res.status === 'success' && Array.isArray(res.matches)) {
      collectedMatches.push(...res.matches);
      // Mantém sempre ordenado por maior percentual
      collectedMatches.sort((a, b) => b.percentual - a.percentual);

      onProgressUpdate({
        processedCount: end,
        totalCount,
        currentBatch: bIndex + 1,
        totalBatches,
        stageMessage: `Lote ${bIndex + 1} concluído. Maior compatibilidade atual: ${collectedMatches[0]?.percentual || 0}%`,
        partialMatches: [...collectedMatches],
      });

      // Se já encontrou um match com índice muito alto (>= 90%), avisa mas continua se não abortado
    } else {
      console.warn(`[Scan Progressive] Lote ${bIndex + 1} teve aviso:`, res.message);
    }

    // Pequeno intervalo de 350ms entre lotes para não sobrecarregar a conexão 5G
    await new Promise((r) => setTimeout(r, 350));
  }

  collectedMatches.sort((a, b) => b.percentual - a.percentual);

  return {
    success: true,
    matches: collectedMatches,
  };
}
