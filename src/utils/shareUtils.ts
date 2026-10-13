import { SuspectRecord } from '../types';
import { extractSuspectPhotos, formatPhotoUrl } from './googleSheetsApi';
import { getMotherName, getBirthDate, getCleanAddress } from '../components/SuspectCard';

/**
 * Converte URLs ou data URIs em objetos File para anexo nativo no compartilhamento
 */
async function urlToFile(url: string, filename: string): Promise<File | null> {
  if (!url) return null;
  try {
    // 1. Caso Base64
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    }

    // 2. Tenta fetch direto via CORS
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const type = blob.type || 'image/jpeg';
        return new File([blob], filename, { type });
      }
    } catch {
      // Ignora erro e tenta fallback via Canvas
    }

    // 3. Fallback via Image + Canvas para contornar restrições de fetch do navegador
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });

      if (blob) {
        return new File([blob], filename, { type: 'image/jpeg' });
      }
    } catch {
      // Fallback falhou
    }

    return null;
  } catch (err) {
    console.warn(`Não foi possível converter foto em anexo (${filename}):`, err);
    return null;
  }
}

/**
 * Remove qualquer emoji, pictograma ou caractere decorativo Unicode do texto,
 * e remove asteriscos residuais para garantir que apenas as tags fiquem em negrito.
 */
export function stripEmojis(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(
      /[\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u2600-\u27BF\uFE0F\u200D\u20E3]/gu,
      ''
    )
    .replace(/\*/g, '')
    .trim();
}

/**
 * Gera o texto estruturado do registro militar para compartilhamento (100% sem emojis).
 * Somente as tags ficam em negrito (*TAG:*), enquanto os dados preenchidos permanecem em texto normal.
 */
export function buildSuspectShareText(suspect: SuspectRecord): string {
  const nome = stripEmojis(suspect.nome) || 'NÃO INFORMADO';
  const alcunha = stripEmojis(suspect.alcunha);
  const maeNome = stripEmojis(getMotherName(suspect));
  const dataNascimento = stripEmojis(getBirthDate(suspect));
  const rg = stripEmojis(suspect.rg);
  const cpf = stripEmojis(suspect.cpf);
  const enderecoLimpo = stripEmojis(getCleanAddress(suspect));
  const artigo = stripEmojis(suspect.artigo);
  const marcador = stripEmojis(suspect.marcador ? suspect.marcador.replace('_', ' ') : '');
  const local = stripEmojis(suspect.localAbordagem);
  const bpm = stripEmojis(suspect.bpm);
  const obs = stripEmojis(suspect.observacoes);

  const lines = [
    '*BANCO DE DADOS*',
    '*FICHA OPERACIONAL*',
    '',
    `*NOME:* ${nome}`,
  ];

  if (alcunha) {
    lines.push(`*ALCUNHA:* ${alcunha}`);
  }

  if (maeNome) {
    lines.push(`*MÃE:* ${maeNome}`);
  }

  if (rg) {
    lines.push(`*RG:* ${rg}`);
  }

  if (cpf) {
    lines.push(`*CPF:* ${cpf}`);
  }

  if (dataNascimento) {
    lines.push(`*NASCIMENTO:* ${dataNascimento}`);
  }

  if (enderecoLimpo) {
    lines.push(`*ENDEREÇO:* ${enderecoLimpo}`);
  }

  if (artigo) {
    lines.push(`*ARTIGO / CRIME:* ${artigo}`);
  }

  if (marcador) {
    lines.push(`*MARCADOR:* ${marcador}`);
  }

  if (local) {
    lines.push(`*LOCAL DA ABORDAGEM:* ${local}`);
  }

  if (bpm) {
    lines.push(`*BATALHÃO:* ${bpm}`);
  }

  if (obs) {
    lines.push(`*OBS:* ${obs}`);
  }

  return lines.join('\n');
}

/**
 * Rotina completa de compartilhamento anexando TODAS as fotos vinculadas ao card
 */
export async function shareSuspectWithAllPhotos(
  suspect: SuspectRecord
): Promise<{ success: boolean; message: string }> {
  const shareText = buildSuspectShareText(suspect);
  const photoUrls = extractSuspectPhotos(suspect);

  // 1. Tenta converter todas as fotos em arquivos para anexo
  const photoFiles: File[] = [];
  const safeName = (suspect.nome || 'abordado')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 20);

  for (let i = 0; i < photoUrls.length; i++) {
    const rawPhoto = photoUrls[i];
    const formatted = formatPhotoUrl(rawPhoto);
    const file = await urlToFile(formatted, `${safeName}_foto_${i + 1}.jpg`);
    if (file) {
      photoFiles.push(file);
    }
  }

  // 2. Se a API de compartilhamento nativa suporta envio com arquivos
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    photoFiles.length > 0
  ) {
    // 2a. Tenta compartilhar com todas as fotos
    if (navigator.canShare && navigator.canShare({ files: photoFiles })) {
      try {
        await navigator.share({
          title: `BANCO DE DADOS - ${suspect.nome}`,
          text: shareText,
          files: photoFiles,
        });
        return { success: true, message: 'Ficha e fotos compartilhadas com sucesso!' };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: true, message: 'Compartilhamento cancelado.' };
        }
        console.warn('Falha ao compartilhar com todas as fotos:', err);
      }
    }

    // 2b. Se falhar ou não suportar múltiplas fotos, tenta com a foto principal
    if (navigator.canShare && navigator.canShare({ files: [photoFiles[0]] })) {
      try {
        await navigator.share({
          title: `BANCO DE DADOS - ${suspect.nome}`,
          text: shareText,
          files: [photoFiles[0]],
        });
        return { success: true, message: 'Ficha e foto compartilhadas com sucesso!' };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: true, message: 'Compartilhamento cancelado.' };
        }
        console.warn('Falha ao compartilhar com foto principal:', err);
      }
    }
  }

  // 3. Se a API nativa suporta compartilhamento de texto simples
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `BANCO DE DADOS - ${suspect.nome}`,
        text: shareText,
      });
      return { success: true, message: 'Ficha compartilhada com sucesso!' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, message: 'Compartilhamento cancelado.' };
      }
      console.warn('Falha no navigator.share padrão:', err);
    }
  }

  // 4. Fallback: Copia ficha completa para a área de transferência
  try {
    await navigator.clipboard.writeText(shareText);
    return {
      success: true,
      message: 'Ficha copiada para a área de transferência! Cole no WhatsApp.',
    };
  } catch (clipErr) {
    console.error('Falha ao copiar:', clipErr);
    return {
      success: false,
      message: 'Não foi possível compartilhar automaticamente no seu dispositivo.',
    };
  }
}
