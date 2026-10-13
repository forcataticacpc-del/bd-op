const fs = require('fs');
const path = require('path');

const targetFiles = [
  // Raiz & Servidor
  { category: 'Cloudflare Backend (Opção A)', path: 'cloudflare-worker/src/index.ts' },
  { category: 'Cloudflare Backend (Opção A)', path: 'cloudflare-worker/schema.sql' },
  { category: 'Cloudflare Backend (Opção A)', path: 'cloudflare-worker/wrangler.toml' },
  { category: 'Cloudflare Backend (Opção A)', path: 'cloudflare-worker/README.md' },
  { category: 'Servidor & Configuração', path: 'server.ts' },
  { category: 'Servidor & Configuração', path: 'package.json' },
  { category: 'Servidor & Configuração', path: 'vite.config.ts' },
  { category: 'Servidor & Configuração', path: 'tsconfig.json' },
  { category: 'Servidor & Configuração', path: 'index.html' },
  { category: 'Servidor & Configuração', path: 'scripts/pack_app.py' },
  { category: 'Servidor & Configuração', path: 'colab_registro_abordagem.py' },

  // Núcleo
  { category: 'Núcleo da Aplicação', path: 'src/main.tsx' },
  { category: 'Núcleo da Aplicação', path: 'src/App.tsx' },
  { category: 'Núcleo da Aplicação', path: 'src/types.ts' },
  { category: 'Núcleo da Aplicação', path: 'src/index.css' },

  // Componentes
  { category: 'Componentes UI', path: 'src/components/SuspectCard.tsx' },
  { category: 'Componentes UI', path: 'src/components/DetailModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/RecordFormModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/CloudflareModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/MobileBottomNav.tsx' },
  { category: 'Componentes UI', path: 'src/components/WebCommandBar.tsx' },
  { category: 'Componentes UI', path: 'src/components/ParserModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/AiMultiReviewModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/Header.tsx' },
  { category: 'Componentes UI', path: 'src/components/SearchBar.tsx' },
  { category: 'Componentes UI', path: 'src/components/FilterModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/SettingsModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/GoogleSheetsModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/GoogleKeepBrowserModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/GoogleDriveBrowserModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/SecurityModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/DeleteAuthModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/PWAInstallBanner.tsx' },
  { category: 'Componentes UI', path: 'src/components/PWAInstallModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/ArticleAutocomplete.tsx' },
  { category: 'Componentes UI', path: 'src/components/PullToRefresh.tsx' },
  { category: 'Componentes UI', path: 'src/components/FloatingActionButton.tsx' },
  { category: 'Componentes UI', path: 'src/components/NavigationModuleBar.tsx' },
  { category: 'Componentes UI', path: 'src/components/OrcrimModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/OrcrimEnderecosTab.tsx' },
  { category: 'Componentes UI', path: 'src/components/ExportOrcrimPdfModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/AddNovoMembroModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/AbordagensPreviewModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/NovaAbordagemModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/VinculoPessoaModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/VinculoPessoaDetailModal.tsx' },
  { category: 'Componentes UI', path: 'src/components/UserManagementModal.tsx' },

  // Utilitários
  { category: 'Utilitários & Serviços', path: 'src/utils/cloudflareApi.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/shareUtils.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/googleSheetsApi.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/aiExtraction.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/storage.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/userAuth.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/userManagementStorage.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/activityLog.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/orcrimStorage.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/orcrimPdfExport.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/textParser.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/bpmMapping.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/gpsService.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/googleAuth.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/textUtils.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/theme.ts' },
  { category: 'Utilitários & Serviços', path: 'src/utils/usePWAInstall.ts' },

  // Dados
  { category: 'Bases de Dados Estáticas', path: 'src/data/legalArticles.ts' },
  { category: 'Bases de Dados Estáticas', path: 'src/data/bairrosBH.ts' },
  { category: 'Bases de Dados Estáticas', path: 'src/data/initialUsers.ts' },
];

const fileEntries = [];
let totalLines = 0;
let totalChars = 0;

for (const item of targetFiles) {
  const fullPath = path.resolve(process.cwd(), item.path);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n').length;
    totalLines += lines;
    totalChars += content.length;
    fileEntries.push({
      path: item.path,
      name: path.basename(item.path),
      category: item.category,
      lines: lines,
      sizeKb: (Buffer.byteLength(content, 'utf8') / 1024).toFixed(1),
      content: content,
    });
  } else {
    console.warn(`Arquivo não encontrado: ${item.path}`);
  }
}

console.log(`Carregados ${fileEntries.length} arquivos, totalizando ${totalLines} linhas de código.`);

const filesJson = JSON.stringify(fileEntries);

const htmlTemplate = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Códigos Completos - Força Tática CPC</title>
  <style>
    :root {
      --bg-dark: #0d1117;
      --bg-card: #161b22;
      --bg-hover: #21262d;
      --border: #30363d;
      --text-main: #e6edf3;
      --text-muted: #8b949e;
      --accent-gold: #c69c59;
      --accent-gold-light: #e5c07b;
      --emerald: #10b981;
      --emerald-dark: #064e3b;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    header {
      background-color: #141a24;
      border-bottom: 1px solid var(--border);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      z-index: 10;
    }

    .brand-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--accent-gold-light);
      display: flex;
      align-items: center;
      gap: 10px;
      letter-spacing: 0.5px;
    }

    .badge-total {
      background: rgba(198, 156, 89, 0.2);
      border: 1px solid rgba(198, 156, 89, 0.4);
      color: var(--accent-gold-light);
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn:hover {
      background-color: var(--bg-hover);
      border-color: #444c56;
      color: #fff;
    }

    .btn-gold {
      background-color: #c69c59;
      color: #0b0f14;
      border: 1px solid #e5c07b;
    }
    .btn-gold:hover {
      background-color: #e5c07b;
      color: #000;
    }

    .btn-success {
      background-color: #059669;
      color: #fff;
      border-color: #10b981;
    }

    .main-container {
      display: flex;
      flex: 1;
      height: calc(100vh - 61px);
      overflow: hidden;
    }

    /* SIDEBAR */
    aside {
      width: 320px;
      background-color: #11161d;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .search-box {
      padding: 12px;
      border-bottom: 1px solid var(--border);
      background-color: var(--bg-card);
    }

    .search-input {
      width: 100%;
      background-color: var(--bg-dark);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: var(--accent-gold);
    }

    .file-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }

    .category-title {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-gold);
      padding: 10px 14px 4px 14px;
    }

    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background-color 0.15s, border-color 0.15s;
    }

    .file-item:hover {
      background-color: var(--bg-hover);
    }

    .file-item.active {
      background-color: rgba(198, 156, 89, 0.12);
      border-left-color: var(--accent-gold);
    }

    .file-name {
      font-size: 0.84rem;
      font-weight: 500;
      color: #c9d1d9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .file-item.active .file-name {
      color: var(--accent-gold-light);
      font-weight: 600;
    }

    .file-meta {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-mono: monospace;
    }

    /* CONTENT VIEWER */
    .content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: var(--bg-dark);
      overflow: hidden;
    }

    .editor-header {
      background-color: #141a24;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .current-path {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.88rem;
      color: #fff;
      font-weight: 600;
    }

    .current-stats {
      font-size: 0.75rem;
      color: var(--text-muted);
      background-color: var(--bg-card);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    .editor-actions {
      display: flex;
      gap: 8px;
    }

    .code-container {
      flex: 1;
      overflow: auto;
      padding: 0;
      position: relative;
      background-color: #0b0e14;
    }

    pre {
      margin: 0;
      padding: 16px;
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 0.82rem;
      line-height: 1.55;
      color: #e6edf3;
      tab-size: 2;
      white-space: pre;
    }

    /* Print / All files mode */
    #allFilesView {
      display: none;
      flex: 1;
      overflow: auto;
      padding: 24px;
      background-color: var(--bg-dark);
    }

    .file-card-block {
      background-color: #141a24;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 24px;
      overflow: hidden;
    }

    .file-card-header {
      background-color: #1a222f;
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .file-card-title {
      font-family: monospace;
      color: var(--accent-gold-light);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background-color: #059669;
      color: #fff;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
      z-index: 1000;
      display: none;
      animation: fadeIn 0.2s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      aside {
        width: 100%;
        height: 40vh;
      }
      .main-container {
        flex-direction: column;
      }
      .content-area {
        height: 60vh;
      }
    }
  </style>
</head>
<body>

  <header>
    <div class="brand-title">
      <span>🛡️ FORÇA TÁTICA CPC - ARQUIVO COMPLETO DE CÓDIGOS</span>
      <span class="badge-total" id="headerSummary">35 arquivos • ${totalLines} linhas</span>
    </div>
    <div class="header-actions">
      <button class="btn" onclick="toggleViewAll()" id="btnToggleView">📑 Ver Todos em Página Única</button>
      <button class="btn btn-gold" onclick="copyAllMerged()">📋 Copiar Tudo Unificado</button>
      <button class="btn" onclick="downloadAllHtml()">💾 Salvar Este HTML</button>
    </div>
  </header>

  <div class="main-container">
    <!-- SIDEBAR DE ARQUIVOS -->
    <aside id="sidebarArea">
      <div class="search-box">
        <input type="text" class="search-input" id="searchFilter" placeholder="🔍 Filtrar arquivo por nome..." oninput="filterFiles()">
      </div>
      <div class="file-list" id="fileListContainer">
        <!-- Renderizado via JavaScript -->
      </div>
    </aside>

    <!-- VISUALIZADOR DE CÓDIGO INDIVIDUAL -->
    <main class="content-area" id="singleFileView">
      <div class="editor-header">
        <div class="file-info">
          <span class="current-path" id="activeFilePath">Carregando...</span>
          <span class="current-stats" id="activeFileStats">--</span>
        </div>
        <div class="editor-actions">
          <button class="btn btn-gold" onclick="copyActiveCode()" id="btnCopyActive">📋 Copiar Código</button>
          <button class="btn" onclick="downloadActiveFile()">📥 Baixar Arquivo</button>
        </div>
      </div>
      <div class="code-container">
        <pre><code id="activeCodeContent"></code></pre>
      </div>
    </main>

    <!-- VISUALIZADOR COMPLETO (TODOS OS ARQUIVOS) -->
    <div id="allFilesView">
      <!-- Renderizado quando o usuário clicar em "Ver Todos em Página Única" -->
    </div>
  </div>

  <div class="toast" id="toastMessage">Código copiado com sucesso!</div>

  <script>
    const FILES = ${filesJson};
    let activeIndex = 0;
    let isAllView = false;

    function renderSidebar(filtered = FILES) {
      const container = document.getElementById('fileListContainer');
      container.innerHTML = '';

      const grouped = {};
      filtered.forEach((file) => {
        if (!grouped[file.category]) grouped[file.category] = [];
        grouped[file.category].push(file);
      });

      Object.keys(grouped).forEach(cat => {
        const catHeader = document.createElement('div');
        catHeader.className = 'category-title';
        catHeader.textContent = cat;
        container.appendChild(catHeader);

        grouped[cat].forEach(file => {
          const originalIndex = FILES.findIndex(f => f.path === file.path);
          const item = document.createElement('div');
          item.className = 'file-item' + (originalIndex === activeIndex ? ' active' : '');
          item.onclick = () => selectFile(originalIndex);

          item.innerHTML = \`
            <div class="file-name" title="\${file.path}">\${file.name}</div>
            <div class="file-meta">\${file.lines}L • \${file.sizeKb}KB</div>
          \`;
          container.appendChild(item);
        });
      });
    }

    function selectFile(index) {
      if (isAllView) toggleViewAll();
      activeIndex = index;
      const file = FILES[index];
      document.getElementById('activeFilePath').textContent = file.path;
      document.getElementById('activeFileStats').textContent = \`\${file.lines} linhas • \${file.sizeKb} KB • \${file.category}\`;
      document.getElementById('activeCodeContent').textContent = file.content;

      // Atualiza active na sidebar
      document.querySelectorAll('.file-item').forEach((el, i) => {
        el.classList.toggle('active', i === index);
      });

      // Scroll para o topo
      document.querySelector('.code-container').scrollTop = 0;
    }

    function filterFiles() {
      const query = document.getElementById('searchFilter').value.toLowerCase().trim();
      const filtered = FILES.filter(f => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query));
      renderSidebar(filtered);
    }

    function showToast(msg = 'Copiado com sucesso!') {
      const toast = document.getElementById('toastMessage');
      toast.textContent = msg;
      toast.style.display = 'block';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 2500);
    }

    function copyActiveCode() {
      const code = FILES[activeIndex].content;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('btnCopyActive');
        btn.textContent = '✅ Copiado!';
        showToast('Código de ' + FILES[activeIndex].name + ' copiado!');
        setTimeout(() => {
          btn.textContent = '📋 Copiar Código';
        }, 2000);
      });
    }

    function downloadActiveFile() {
      const file = FILES[activeIndex];
      const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function copyAllMerged() {
      let merged = '/* ==========================================================================\\n';
      merged += ' * FORÇA TÁTICA CPC - PROJETO COMPLETO\\n';
      merged += ' * Data de exportação: ' + new Date().toLocaleString('pt-BR') + '\\n';
      merged += ' * Total de arquivos: ' + FILES.length + '\\n';
      merged += ' * ========================================================================== */\\n\\n';

      FILES.forEach(f => {
        merged += '\\n\\n/****************************************************************************\\n';
        merged += ' * ARQUIVO: ' + f.path + ' (' + f.lines + ' linhas)\\n';
        merged += ' * CATEGORIA: ' + f.category + '\\n';
        merged += ' ****************************************************************************/\\n\\n';
        merged += f.content;
        merged += '\\n';
      });

      navigator.clipboard.writeText(merged).then(() => {
        showToast('Todos os ' + FILES.length + ' arquivos foram copiados unificados!');
      });
    }

    function toggleViewAll() {
      isAllView = !isAllView;
      const singleView = document.getElementById('singleFileView');
      const allView = document.getElementById('allFilesView');
      const btn = document.getElementById('btnToggleView');

      if (isAllView) {
        singleView.style.display = 'none';
        allView.style.display = 'block';
        btn.textContent = '📂 Voltar para Navegador';
        btn.classList.add('btn-gold');

        if (allView.children.length === 0) {
          FILES.forEach((f, idx) => {
            const block = document.createElement('div');
            block.className = 'file-card-block';
            block.innerHTML = \`
              <div class="file-card-header">
                <span class="file-card-title">\${f.path}</span>
                <span class="current-stats">\${f.lines} linhas • \${f.sizeKb} KB</span>
              </div>
              <pre><code>\${f.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
            \`;
            allView.appendChild(block);
          });
        }
      } else {
        singleView.style.display = 'flex';
        allView.style.display = 'none';
        btn.textContent = '📑 Ver Todos em Página Única';
        btn.classList.remove('btn-gold');
      }
    }

    function downloadAllHtml() {
      const a = document.createElement('a');
      a.href = window.location.href;
      a.download = 'codigos_completos_forca_tatica.html';
      a.click();
    }

    // Inicialização
    renderSidebar();
    if (FILES.length > 0) {
      selectFile(0);
    }
  </script>
</body>
</html>
`;

const outputPath = path.resolve(process.cwd(), 'public', 'codigos_completos_app.html');
fs.writeFileSync(outputPath, htmlTemplate, 'utf8');

console.log(`Arquivo HTML gerado com sucesso em: ${outputPath}`);
