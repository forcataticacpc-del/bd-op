import jsPDF from 'jspdf';
import { OrcrimRecord, OrcrimMembro } from '../types';

export interface OrcrimPdfOptions {
  nome: boolean;
  mae: boolean;
  dataNascimento: boolean;
  rg: boolean;
  cpf: boolean;
  endereco: boolean;
  alcunha: boolean;
  observacoes: boolean;
}

export const DEFAULT_PDF_OPTIONS: OrcrimPdfOptions = {
  nome: true,
  mae: true,
  dataNascimento: true,
  rg: true,
  cpf: true,
  endereco: true,
  alcunha: true,
  observacoes: true,
};

/**
 * Desenha uma imagem preservando rigorosamente a proporção natural (object-fit: cover)
 * sem achatar ou deformar o rosto do abordado
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  if (!imgW || !imgH) {
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }
  const imgAspect = imgW / imgH;
  const destAspect = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = imgW;
  let sh = imgH;

  if (imgAspect > destAspect) {
    // Imagem mais larga que o container: recorta as laterais centralizadas
    sw = imgH * destAspect;
    sx = (imgW - sw) / 2;
  } else {
    // Imagem mais alta que o container: recorta topo/base focando no enquadramento do rosto
    sh = imgW / destAspect;
    sy = Math.max(0, (imgH - sh) * 0.18);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

/**
 * Converte uma imagem para Base64 preservando rigorosamente o enquadramento (object-fit: cover)
 * sem achatar ou esticar fotos dos integrantes.
 */
async function getBase64ImageFromUrl(
  url: string,
  targetAspect?: number
): Promise<string | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        if (!imgW || !imgH) {
          resolve(url.startsWith('data:image/') ? url : null);
          return;
        }

        const canvas = document.createElement('canvas');
        if (targetAspect && targetAspect > 0) {
          const imgAspect = imgW / imgH;
          let sx = 0;
          let sy = 0;
          let sw = imgW;
          let sh = imgH;

          if (imgAspect > targetAspect) {
            sw = imgH * targetAspect;
            sx = (imgW - sw) / 2;
          } else {
            sh = imgW / targetAspect;
            sy = Math.max(0, (imgH - sh) * 0.15); // centraliza no terço superior do rosto
          }

          canvas.width = 400;
          canvas.height = Math.round(400 / targetAspect);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
            return;
          }
        } else {
          canvas.width = imgW;
          canvas.height = imgH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
            return;
          }
        }
      } catch (e) {
        console.warn('Canvas export failed:', e);
      }
      resolve(url.startsWith('data:image/') ? url : null);
    };
    img.onerror = () => resolve(url.startsWith('data:image/') ? url : null);
    img.src = url;
  });
}

function loadImageElement(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Gera PDF da Ficha de ORCRIM com seleção de campos
 */
export async function generateOrcrimPdf(
  orcrim: OrcrimRecord,
  options: OrcrimPdfOptions = DEFAULT_PDF_OPTIONS
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 14;

  // Header Tático
  doc.setFillColor(15, 20, 30);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Faixa Dourada
  doc.setFillColor(198, 156, 89);
  doc.rect(0, 27, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BANCO DE DADOS OPERACIONAL - INTELIGÊNCIA', 14, 11);

  doc.setFontSize(9);
  doc.setTextColor(198, 156, 89);
  doc.text(`RELATÓRIO TÁTICO DE ORGANIZAÇÃO CRIMINOSA / FACÇÃO: ${orcrim.sigla}`, 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 24);

  y = 35;

  // Símbolo da ORCRIM se houver
  if (orcrim.fotoSimbolo) {
    try {
      const simboloBase64 = await getBase64ImageFromUrl(orcrim.fotoSimbolo);
      if (simboloBase64) {
        doc.addImage(simboloBase64, 'JPEG', pageWidth - 36, 6, 22, 19);
      }
    } catch (_) {}
  }

  // Dados Gerais da Facção
  doc.setFillColor(245, 246, 248);
  doc.roundedRect(12, y, pageWidth - 24, 30, 2, 2, 'F');
  doc.setDrawColor(210, 215, 225);
  doc.roundedRect(12, y, pageWidth - 24, 30, 2, 2, 'D');

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${orcrim.nome} (${orcrim.sigla})`, 16, y + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);

  const statusText = `Status: ${orcrim.status} | Periculosidade: ${orcrim.periculosidade}`;
  doc.text(statusText, 16, y + 13);

  const origemText = `Origem: ${orcrim.origem || 'Não informada'} | Fundação: ${orcrim.dataSurgimento || 'N/A'}`;
  doc.text(origemText, 16, y + 18);

  const liderText = `Liderança Geral: ${orcrim.liderPrincipal || 'Não identificada'}`;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 50, 50);
  doc.text(liderText, 16, y + 24);

  y += 36;

  // Territórios
  if (orcrim.territorios && orcrim.territorios.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 20, 30);
    doc.text('Territórios Mapeados:', 14, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const terrStr = orcrim.territorios.join(', ');
    const splitTerr = doc.splitTextToSize(terrStr, pageWidth - 28);
    doc.text(splitTerr, 14, y + 5);
    y += 7 + splitTerr.length * 4;
  }

  // Observações
  if (orcrim.observacoes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 20, 30);
    doc.text('Observações de Inteligência:', 14, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const splitObs = doc.splitTextToSize(orcrim.observacoes, pageWidth - 28);
    doc.text(splitObs, 14, y + 5);
    y += 7 + splitObs.length * 4;
  }

  y += 4;

  // Integrantes Mapeados
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 20, 30);
  doc.text(`INTEGRANTES E COMPARSA VINCULADOS (${orcrim.membros?.length || 0}):`, 14, y);
  y += 7;

  if (orcrim.membros && orcrim.membros.length > 0) {
    for (let i = 0; i < orcrim.membros.length; i++) {
      const membro = orcrim.membros[i];

      if (y > pageHeight - 45) {
        doc.addPage();
        y = 20;
      }

      const itemHeight = 36;
      doc.setFillColor(250, 250, 252);
      doc.roundedRect(12, y, pageWidth - 24, itemHeight, 1.5, 1.5, 'F');
      doc.setDrawColor(220, 225, 230);
      doc.roundedRect(12, y, pageWidth - 24, itemHeight, 1.5, 1.5, 'D');

      let hasPhoto = false;
      if (membro.foto) {
        try {
          const photoBase64 = await getBase64ImageFromUrl(membro.foto, 23 / 30);
          if (photoBase64) {
            doc.addImage(photoBase64, 'JPEG', 15, y + 3, 23, 30);
            hasPhoto = true;
          }
        } catch (_) {}
      }

      if (!hasPhoto) {
        doc.setFillColor(230, 232, 238);
        doc.rect(15, y + 3, 23, 30, 'F');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text('SEM FOTO', 18, y + 18);
      }

      const textX = 42;
      let textY = y + 7;

      if (options.nome) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 20);
        doc.text(membro.nome || 'NÃO INFORMADO', textX, textY);
        textY += 5;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 130, 50);
      const funcaoLabel = membro.funcaoPersonalizada || membro.funcao.replace('_', ' ');
      doc.text(`FUNÇÃO: ${funcaoLabel}`, textX, textY);
      textY += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);

      const docsParts: string[] = [];
      if (options.rg && membro.rg) docsParts.push(`RG: ${membro.rg}`);
      if (options.cpf && membro.cpf) docsParts.push(`CPF: ${membro.cpf}`);
      if (options.alcunha && membro.alcunha) docsParts.push(`Vulgo: ${membro.alcunha}`);

      if (docsParts.length > 0) {
        doc.text(docsParts.join(' | '), textX, textY);
        textY += 4.5;
      }

      if (options.observacoes && membro.observacoes) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        const splitMembroObs = doc.splitTextToSize(`Obs: ${membro.observacoes}`, pageWidth - textX - 16);
        doc.text(splitMembroObs.slice(0, 2), textX, textY);
      }

      y += itemHeight + 4;
    }
  }

  const filename = `ficha-orcrim-${orcrim.sigla.toLowerCase()}-${Date.now()}.pdf`;
  doc.save(filename);
}

/**
 * Constrói o Canvas em alta resolução do Organograma Tático exatamente no padrão visual da Imagem 1
 */
async function renderOrganogramaCanvas(orcrim: OrcrimRecord): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const width = 1600;
  const height = 1150;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D');

  // Fundo branco do papel com cantos arredondados e borda preta
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // HEADER TÁTICO (conforme imagem 1)
  // Esquerda: BANCO DE DADOS OPERACIONAL
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BANCO DE DADOS OPERACIONAL', 50, 70);

  // Centro: ORGANOGRAMA / ORCRIM A
  ctx.textAlign = 'center';
  ctx.font = '900 24px Arial, sans-serif';
  ctx.fillText('ORGANOGRAMA', width / 2, 60);
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillStyle = '#b45309';
  ctx.fillText(`${orcrim.nome || orcrim.sigla}`, width / 2, 90);

  // Direita: Data e Hora
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'right';
  const now = new Date();
  const dateStr = `Data: ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  ctx.fillText(dateStr, width - 50, 70);

  // Linha divisória sutil sob o cabeçalho
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, 115);
  ctx.lineTo(width - 35, 115);
  ctx.stroke();

  // Membros organizados em 3 níveis hierárquicos
  const cúpula = (orcrim.membros || []).filter(
    (m) => m.funcao === 'LIDER_GERAL' || m.funcao === 'SUB_LIDER'
  );
  const gerentes = (orcrim.membros || []).filter(
    (m) => m.funcao === 'GERENTE_FRENTE' || m.funcao === 'DISCIPLINA' || m.funcao === 'ARMEIRO_LOGISTICA'
  );
  const operacionais = (orcrim.membros || []).filter(
    (m) => m.funcao === 'OPERACIONAL_SOLDADO' || m.funcao === 'CONTATO_APOIO' || m.funcao === 'OUTRO'
  );

  // Fallback se não estiver dividido
  let tier1 = cúpula;
  let tier2 = gerentes;
  let tier3 = operacionais;

  if (tier1.length === 0 && (orcrim.membros || []).length > 0) {
    tier1 = [orcrim.membros[0]];
    tier2 = orcrim.membros.slice(1, 3);
    tier3 = orcrim.membros.slice(3, 8);
  }

  // Se ainda estiver vazio, cria nó ilustrativo com líder principal
  if (tier1.length === 0) {
    tier1 = [
      {
        id: 'lider-mock',
        suspectId: '',
        nome: orcrim.liderPrincipal || 'LIDER GERAL',
        funcao: 'LIDER_GERAL',
        funcaoPersonalizada: 'Gerente Geral',
        dataVinculo: '',
        status: 'ATIVO',
      },
    ];
  }

  const cardW = 190;
  const cardH = 200;

  // Posições dos Níveis
  const yTier1 = 150;
  const yTier2 = 450;
  const yTier3 = 750;

  // Pré-carrega fotos dos integrantes
  const loadedImages: Record<string, HTMLImageElement | null> = {};
  for (const m of [...tier1, ...tier2, ...tier3]) {
    if (m.foto) {
      loadedImages[m.id] = await loadImageElement(m.foto);
    }
  }

  // Função auxiliar para desenhar um card individual exatamente no padrão da Imagem 1
  const drawMemberCard = (m: OrcrimMembro, cx: number, cy: number, isLeader: boolean) => {
    const x = cx - cardW / 2;
    const y = cy;

    // Card frame com borda preta
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;

    // Moldura da foto
    const photoW = 130;
    const photoH = 120;
    const photoX = cx - photoW / 2;
    const photoY = y;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.strokeStyle = '#0f172a';
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    // Foto ou Avatar com adaptação automática para não achatar
    const img = loadedImages[m.id];
    if (img) {
      drawImageCover(ctx, img, photoX, photoY, photoW, photoH);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('FOTO', cx, photoY + 65);
    }

    // Caixa de Nome Preta abaixo da foto
    const nameBoxY = photoY + photoH;
    const nameBoxH = 34;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, nameBoxY, cardW, nameBoxH);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    const truncatedNome = m.nome.length > 20 ? m.nome.substring(0, 18) + '...' : m.nome;
    ctx.fillText(truncatedNome.toUpperCase(), cx, nameBoxY + 18);

    if (m.rg || m.cpf) {
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.fillStyle = '#94a3b8';
      const docStr = [m.rg ? `RG: ${m.rg}` : '', m.cpf ? `CPF: ${m.cpf}` : ''].filter(Boolean).join(' ');
      ctx.fillText(docStr, cx, nameBoxY + 30);
    }

    // Pill de Função abaixo do nome (Amarelo para lideres/gerentes, Cinza para outros)
    const pillY = nameBoxY + nameBoxH + 4;
    const pillH = 24;
    const pillW = cardW - 10;
    const pillX = cx - pillW / 2;

    const funcText = m.funcaoPersonalizada || (m.funcao === 'LIDER_GERAL' ? 'Gerente Geral' : m.funcao === 'GERENTE_FRENTE' ? 'Gerente' : m.funcao.replace('_', ' '));

    if (isLeader || m.funcao === 'LIDER_GERAL' || m.funcao === 'SUB_LIDER' || m.funcao === 'GERENTE_FRENTE') {
      ctx.fillStyle = '#fbbf24'; // Amarelo conforme imagem 1
      ctx.strokeStyle = '#d97706';
    } else {
      ctx.fillStyle = '#cbd5e1'; // Cinza conforme imagem 1
      ctx.strokeStyle = '#94a3b8';
    }

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText(funcText, cx, pillY + 16);
  };

  // Coordenadas calculadas para conectar com linhas da árvore
  const posTier1: Array<{ x: number; y: number }> = [];
  const posTier2: Array<{ x: number; y: number }> = [];
  const posTier3: Array<{ x: number; y: number }> = [];

  // 1. Renderiza Nível 1 (Cúpula)
  const t1Count = tier1.length;
  tier1.forEach((m, idx) => {
    const cx = width / 2 + (idx - (t1Count - 1) / 2) * (cardW + 80);
    posTier1.push({ x: cx, y: yTier1 });
    drawMemberCard(m, cx, yTier1, true);
  });

  // 2. Renderiza Nível 2 (Gerentes)
  const t2Count = Math.max(1, tier2.length);
  tier2.forEach((m, idx) => {
    const cx = width / 2 + (idx - (t2Count - 1) / 2) * (cardW + 120);
    posTier2.push({ x: cx, y: yTier2 });
    drawMemberCard(m, cx, yTier2, idx === 0);
  });

  // 3. Renderiza Nível 3 (Operacionais/Apoio)
  const t3Count = Math.max(1, tier3.length);
  tier3.forEach((m, idx) => {
    const cx = width / 2 + (idx - (t3Count - 1) / 2) * (cardW + 50);
    posTier3.push({ x: cx, y: yTier3 });
    drawMemberCard(m, cx, yTier3, false);
  });

  // LINHAS DE CONEXÃO DA HIERARQUIA (Linhas pretas em ângulo reto conforme Imagem 1)
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;

  // Conexão Nível 1 -> Nível 2
  if (posTier1.length > 0 && posTier2.length > 0) {
    const t1BottomY = yTier1 + cardH - 10;
    const midY1 = (t1BottomY + yTier2) / 2;

    // Linha vertical descendo do centro do Nível 1
    const p1CenterX = posTier1.reduce((acc, p) => acc + p.x, 0) / posTier1.length;
    ctx.beginPath();
    ctx.moveTo(p1CenterX, t1BottomY);
    ctx.lineTo(p1CenterX, midY1);
    ctx.stroke();

    // Barra horizontal conectando todos do Nível 2
    const minX2 = Math.min(...posTier2.map((p) => p.x));
    const maxX2 = Math.max(...posTier2.map((p) => p.x));
    ctx.beginPath();
    ctx.moveTo(minX2, midY1);
    ctx.lineTo(maxX2, midY1);
    ctx.stroke();

    // Linhas verticais descendo até o topo de cada card do Nível 2
    posTier2.forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p.x, midY1);
      ctx.lineTo(p.x, yTier2);
      ctx.stroke();
    });
  }

  // Conexão Nível 2 -> Nível 3
  if (posTier2.length > 0 && posTier3.length > 0) {
    const t2BottomY = yTier2 + cardH - 10;
    const midY2 = (t2BottomY + yTier3) / 2;

    const p2CenterX = posTier2.reduce((acc, p) => acc + p.x, 0) / posTier2.length;
    ctx.beginPath();
    ctx.moveTo(p2CenterX, t2BottomY);
    ctx.lineTo(p2CenterX, midY2);
    ctx.stroke();

    const minX3 = Math.min(...posTier3.map((p) => p.x));
    const maxX3 = Math.max(...posTier3.map((p) => p.x));
    ctx.beginPath();
    ctx.moveTo(minX3, midY2);
    ctx.lineTo(maxX3, midY2);
    ctx.stroke();

    posTier3.forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p.x, midY2);
      ctx.lineTo(p.x, yTier3);
      ctx.stroke();
    });
  }

  // FOOTER (conforme imagem 1)
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, height - 70);
  ctx.lineTo(width - 35, height - 70);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BANCO DE DADOS OPERACIONAL', 50, height - 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#4b5563';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText('Página 1 de 1', width - 50, height - 40);

  return canvas;
}

/**
 * Exporta o Organograma como Imagem (PNG) conforme solicitado pelo usuário
 */
export async function exportOrganogramaAsImage(orcrim: OrcrimRecord): Promise<void> {
  const canvas = await renderOrganogramaCanvas(orcrim);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  const link = document.createElement('a');
  link.download = `organograma-${orcrim.sigla.toLowerCase()}-${Date.now()}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Gera PDF do Organograma Hierárquico Tático reproduzindo fielmente o modelo da Imagem 1
 */
export async function generateOrganogramaPdf(orcrim: OrcrimRecord): Promise<void> {
  const canvas = await renderOrganogramaCanvas(orcrim);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const imgRatio = canvas.width / canvas.height;
  const pageRatio = pageWidth / pageHeight;
  let renderW = pageWidth;
  let renderH = pageHeight;
  let renderX = 0;
  let renderY = 0;

  if (imgRatio > pageRatio) {
    renderW = pageWidth;
    renderH = pageWidth / imgRatio;
    renderY = (pageHeight - renderH) / 2;
  } else {
    renderH = pageHeight;
    renderW = pageHeight * imgRatio;
    renderX = (pageWidth - renderW) / 2;
  }

  doc.addImage(imgData, 'JPEG', renderX, renderY, renderW, renderH);

  const filename = `organograma-${orcrim.sigla.toLowerCase()}-${Date.now()}.pdf`;
  doc.save(filename);
}
