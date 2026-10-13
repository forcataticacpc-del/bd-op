import { formatCPF } from './textUtils';

export interface ExtractedSuspectData {
  nome: string;
  mae: string;
  rg: string;
  cpf: string;
  dataNasc?: string;
  alcunha?: string;
  endereco?: string;
  artigos?: string[];
  artigo?: string;
  observacoes?: string;
  marcador?: string;
  generoDetectado?: 'MASCULINO' | 'FEMININO';
  faceBoundingBox?: {
    ymin?: number;
    xmin?: number;
    ymax?: number;
    xmax?: number;
    hasPhoto?: boolean;
  };
  croppedPhoto?: string | null;
  originalPhoto?: string | null;
  sourceFileName?: string;
}

export interface AiExtractionResult {
  success: boolean;
  data?: ExtractedSuspectData;
  suspects?: ExtractedSuspectData[];
  message?: string;
}

export interface ProcessedAiCandidate extends ExtractedSuspectData {
  id: string; // identificador único temporário na fila
  status: 'pending' | 'reviewed' | 'saved' | 'discarded';
  sourceFileName: string;
  croppedPhoto?: string | null;
  originalPhoto?: string | null;
  availablePhotos: string[];
}

/**
 * Envia imagem ou documento em base64/texto para o endpoint local /api/ai/extract-suspect processado por Gemini 3.8 Flash
 */
export async function extractSuspectFromScreenshot(
  imageBase64?: string,
  mimeType: string = 'image/jpeg',
  attempt: number = 1,
  fileContent?: string,
  fileName?: string
): Promise<AiExtractionResult> {
  try {
    const response = await fetch('/api/ai/extract-suspect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        fileContent,
        fileName,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (result.status === 'success' && (result.data || result.suspects)) {
      let list: ExtractedSuspectData[] = [];
      if (Array.isArray(result.suspects) && result.suspects.length > 0) {
        list = result.suspects;
      } else if (Array.isArray(result.data)) {
        list = result.data;
      } else if (result.data) {
        list = [result.data];
      }

      return {
        success: true,
        data: list[0] || (result.data as ExtractedSuspectData),
        suspects: list,
      };
    }

    const errorMsg = result.message || `Erro de resposta (${response.status})`;

    // Em caso de pico momentâneo de demanda dos servidores de IA, efetua 1 nova tentativa transparente
    const isTransientDemand =
      errorMsg.includes('alta demanda') ||
      errorMsg.includes('503') ||
      errorMsg.includes('UNAVAILABLE') ||
      errorMsg.includes('high demand') ||
      errorMsg.includes('indisponível');

    if (attempt < 2 && isTransientDemand) {
      await new Promise((r) => setTimeout(r, 1500));
      return extractSuspectFromScreenshot(imageBase64, mimeType, attempt + 1, fileContent, fileName);
    }

    return {
      success: false,
      message: errorMsg || 'Não foi possível extrair dados do documento.',
    };
  } catch (error: any) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500));
      return extractSuspectFromScreenshot(imageBase64, mimeType, attempt + 1, fileContent, fileName);
    }
    return {
      success: false,
      message: error.message || 'Falha de conexão com o serviço de IA.',
    };
  }
}

/**
 * Extrai dados estruturados de suspeitos a partir de arquivos JSON de qualquer formato ou origem:
 * - Arrays de objetos: [ { nome, mae, rg, ... }, ... ]
 * - Objetos aninhados: { suspects: [...] }, { records: [...] }, { data: [...] }, etc.
 * - Fichas policiais ou notas do Google Keep (JSON com textContent / title)
 * - Tabelas exportadas do Google Sheets ou Excel em JSON
 * - Backups do Firebase Firestore ({ fields: { ... } } ou { documents: [...] })
 * - Objeto individual de suspeito
 */
export function parseSuspectsFromJson(
  rawJsonText: string,
  fileName: string = 'dados.json'
): AiExtractionResult {
  try {
    let text = rawJsonText.trim();
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const firstBrace = text.indexOf('{');
      const firstBracket = text.indexOf('[');
      const startIdx =
        firstBrace !== -1 && firstBracket !== -1
          ? Math.min(firstBrace, firstBracket)
          : firstBrace !== -1
          ? firstBrace
          : firstBracket;

      const lastBrace = text.lastIndexOf('}');
      const lastBracket = text.lastIndexOf(']');
      const endIdx = Math.max(lastBrace, lastBracket);

      if (startIdx !== -1 && endIdx > startIdx) {
        parsed = JSON.parse(text.substring(startIdx, endIdx + 1));
      } else {
        return { success: false, message: 'Estrutura JSON inválida.' };
      }
    }

    // Busca tolerante a maiúsculas, minúsculas, acentos e separadores
    const getField = (obj: any, ...aliases: string[]): any => {
      if (!obj || typeof obj !== 'object') return undefined;
      const keys = Object.keys(obj);
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[\s_–-]/g, '');
        const foundKey = keys.find((k) => k.toLowerCase().replace(/[\s_–-]/g, '') === cleanAlias);
        if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null && obj[foundKey] !== '') {
          return obj[foundKey];
        }
      }
      return undefined;
    };

    // Desempacota Firestore documents se presentes
    const unwrapFirestore = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (obj.stringValue !== undefined) return obj.stringValue;
      if (obj.integerValue !== undefined) return obj.integerValue;
      if (obj.arrayValue && Array.isArray(obj.arrayValue.values)) {
        return obj.arrayValue.values.map(unwrapFirestore);
      }
      if (obj.mapValue && obj.mapValue.fields) {
        return unwrapFirestore(obj.mapValue.fields);
      }
      if (obj.fields && typeof obj.fields === 'object') {
        const res: any = {};
        for (const [k, v] of Object.entries(obj.fields)) {
          res[k] = unwrapFirestore(v);
        }
        return res;
      }
      return obj;
    };

    // Parser textual policial para notas do Google Keep ou blocos de texto
    const parsePoliceTextRecord = (textContent: string, title?: string): ExtractedSuspectData | null => {
      if (!textContent || typeof textContent !== 'string') return null;

      const extractMatch = (patterns: RegExp[]): string => {
        for (const p of patterns) {
          const match = textContent.match(p);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        return '';
      };

      let nome = extractMatch([
        /(?:^|\n|\r)[*\s]*(?:NOME(?:\s*COMPLETO)?|ABORDADO|INDIV[IÍ]DUO|QUALIFICA[CÇ][AÃ]O|AUTOR)\s*[:\-–]\s*([^\n\r]+)/i,
        /(?:^|\n|\r)[*\s]*(?:NOME)\s*:\s*([^\n\r]+)/i,
      ]);

      let mae = extractMatch([
        /(?:^|\n|\r)[*\s]*(?:M[AÃ]E|NOME\s*DA\s*M[AÃ]E|FILIA[CÇ][AÃ]O(?:\s*MATERNA)?|GENITORA)\s*[:\-–]\s*([^\n\r]+)/i,
      ]);

      let rg = extractMatch([
        /(?:^|\n|\r)[*\s]*(?:RG|REGISTRO\s*GERAL|IDENTIDADE|CI)\s*[:\-–]\s*([^\n\r,]+)/i,
      ]);

      let cpf = extractMatch([
        /(?:^|\n|\r)[*\s]*(?:CPF)\s*[:\-–]\s*([^\n\r,]+)/i,
      ]);

      let dataNasc = extractMatch([
        /(?:^|\n|\r)[*\s]*(?:NASC(?:IMENTO)?|DATA\s*DE\s*NASC(?:IMENTO)?|DT\s*NASC|NASCIDO\s*EM)\s*[:\-–]\s*([^\n\r,]+)/i,
      ]);

      let alcunha = extractMatch([
        /(?:^|\n|\r)[*\s]*(?:ALCUNHA|VULGO|APELIDO)\s*[:\-–]\s*([^\n\r,]+)/i,
      ]);

      let endereco = extractMatch([
        /(?:^|\n|\r)[*\s]*(?:ENDERE[CÇ]O|RESID[EÊ]NCIA|LOGRADOURO|BAIRRO|LOCAL)\s*[:\-–]\s*([^\n\r]+)/i,
      ]);

      let artigo = extractMatch([
        /(?:^|\n|\r)[*\s]*(?:ARTIGO|ARTIGOS|ART\.?|CRIME(?:S)?|PASSAGENS?|DELITO)\s*[:\-–]\s*([^\n\r]+)/i,
      ]);

      if (!nome && title && title.trim().length > 3 && !title.toLowerCase().includes('keep') && !title.toLowerCase().includes('nota')) {
        nome = title.trim();
      }

      if (!nome && !rg && !cpf && !alcunha) {
        return null;
      }

      return {
        nome: nome.replace(/^["'*]+|["'*]+$/g, '').trim(),
        mae: mae.replace(/^["'*]+|["'*]+$/g, '').trim(),
        rg: rg.replace(/[^\d\w\-\.]/g, '').trim(),
        cpf: formatCPF(cpf),
        dataNasc: dataNasc.trim(),
        alcunha: alcunha.replace(/^["'*]+|["'*]+$/g, '').trim(),
        endereco: endereco.trim(),
        artigo: artigo.trim(),
        artigos: artigo ? [artigo.trim()] : [],
        observacoes: textContent.trim(),
        sourceFileName: fileName,
        faceBoundingBox: { hasPhoto: false },
      };
    };

    let rawItems: any[] = [];

    if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const candidateList = getField(
        parsed,
        'suspects',
        'records',
        'data',
        'items',
        'abordados',
        'cadastros',
        'fichas',
        'individuos',
        'pessoas',
        'results',
        'rows',
        'values',
        'elements',
        'lista',
        'documents',
        'notes'
      );

      if (Array.isArray(candidateList)) {
        rawItems = candidateList;
      } else {
        rawItems = [parsed];
      }
    }

    const suspects: ExtractedSuspectData[] = [];

    for (const rawItem of rawItems) {
      if (!rawItem) continue;
      const item = unwrapFirestore(rawItem);

      // 1. Nota do Google Keep ou formato textual
      const textContent = getField(item, 'textContent', 'text', 'body', 'content', 'description');
      const title = getField(item, 'title', 'titulo', 'name');

      if (textContent && typeof textContent === 'string' && textContent.length > 5) {
        const textRecord = parsePoliceTextRecord(textContent, typeof title === 'string' ? title : undefined);
        if (textRecord) {
          const attachments = getField(item, 'attachments', 'anexos', 'images');
          if (Array.isArray(attachments)) {
            for (const att of attachments) {
              const photoUrl = getField(att, 'url', 'photoUrl', 'src', 'data', 'filePath');
              if (photoUrl && typeof photoUrl === 'string') {
                textRecord.croppedPhoto = photoUrl;
                textRecord.faceBoundingBox = { hasPhoto: true };
                break;
              }
            }
          }
          suspects.push(textRecord);
          continue;
        }
      }

      // 2. Extração de objeto estruturado
      if (typeof item === 'object') {
        const nomeRaw = getField(
          item,
          'nome',
          'name',
          'nomeCompleto',
          'nome_completo',
          'NOME',
          'Nome',
          'abordado',
          'autor',
          'suspeito',
          'individuo',
          'pessoa',
          'full_name',
          'identificacao'
        );

        const maeRaw = getField(
          item,
          'mae',
          'mother',
          'motherName',
          'mother_name',
          'nomeMae',
          'nome_mae',
          'filiacao',
          'filiacaoMaterna',
          'genitora',
          'MAE',
          'Mãe',
          'mãe'
        );

        const rgRaw = getField(
          item,
          'rg',
          'RG',
          'registroGeral',
          'registro_geral',
          'identidade',
          'numRg',
          'num_rg',
          'numero_rg',
          'ci'
        );

        const cpfRaw = getField(item, 'cpf', 'CPF', 'numCpf', 'num_cpf', 'numero_cpf');

        const dataNascRaw = getField(
          item,
          'dataNasc',
          'data_nasc',
          'dataNascimento',
          'data_nascimento',
          'birthDate',
          'birth_date',
          'nascimento',
          'nasc',
          'DT_NASC',
          'DATA_NASC'
        );

        const alcunhaRaw = getField(
          item,
          'alcunha',
          'vulgo',
          'apelido',
          'nickname',
          'alias',
          'ALCUNHA',
          'VULGO',
          'Apelido'
        );

        const enderecoRaw = getField(
          item,
          'endereco',
          'endereço',
          'address',
          'bairro',
          'logradouro',
          'cidade',
          'residencia',
          'ENDERECO',
          'rua',
          'localizacao'
        );

        const artigoRaw = getField(
          item,
          'artigo',
          'artigos',
          'crimes',
          'crime',
          'passagens',
          'infracoes',
          'art',
          'enquadramento',
          'delito',
          'ARTIGO'
        );

        const observacoesRaw = getField(
          item,
          'observacoes',
          'observações',
          'obs',
          'historico',
          'notes',
          'observacao',
          'observação',
          'detalhes',
          'informacoes',
          'OBSERVACOES',
          'modusOperandi'
        );

        const marcadorRaw = getField(item, 'marcador', 'status', 'tag', 'alvo', 'MARCADOR');
        const generoRaw = getField(item, 'genero', 'generoDetectado', 'sexo', 'gender');

        const fotosRaw = getField(
          item,
          'fotos',
          'photos',
          'images',
          'foto',
          'photo',
          'fotoUrl',
          'photoUrl',
          'avatar',
          'imagem',
          'fotoBase64',
          'FOTO'
        );

        let primaryPhoto: string | null = null;
        if (Array.isArray(fotosRaw)) {
          const validPhotos = fotosRaw.filter((f) => typeof f === 'string' && f.length > 5);
          if (validPhotos.length > 0) primaryPhoto = validPhotos[0];
        } else if (typeof fotosRaw === 'string' && fotosRaw.length > 5) {
          primaryPhoto = fotosRaw;
        }

        const nome = typeof nomeRaw === 'string' ? nomeRaw.trim() : '';
        const alcunha = typeof alcunhaRaw === 'string' ? alcunhaRaw.trim() : '';
        const rg = typeof rgRaw === 'string' || typeof rgRaw === 'number' ? String(rgRaw).trim() : '';
        const cpf = typeof cpfRaw === 'string' || typeof cpfRaw === 'number' ? String(cpfRaw).trim() : '';

        if (nome || alcunha || rg || cpf) {
          const artigosList: string[] = Array.isArray(artigoRaw)
            ? artigoRaw.map(String)
            : typeof artigoRaw === 'string'
            ? artigoRaw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
            : [];

          const artigoString = typeof artigoRaw === 'string' ? artigoRaw : artigosList.join(', ');

          suspects.push({
            nome: nome || alcunha,
            mae: typeof maeRaw === 'string' ? maeRaw.trim() : '',
            rg,
            cpf: formatCPF(cpf),
            dataNasc: typeof dataNascRaw === 'string' ? dataNascRaw.trim() : '',
            alcunha,
            endereco: typeof enderecoRaw === 'string' ? enderecoRaw.trim() : '',
            artigo: artigoString,
            artigos: artigosList,
            observacoes: typeof observacoesRaw === 'string' ? observacoesRaw.trim() : '',
            marcador: typeof marcadorRaw === 'string' ? marcadorRaw.trim() : undefined,
            generoDetectado: generoRaw === 'FEMININO' || generoRaw === 'F' ? 'FEMININO' : 'MASCULINO',
            croppedPhoto: primaryPhoto,
            originalPhoto: primaryPhoto,
            sourceFileName: fileName,
            faceBoundingBox: primaryPhoto ? { hasPhoto: true } : { hasPhoto: false },
          });
        }
      }
    }

    if (suspects.length > 0) {
      return {
        success: true,
        suspects,
        data: suspects[0],
      };
    }

    return {
      success: false,
      message: 'Nenhum cadastro reconhecível encontrado dentro da estrutura JSON.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Falha ao interpretar arquivo JSON: ${err.message}`,
    };
  }
}

/**
 * Importa dados a partir de QUALQUER arquivo suportado individualmente:
 * JSON, HTML, XLSX, DOCX, PDF, bloco de notas (TXT), PPTX, CSV, Imagens, etc.
 */
export async function importSuspectFromAnyFile(file: File): Promise<AiExtractionResult & { croppedPhoto?: string | null }> {
  const fileName = file.name.toLowerCase();

  // 1. Arquivos de Imagem (JPEG, PNG, WEBP, etc.)
  if (file.type.startsWith('image/')) {
    const base64 = await readFileAsDataUrl(file);
    const result = await extractSuspectFromScreenshot(base64, file.type || 'image/jpeg', 1, undefined, file.name);
    if (result.success && result.data) {
      let cropped = await cropSuspectPhoto(base64, result.data.faceBoundingBox);
      if (!cropped && result.data.faceBoundingBox?.hasPhoto) {
        cropped = base64;
      }
      return { ...result, croppedPhoto: cropped };
    }
    return result;
  }

  // 2. Arquivos PDF
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    const base64 = await readFileAsDataUrl(file);
    const result = await extractSuspectFromScreenshot(base64, 'application/pdf', 1, undefined, file.name);
    return result;
  }

  // 3. Arquivos JSON (Processamento determinístico ultrarrápido com fallback para IA)
  if (fileName.endsWith('.json') || file.type === 'application/json') {
    const text = await readFileAsText(file);
    // Tenta primeiro o parser estruturado de alta precisão
    const directResult = parseSuspectsFromJson(text, file.name);
    if (directResult.success && directResult.suspects && directResult.suspects.length > 0) {
      return {
        ...directResult,
        croppedPhoto: directResult.data?.croppedPhoto || null,
      };
    }
    // Fallback: se o JSON não estiver nos padrões comuns, submete à IA Gemini
    return extractSuspectFromScreenshot(undefined, 'text/plain', 1, text, file.name);
  }

  // 4. Arquivos de Texto Direto (HTML, TXT, CSV)
  if (
    fileName.endsWith('.html') ||
    fileName.endsWith('.htm') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.csv') ||
    file.type.startsWith('text/')
  ) {
    const text = await readFileAsText(file);
    // Se o texto for JSON disfarçado de TXT, tenta parser
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      const jsonAttempt = parseSuspectsFromJson(text, file.name);
      if (jsonAttempt.success && jsonAttempt.suspects && jsonAttempt.suspects.length > 0) {
        return { ...jsonAttempt, croppedPhoto: jsonAttempt.data?.croppedPhoto || null };
      }
    }
    return extractSuspectFromScreenshot(undefined, 'text/plain', 1, text, file.name);
  }

  // 4. Arquivos Binários do Office (DOCX, XLSX, PPTX)
  if (
    fileName.endsWith('.docx') ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.pptx') ||
    fileName.endsWith('.doc') ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.ppt')
  ) {
    // Extrai sequências textuais legíveis do arquivo
    const extractedText = await extractReadableStringsFromBinary(file);
    if (extractedText && extractedText.length > 50) {
      return extractSuspectFromScreenshot(undefined, 'text/plain', 1, extractedText, file.name);
    }
    // Fallback: lê como base64
    const base64 = await readFileAsDataUrl(file);
    return extractSuspectFromScreenshot(base64, file.type || 'application/octet-stream', 1, undefined, file.name);
  }

  // 5. Fallback para qualquer outro tipo de arquivo: tenta como texto e depois como base64
  try {
    const text = await readFileAsText(file);
    if (text && text.trim().length > 10) {
      return extractSuspectFromScreenshot(undefined, 'text/plain', 1, text, file.name);
    }
  } catch {
    // continua para base64
  }

  const base64 = await readFileAsDataUrl(file);
  return extractSuspectFromScreenshot(base64, file.type || 'application/octet-stream', 1, undefined, file.name);
}

/**
 * IMPORTAÇÃO MÚLTIPLA COM IA:
 * Processa múltiplos arquivos selecionados pelo operador ou arquivos que contenham listas de indivíduos.
 * Notifica o progresso a cada etapa para fornecer feedback visual em tempo real.
 */
export async function importMultipleSuspectsFromFiles(
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{
  success: boolean;
  candidates: ProcessedAiCandidate[];
  message?: string;
}> {
  if (!files || files.length === 0) {
    return { success: false, candidates: [], message: 'Nenhum arquivo selecionado.' };
  }

  const candidates: ProcessedAiCandidate[] = [];
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress(i + 1, files.length, file.name);
    }

    try {
      if (file.type.startsWith('image/')) {
        const base64 = await readFileAsDataUrl(file);
        const result = await extractSuspectFromScreenshot(base64, file.type || 'image/jpeg', 1, undefined, file.name);

        if (result.success) {
          const list = result.suspects && result.suspects.length > 0 ? result.suspects : result.data ? [result.data] : [];
          for (let idx = 0; idx < list.length; idx++) {
            const item = list[idx];
            let cropped: string | null = null;
            if (item.faceBoundingBox) {
              cropped = await cropSuspectPhoto(base64, item.faceBoundingBox);
            }
            if (!cropped && item.faceBoundingBox?.hasPhoto) {
              cropped = base64;
            }

            const photos: string[] = [];
            if (cropped) photos.push(cropped);
            if (base64 && base64 !== cropped) photos.push(base64);

            candidates.push({
              ...item,
              id: `ai-queue-${Date.now()}-${i}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
              status: 'pending',
              sourceFileName: file.name,
              croppedPhoto: cropped,
              originalPhoto: base64,
              availablePhotos: photos,
            });
          }
        } else {
          errorCount++;
        }
      } else {
        const result = await importSuspectFromAnyFile(file);
        if (result.success) {
          const list = result.suspects && result.suspects.length > 0 ? result.suspects : result.data ? [result.data] : [];
          for (let idx = 0; idx < list.length; idx++) {
            const item = list[idx];
            // Preserva fotos contidas diretamente no registro do JSON ou no resultado
            const itemPhoto =
              item.croppedPhoto ||
              item.originalPhoto ||
              (item as any).foto ||
              (item as any).photoUrl ||
              (item as any).fotoUrl ||
              (Array.isArray((item as any).fotos) ? (item as any).fotos[0] : null) ||
              result.croppedPhoto ||
              null;

            const itemPhotos: string[] =
              Array.isArray((item as any).fotos) && (item as any).fotos.length > 0
                ? (item as any).fotos.filter((p: any) => typeof p === 'string' && p.length > 5)
                : itemPhoto
                ? [itemPhoto]
                : [];

            candidates.push({
              ...item,
              id: `ai-queue-${Date.now()}-${i}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
              status: 'pending',
              sourceFileName: file.name,
              croppedPhoto: itemPhoto,
              originalPhoto: item.originalPhoto || itemPhoto || null,
              availablePhotos: itemPhotos,
            });
          }
        } else {
          errorCount++;
        }
      }
    } catch (err) {
      console.error(`Erro ao analisar arquivo ${file.name}:`, err);
      errorCount++;
    }
  }

  if (candidates.length === 0) {
    return {
      success: false,
      candidates: [],
      message: 'Nenhum cadastro de abordado pôde ser identificado nos arquivos enviados.',
    };
  }

  return {
    success: true,
    candidates,
    message: `${candidates.length} ${candidates.length === 1 ? 'registro identificado' : 'registros identificados'} pela IA!`,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

/**
 * Extrai cadeias de caracteres UTF-8 e ASCII legíveis de arquivos compactados/binários como DOCX, XLSX e PPTX
 */
async function extractReadableStringsFromBinary(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const uint8 = new Uint8Array(buffer);
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const rawText = decoder.decode(uint8);

        // Remove sequências binárias pesadas mantendo palavras com acentos e números
        const matches = rawText.match(/[a-zA-Z0-9À-ÿ\s,.:;\-\/()]{4,}/g);
        if (matches) {
          resolve(matches.join(' ').slice(0, 50000));
        } else {
          resolve('');
        }
      } catch {
        resolve('');
      }
    };
    reader.onerror = () => resolve('');
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Recorta a foto do rosto/busto do abordado a partir do print completo utilizando
 * as coordenadas da bounding box [0-1000] calculadas pelo modelo Gemini.
 * Retorna null se não houver foto de rosto detectada ou se as coordenadas forem inválidas.
 */
export function cropSuspectPhoto(
  sourceImageBase64: string,
  box?: { ymin?: number; xmin?: number; ymax?: number; xmax?: number; hasPhoto?: boolean }
): Promise<string | null> {
  return new Promise((resolve) => {
    // Se a IA informou que não há foto no print ou coordenadas ausentes/inválidas
    if (
      !box ||
      box.hasPhoto === false ||
      box.ymin === undefined ||
      box.xmin === undefined ||
      box.ymax === undefined ||
      box.xmax === undefined
    ) {
      resolve(null);
      return;
    }

    const { ymin, xmin, ymax, xmax } = box;

    // Validação mínima de área (deve ter pelo menos 40x40 unidades em escala 0-1000)
    if (ymax <= ymin || xmax <= xmin || ymax - ymin < 40 || xmax - xmin < 40) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        if (!origW || !origH) {
          resolve(null);
          return;
        }

        // Converte escala normalizada [0, 1000] para pixels reais da imagem original
        const rawY = (ymin / 1000) * origH;
        const rawX = (xmin / 1000) * origW;
        const rawH = ((ymax - ymin) / 1000) * origH;
        const rawW = ((xmax - xmin) / 1000) * origW;

        // Se a imagem inteira já for a foto (ex: foto direta da câmera ou galeria)
        if (ymin <= 10 && xmin <= 10 && ymax >= 990 && xmax >= 990) {
          resolve(sourceImageBase64);
          return;
        }

        // Recorte preciso da área delimitada da fotografia inserida no print (exclui status bar, menus e textos inferiores)
        const cropX = Math.max(0, Math.floor(rawX));
        const cropY = Math.max(0, Math.floor(rawY));
        const cropW = Math.min(origW - cropX, Math.ceil(rawW));
        const cropH = Math.min(origH - cropY, Math.ceil(rawH));

        if (cropW < 20 || cropH < 20) {
          resolve(null);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cropW, cropH);
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // Gera JPEG com 92% de qualidade para clareza e fidelidade
        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(croppedDataUrl);
      } catch (err) {
        console.warn('Falha no recorte automático da face:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = sourceImageBase64;
  });
}
