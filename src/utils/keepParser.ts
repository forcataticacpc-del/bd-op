export interface ParsedKeepNote {
  id: string;
  title: string;
  content: string;
  labels?: string[];
  color?: string;
  updatedAt: string;
  photoUrl?: string;
}

/**
 * Faz o parsing de arquivos exportados do Google Keep (HTML, JSON ou TXT do Takeout)
 */
export async function parseKeepFiles(files: FileList | File[]): Promise<ParsedKeepNote[]> {
  const notes: ParsedKeepNote[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = file.name.toLowerCase();

    try {
      if (name.endsWith('.html') || name.endsWith('.htm')) {
        const text = await file.text();
        const parsed = parseKeepHtml(text, file.name);
        if (parsed) notes.push(parsed);
      } else if (name.endsWith('.json')) {
        const text = await file.text();
        const parsed = parseKeepJson(text, file.name);
        if (parsed) notes.push(parsed);
      } else if (name.endsWith('.txt')) {
        const text = await file.text();
        const parsed = parseKeepTxt(text, file.name);
        if (parsed) notes.push(parsed);
      } else if (file.type.startsWith('image/')) {
        const dataUrl = await fileToDataUrl(file);
        notes.push({
          id: `keep-photo-${Date.now()}-${i}`,
          title: file.name.replace(/\.[^/.]+$/, '').toUpperCase(),
          content: 'Foto/Print importado do Google Keep para leitura pela IA.',
          photoUrl: dataUrl,
          updatedAt: new Date(file.lastModified || Date.now()).toISOString(),
          color: '#202124',
          labels: ['Print / Foto Keep'],
        });
      }
    } catch (err) {
      console.warn(`Erro ao fazer parsing de ${file.name}:`, err);
    }
  }

  return notes;
}

export function parseKeepHtml(htmlString: string, fileName: string): ParsedKeepNote | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Título
    let title = '';
    const titleEl = doc.querySelector('.title, .heading, h1, h2, title');
    if (titleEl && titleEl.textContent?.trim()) {
      title = titleEl.textContent.trim();
    } else {
      title = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    }

    // Conteúdo / Texto
    let content = '';
    const contentEl = doc.querySelector('.content, .text, .body, .content-container');
    if (contentEl) {
      content = contentEl.textContent?.trim() || '';
    } else {
      // Pega todos os parágrafos ou div
      const paras = Array.from(doc.querySelectorAll('p, div.chip, li'))
        .map((p) => p.textContent?.trim())
        .filter(Boolean);
      content = paras.join('\n');
      if (!content) {
        content = doc.body.textContent?.trim() || '';
      }
    }

    // Labels/Tags
    const labels: string[] = [];
    doc.querySelectorAll('.label, .chip, .tag').forEach((el) => {
      const txt = el.textContent?.trim();
      if (txt) labels.push(txt);
    });

    // Imagem anexada (se presente inline base64)
    let photoUrl: string | undefined = undefined;
    const imgEl = doc.querySelector('img');
    if (imgEl && imgEl.src && imgEl.src.startsWith('data:')) {
      photoUrl = imgEl.src;
    }

    return {
      id: `keep-html-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title || 'Nota do Google Keep',
      content: content || 'Sem conteúdo de texto',
      labels: labels.length > 0 ? labels : ['Google Keep'],
      photoUrl,
      updatedAt: new Date().toISOString(),
      color: '#202124',
    };
  } catch (err) {
    console.error('Falha ao processar HTML do Keep:', err);
    return null;
  }
}

export function parseKeepJson(jsonString: string, fileName: string): ParsedKeepNote | null {
  try {
    const data = JSON.parse(jsonString);

    let title = data.title || fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    let content = data.textContent || data.text || '';

    // Se for formato com annotations ou listContent
    if (!content && Array.isArray(data.listContent)) {
      content = data.listContent
        .map((item: any) => (item.isChecked ? `[X] ${item.text}` : `[ ] ${item.text}`))
        .join('\n');
    }

    const labels: string[] = [];
    if (Array.isArray(data.labels)) {
      data.labels.forEach((l: any) => {
        if (typeof l === 'string') labels.push(l);
        else if (l && l.name) labels.push(l.name);
      });
    }

    let updatedAt = new Date().toISOString();
    if (data.userEditedTimestampUsec) {
      updatedAt = new Date(Number(data.userEditedTimestampUsec) / 1000).toISOString();
    }

    return {
      id: `keep-json-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title || 'Nota do Keep',
      content: content || '',
      labels: labels.length > 0 ? labels : ['Keep JSON'],
      updatedAt,
      color: '#202124',
    };
  } catch (err) {
    console.error('Falha ao processar JSON do Keep:', err);
    return null;
  }
}

export function parseKeepTxt(txtString: string, fileName: string): ParsedKeepNote {
  const lines = txtString.split('\n').map((l) => l.trim());
  let title = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
  let content = txtString;

  if (lines.length > 1 && lines[0].length > 0 && lines[0].length < 80) {
    title = lines[0];
    content = lines.slice(1).join('\n').trim();
  }

  return {
    id: `keep-txt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    content,
    updatedAt: new Date().toISOString(),
    color: '#202124',
    labels: ['Nota de Texto'],
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
