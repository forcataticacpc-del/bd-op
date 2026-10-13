import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = 3000;
const DEFAULT_APPS_SCRIPT_URL =
  process.env.GOOGLE_SHEETS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwDrSu-3Oid7YqH9RzONE_RJ4DyggPUE00Dqp0Y2ldEjJnXUVKwI9cxAQ-14CbpTh0/exec';

async function startServer() {
  const app = express();

  // Permite payloads de fotos até 50MB sem estouro
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.text({ limit: '50mb', type: ['text/*', 'application/json'] }));

  // ============================================================================
  // API ROUTES (Zero problemas de CORS e redirecionamento do navegador)
  // ============================================================================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Banco de Dados Operacional - Servidor Nuvem',
      timestamp: new Date().toISOString(),
    });
  });

  // Download do arquivo ZIP do projeto completo (Envio direto binário com Content-Length)
  app.get(
    ['/api/download-zip', '/banco-de-dados-app-completo.zip', '/forca-tatica-app.zip'],
    (req, res) => {
      const zipPath = path.join(process.cwd(), 'public', 'banco-de-dados-app-completo.zip');

      if (!fs.existsSync(zipPath)) {
        // Se ainda não existir, executa o empacotador python
        exec('python3 scripts/pack_app.py', (error, stdout, stderr) => {
          if (fs.existsSync(zipPath)) {
            const stats = fs.statSync(zipPath);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', stats.size);
            res.setHeader(
              'Content-Disposition',
              'attachment; filename="banco-de-dados-projeto-completo.zip"'
            );
            res.setHeader('Cache-Control', 'no-cache');
            return res.sendFile(zipPath);
          } else {
            console.error('Erro ao empacotar zip:', error, stderr);
            return res.status(500).send('Erro ao gerar arquivo ZIP do projeto.');
          }
        });
        return;
      }

      const stats = fs.statSync(zipPath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', stats.size);
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="banco-de-dados-projeto-completo.zip"'
      );
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(zipPath);
    }
  );

  // Endpoint API em formato Base64 para garantir download 100% íntegro dentro do iframe (evita desvio para __cookie_check.html de 10KB)
  app.get('/api/download-zip-base64', (req, res) => {
    try {
      const zipPath = path.join(process.cwd(), 'public', 'banco-de-dados-app-completo.zip');
      if (!fs.existsSync(zipPath)) {
        return res.status(404).json({ error: 'Arquivo zip não encontrado' });
      }
      const fileBuffer = fs.readFileSync(zipPath);
      const base64Data = fileBuffer.toString('base64');
      const stats = fs.statSync(zipPath);

      return res.json({
        success: true,
        filename: 'banco-de-dados-projeto-completo.zip',
        sizeBytes: stats.size,
        sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
        data: base64Data,
      });
    } catch (err: any) {
      console.error('Erro ao fornecer zip em base64:', err);
      return res.status(500).json({ error: err.message || 'Erro ao ler arquivo ZIP' });
    }
  });

  // Download do pacote específico do Cloudflare Pages (dist)
  app.get(['/api/download-pages-zip', '/cloudflare-pages-dist.zip'], (req, res) => {
    const zipPath = path.join(process.cwd(), 'public', 'cloudflare-pages-dist.zip');
    if (!fs.existsSync(zipPath)) {
      exec('python3 scripts/pack_dist.py', (err) => {
        if (fs.existsSync(zipPath)) {
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', 'attachment; filename="cloudflare-pages-dist.zip"');
          return res.sendFile(zipPath);
        }
        return res.status(500).send('Erro ao gerar pacote Pages.');
      });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="cloudflare-pages-dist.zip"');
    res.sendFile(zipPath);
  });

  app.get('/api/download-pages-zip-base64', (req, res) => {
    try {
      const zipPath = path.join(process.cwd(), 'public', 'cloudflare-pages-dist.zip');
      if (!fs.existsSync(zipPath)) {
        return res.status(404).json({ error: 'Arquivo Pages não encontrado' });
      }
      const fileBuffer = fs.readFileSync(zipPath);
      const base64Data = fileBuffer.toString('base64');
      const stats = fs.statSync(zipPath);

      return res.json({
        success: true,
        filename: 'cloudflare-pages-dist.zip',
        sizeBytes: stats.size,
        sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
        data: base64Data,
      });
    } catch (err: any) {
      console.error('Erro ao fornecer Pages zip base64:', err);
      return res.status(500).json({ error: err.message || 'Erro ao ler arquivo' });
    }
  });

  // Download do arquivo HTML com os códigos completos
  app.get(['/api/download-html', '/baixar-codigos.html'], (req, res) => {
    const htmlPath = path.join(process.cwd(), 'public', 'codigos_completos_app.html');
    if (fs.existsSync(htmlPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="codigos_completos_forca_tatica.html"');
      res.sendFile(htmlPath);
    } else {
      res.status(404).send('Arquivo de códigos não encontrado.');
    }
  });

  // ============================================================================
  // GITHUB AUTOMATED CI/CD & REPO SYNC ROUTES
  // ============================================================================

  // Status do repositório Git local
  app.get('/api/github/status', async (req, res) => {
    try {
      const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));
      if (!isGitRepo) {
        return res.json({
          initialized: false,
          message: 'Repositório Git local não inicializado.',
        });
      }

      exec(
        'git branch --show-current && git log -1 --format="%h|%s|%cd" && git remote get-url origin',
        { cwd: process.cwd() },
        (err, stdout) => {
          const lines = (stdout || '').trim().split('\n');
          const branch = lines[0] || 'main';
          const commitInfo = lines[1] ? lines[1].split('|') : [];
          const remoteUrl = lines[2] || '';

          // Oculta token da URL remota se houver
          const sanitizedRemote = remoteUrl.replace(/https:\/\/[^@]+@/, 'https://');

          return res.json({
            initialized: true,
            branch,
            commitHash: commitInfo[0] || '',
            commitMessage: commitInfo[1] || '',
            commitDate: commitInfo[2] || '',
            remoteUrl: sanitizedRemote,
          });
        }
      );
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Testa conexão e permissões com o repositório GitHub
  app.post('/api/github/test', async (req, res) => {
    try {
      const { repoUrl, token } = req.body || {};
      if (!repoUrl) {
        return res.status(400).json({ success: false, message: 'URL do repositório é obrigatória.' });
      }

      const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
      if (!match) {
        return res.json({
          success: false,
          message: 'Formato de URL do GitHub inválido. Exemplo: https://github.com/usuario/repositorio',
        });
      }
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, '');

      const headers: Record<string, string> = {
        'User-Agent': 'BD-OP-App/1.0',
        Accept: 'application/vnd.github.v3+json',
      };
      if (token && typeof token === 'string' && token.trim()) {
        headers.Authorization = `token ${token.trim()}`;
      }

      const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!resp.ok) {
        if (resp.status === 404) {
          return res.json({
            success: false,
            status: 404,
            message:
              'Repositório não encontrado. Se for privado, informe um Token de Acesso (PAT) com escopo "repo". Se ainda não existir, crie o repositório no GitHub primeiro.',
          });
        }
        if (resp.status === 401) {
          return res.json({
            success: false,
            status: 401,
            message: 'Token de acesso inválido ou expirado. Gere um novo token no GitHub.',
          });
        }
        return res.json({
          success: false,
          message: `GitHub respondeu status ${resp.status}`,
        });
      }

      const data = await resp.json();
      return res.json({
        success: true,
        repoName: data.full_name,
        isPrivate: data.private,
        defaultBranch: data.default_branch || 'main',
        permissions: data.permissions,
        message: `Conectado com sucesso ao repositório ${data.full_name} (${data.private ? 'Privado' : 'Público'})!`,
      });
    } catch (err: any) {
      return res.json({ success: false, message: err.message });
    }
  });

  // Executa git add, commit e push para o GitHub
  app.post('/api/github/push', async (req, res) => {
    try {
      let { repoUrl, token, commitMessage } = req.body || {};
      if (!repoUrl || typeof repoUrl !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'URL do repositório GitHub é obrigatória (ex: https://github.com/usuario/meu-app.git).',
        });
      }

      repoUrl = repoUrl.trim();
      token = (token || '').trim();

      // Normaliza URL do repositório
      let cleanRepo = repoUrl;
      if (!cleanRepo.startsWith('http://') && !cleanRepo.startsWith('https://')) {
        cleanRepo = `https://github.com/${cleanRepo.replace(/^\/+/, '')}`;
      }
      if (!cleanRepo.endsWith('.git')) {
        cleanRepo = `${cleanRepo}.git`;
      }

      // Remove qualquer credencial prévia da URL
      const urlWithoutAuth = cleanRepo.replace(/^https:\/\/[^@]+@/, 'https://');

      // Monta a URL de autenticação com o token
      let authenticatedPushUrl = urlWithoutAuth;
      if (token) {
        authenticatedPushUrl = urlWithoutAuth.replace(
          'https://',
          `https://${encodeURIComponent(token)}@`
        );
      }

      const logs: string[] = [];
      const runCmd = (cmd: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          exec(cmd, { cwd: process.cwd(), maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
              const safeStderr = token ? (stderr || '').split(token).join('***TOKEN***') : (stderr || '');
              const safeStdout = token ? (stdout || '').split(token).join('***TOKEN***') : (stdout || '');
              return reject(new Error(`${safeStderr || safeStdout || err.message}`));
            }
            const safeStdout = token ? (stdout || '').split(token).join('***TOKEN***') : (stdout || '');
            resolve(safeStdout.trim());
          });
        });
      };

      logs.push('⚙️ Inicializando configuração do Git local...');
      await runCmd('git config user.name "Força Tática - BD OP"');
      await runCmd('git config user.email "forcataticacpc@gmail.com"');
      if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
        await runCmd('git init');
      }
      await runCmd('git branch -M main');

      logs.push('📦 Adicionando arquivos do projeto ao Git...');
      await runCmd('git add -A');

      const msg = (
        commitMessage || `Atualização automática: ${new Date().toLocaleString('pt-BR')}`
      ).replace(/"/g, '\\"');

      try {
        logs.push('📝 Criando commit de atualização...');
        await runCmd(`git commit -m "${msg}"`);
      } catch {
        logs.push('ℹ️ Nenhuma alteração pendente (arquivos já sincronizados com o commit local).');
      }

      logs.push('🔗 Configurando repositório remoto origin...');
      try {
        await runCmd('git remote remove origin');
      } catch {}
      await runCmd(`git remote add origin "${authenticatedPushUrl}"`);

      logs.push('🚀 Enviando código para a branch main do GitHub...');
      const pushOutput = await runCmd('git push -u origin main --force');
      if (pushOutput) logs.push(pushOutput);

      const commitHash = await runCmd('git rev-parse --short HEAD');

      // Remove token do remote origin local para segurança do container
      try {
        await runCmd(`git remote set-url origin "${urlWithoutAuth}"`);
      } catch {}

      logs.push('🎉 Sucesso! O código está atualizado no GitHub.');
      logs.push(
        '⚡ Se o Cloudflare Pages estiver conectado a este repositório, a nova versão estará online em ~30 segundos!'
      );

      return res.json({
        success: true,
        commitHash,
        branch: 'main',
        remoteUrl: urlWithoutAuth,
        message: 'Código enviado com sucesso para o GitHub!',
        logs,
      });
    } catch (err: any) {
      console.error('[GITHUB PUSH ERROR]:', err);
      return res.status(200).json({
        success: false,
        message: `Erro ao enviar para o GitHub: ${err.message || 'Verifique se o token de acesso tem permissão "repo" e se a URL do repositório está correta.'}`,
      });
    }
  });

  // Diagnóstico completo da ponte Google Sheets / Drive
  app.get('/api/diagnostics', async (req, res) => {
    const targetUrl = (req.query.url as string) || DEFAULT_APPS_SCRIPT_URL;
    const startTime = Date.now();

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      const elapsedMs = Date.now() - startTime;
      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text.slice(0, 300) };
      }

      res.json({
        success: response.ok,
        httpStatus: response.status,
        elapsedMs,
        targetUrl,
        bridgeType: 'Google Apps Script Web App',
        serviceAccountNotice:
          'A ponte utiliza o Web App Google Apps Script sob a conta do criador. Não é necessário conceder privilégios manuais a contas @gserviceaccount.',
        responseSummary: {
          status: parsed?.status,
          total: parsed?.total,
          message: parsed?.message,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Falha de conexão com a planilha',
        targetUrl,
        elapsedMs: Date.now() - startTime,
      });
    }
  });

  // GET /api/sheets: Busca registros na planilha em tempo real e consulta configurações/senha
  app.get('/api/sheets', async (req, res) => {
    // Cabeçalhos rigorosos anti-cache para garantir sincronização em tempo real sem dados defasados
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    try {
      const termo = (req.query.termo as string) || '';
      const action = (req.query.action as string) || '';
      const id = (req.query.id as string) || '';
      let customUrl = (req.query.webhookUrl as string) || (req.query.url as string);
      if (customUrl && customUrl.includes('AKfycbwoy01Le66ylY')) {
        customUrl = DEFAULT_APPS_SCRIPT_URL;
      }
      const targetUrl = customUrl && customUrl.startsWith('https://script.google.com')
        ? customUrl
        : DEFAULT_APPS_SCRIPT_URL;

      const queryParts: string[] = [];
      if (termo) queryParts.push(`termo=${encodeURIComponent(termo)}`);
      if (action) queryParts.push(`action=${encodeURIComponent(action)}`);
      if (id) queryParts.push(`id=${encodeURIComponent(id)}`);
      queryParts.push(`_t=${Date.now()}`);

      const separator = targetUrl.includes('?') ? '&' : '?';
      const urlWithQuery = queryParts.length > 0 ? `${targetUrl}${separator}${queryParts.join('&')}` : targetUrl;

      const response = await fetch(urlWithQuery, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.status(response.ok ? 200 : 502).json({
          status: response.ok ? 'success' : 'error',
          rawText: text,
        });
      }
    } catch (err: any) {
      console.error('[SERVER /api/sheets GET ERROR]:', err);
      res.status(500).json({
        status: 'error',
        message: `Falha no servidor ao buscar dados da planilha: ${err.message}`,
      });
    }
  });

  // POST /api/sheets: Salva, edita ou exclui registros e fotos na nuvem
  app.post('/api/sheets', async (req, res) => {
    try {
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch {
          // mantém como string se não for json
        }
      }

      const customUrl = bodyData?.webhookUrl;
      const targetUrl = customUrl && typeof customUrl === 'string' && customUrl.startsWith('https://script.google.com')
        ? customUrl
        : DEFAULT_APPS_SCRIPT_URL;

      const payloadString = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);

      // Node.js nativo lida com o redirect 302 do Google perfeitamente
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: payloadString,
        redirect: 'follow',
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = { rawText: text };
      }

      if (response.ok && json.status === 'success') {
        return res.json(json);
      } else if (response.ok && !json.status) {
        return res.json({ status: 'success', ...json });
      } else {
        return res.status(response.ok ? 200 : 502).json(json);
      }
    } catch (err: any) {
      console.error('[SERVER /api/sheets POST ERROR]:', err);
      res.status(500).json({
        status: 'error',
        message: `Erro de conexão do servidor com a Planilha Google: ${err.message}`,
      });
    }
  });

  // ============================================================================
  // GEMINI AI EXTRACTION ROUTE
  // ============================================================================
  let genAiClient: GoogleGenAI | null = null;
  function getGenAI(): GoogleGenAI {
    if (!genAiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('A chave de API GEMINI_API_KEY não está configurada no ambiente.');
      }
      genAiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return genAiClient;
  }

  // POST /api/ai/extract-suspect: Analisa print, fotos e documentos (JSON, HTML, XLSX, DOCX, PDF, TXT, PPTX) com Gemini IA
  app.post('/api/ai/extract-suspect', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', fileContent, fileName } = req.body || {};
      if (!imageBase64 && !fileContent) {
        return res.status(400).json({
          status: 'error',
          message: 'Nenhum arquivo, texto ou imagem foi enviado para análise pela IA.',
        });
      }

      // Otimização de Alta Performance: se for arquivo JSON enviado como texto, tenta interpretação direta estruturada
      if (fileContent && typeof fileContent === 'string') {
        const trimmed = fileContent.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const directJson = JSON.parse(trimmed);
            let candidates: any[] = [];
            if (Array.isArray(directJson)) {
              candidates = directJson;
            } else if (typeof directJson === 'object' && directJson !== null) {
              const list =
                directJson.suspects ||
                directJson.records ||
                directJson.data ||
                directJson.items ||
                directJson.abordados ||
                directJson.cadastros ||
                directJson.individuos ||
                directJson.pessoas;
              if (Array.isArray(list)) {
                candidates = list;
              } else if (directJson.nome || directJson.name || directJson.alcunha || directJson.vulgo || directJson.rg) {
                candidates = [directJson];
              }
            }

            if (candidates.length > 0) {
              const parsedDirect = candidates
                .map((item: any) => {
                  if (!item || typeof item !== 'object') return null;
                  const nome = item.nome || item.name || item.Nome || item.NOME || item.nomeCompleto || item.alcunha || '';
                  const mae = item.mae || item.mother || item.Mae || item.MAE || item.filiacao || '';
                  const rg = String(item.rg || item.RG || item.identidade || '').trim();
                  const cpf = String(item.cpf || item.CPF || '').trim();
                  const dataNasc = item.dataNasc || item.data_nasc || item.dataNascimento || item.nascimento || '';
                  const alcunha = item.alcunha || item.vulgo || item.apelido || item.ALCUNHA || item.VULGO || '';
                  const endereco = item.endereco || item.endereço || item.address || item.bairro || '';
                  const artigo = item.artigo || (Array.isArray(item.artigos) ? item.artigos.join(', ') : item.artigos) || '';
                  const artigos = Array.isArray(item.artigos) ? item.artigos : artigo ? [artigo] : [];
                  const observacoes = item.observacoes || item.observações || item.obs || '';
                  const generoDetectado = item.generoDetectado || item.genero || 'MASCULINO';
                  const photo = item.croppedPhoto || item.foto || item.photoUrl || (Array.isArray(item.fotos) ? item.fotos[0] : null) || null;

                  return {
                    nome,
                    mae,
                    rg,
                    cpf,
                    dataNasc,
                    alcunha,
                    endereco,
                    artigo,
                    artigos,
                    observacoes,
                    generoDetectado,
                    faceBoundingBox: photo ? { hasPhoto: true } : { hasPhoto: false },
                    croppedPhoto: photo,
                  };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null && Boolean(item.nome || item.alcunha || item.rg || item.cpf));

              if (parsedDirect.length > 0) {
                return res.json({
                  status: 'success',
                  data: parsedDirect[0],
                  suspects: parsedDirect,
                });
              }
            }
          } catch {
            // Continua para o Gemini se não for JSON estrito ou se falhar
          }
        }
      }

      const ai = getGenAI();
      const prompt = `Analise detalhadamente este arquivo, print, documento ou ficha de identificação criminal da Polícia Militar (Banco de Dados Operacional).
Origem do arquivo: ${fileName ? `Nome do arquivo: "${fileName}"` : 'Documento / Print Operacional'}

Sua missão é extrair com rigor operacional todos os dados cadastrais do(s) indivíduo(s) abordado(s), seguindo os padrões táticos de identificação.

1. DIRETRIZES ESTRITAS DE DISTINÇÃO DE NOMES E ALCUNHA:
   - 'alcunha': Se houver um apelido, vulgo ou alcunha no início em destaque, em caixa alta, antes do nome completo ou entre aspas (como "GIBINHA" logo acima de "ITALO KAUAN PEREIRA GOULART"), extraia como 'alcunha'.
   - 'nome': Nome completo civil do abordado (ex: "ITALO KAUAN PEREIRA GOULART"). Se for uma mulher, identifique o primeiro nome feminino como o da abordada.
   - 'mae': Nome completo da mãe (ex: "ALINE PEREIRA ROSA"). Se não houver, retorne "".
   - 'rg': Registro Geral / RG. Se não constar no texto/print, retorne "" (NÃO invente).
   - 'cpf': CPF do abordado. Se não constar no texto/print, retorne "" (NÃO invente).
   - 'dataNasc': Data de nascimento (DD/MM/AAAA). Se não constar, retorne "".
   - 'endereco': Endereço residencial, rua, número, bloco, apto, bairro ou cidade (ex: "Rua Maria Guerzone Fernandes, 210, bl 10, apto 403").
   - 'artigos': Lista de artigos penais inferidos ou citados (ex: ["Art. 155", "Art. 157"] se houver menção a furto/roubo).
   - 'artigo': Resumo dos crimes ou artigos penais.
   - 'observacoes': Histórico, anotações, modus operandi, comparsas ou facção (ex: "Ladrão nato (envolvido em furtos e roubos de residência de alto padrão). Cola com GUTH/GUTE").
   - 'generoDetectado': 'MASCULINO' ou 'FEMININO'.

2. RECONHECIMENTO E RECORTE ESTRITO DA FOTO DO ABORDADO NO PRINT (COMO FOTO 2 EXTRAÍDA DE UM PRINT COMO FOTO 1):
   - Se o arquivo for um PRINT DE TELA (screenshot de celular, aplicativo de notas, galeria, rede social ou documento) contendo uma FOTOGRAFIA do indivíduo:
     - Localize a área retangular EXATA onde está a FOTOGRAFIA da pessoa dentro do print.
     - A caixa 'faceBoundingBox' DEVE enquadrar a FOTOGRAFIA COMPLETA da pessoa como inserida no print (incluindo cabeça, busto, peito/ombros e o fundo da foto), EXCLUINDO ESTRITAMENTE:
       a) A barra de status superior do celular (relógio como 11:22, ícones de Wi-Fi, 5G, bateria);
       b) A barra de navegação/ferramentas superior do app (botões de voltar, fixar, arquivar);
       c) Quaisquer fundos pretos ou barras externas fora do retângulo da foto;
       d) Todos os textos, títulos ou anotações situadas abaixo ou ao redor da foto (como "GIBINHA", nome do abordado, mãe, botões inferiores).
     - Retorne as coordenadas normalizadas [0 a 1000] do retângulo EXATO da foto:
       - ymin: pixel superior exato onde começa a imagem fotográfica [0 a 1000]
       - xmin: pixel esquerdo exato onde começa a imagem fotográfica [0 a 1000]
       - ymax: pixel inferior exato onde termina a imagem fotográfica (logo antes do texto/título) [0 a 1000]
       - xmax: pixel direito exato onde termina a imagem fotográfica [0 a 1000]
       - hasPhoto: true
   - Se a imagem enviada já for uma fotografia direta (sem elementos de print/interface de celular ao redor):
     - ymin: 0, xmin: 0, ymax: 1000, xmax: 1000, hasPhoto: true.
   - Se for um arquivo puramente de texto ou planilha sem nenhuma fotografia:
     - hasPhoto: false.

3. IMPORTAÇÃO MÚLTIPLA OU INDIVIDUAL:
   - Se o arquivo contiver múltiplos abordados (ex: tabela, planilha XLSX, PDF com vários nomes, lista de abordagens, linhas em documento), extraia CADA INDIVÍDUO separadamente dentro da lista 'suspects'.
   - Se contiver apenas 1 indivíduo, inclua-o na lista 'suspects' (com 1 elemento) e também preencha os campos principais na raiz.`;

      // Prepara os contents para o Gemini
      const contentsPayload: any[] = [];

      if (imageBase64 && typeof imageBase64 === 'string') {
        let cleanBase64 = imageBase64;
        let detectedMime = mimeType;
        if (imageBase64.includes(';base64,')) {
          const parts = imageBase64.split(';base64,');
          cleanBase64 = parts[1];
          const match = parts[0].match(/data:([^;]+)/);
          if (match) detectedMime = match[1];
        }
        contentsPayload.push({
          inlineData: {
            mimeType: detectedMime,
            data: cleanBase64,
          },
        });
      }

      if (fileContent && typeof fileContent === 'string') {
        contentsPayload.push({
          text: `CONTEÚDO DO ARQUIVO IMPORTADO (${fileName || 'Documento'}):\n\n${fileContent.slice(0, 100000)}`,
        });
      }

      contentsPayload.push({
        text: prompt,
      });

      // Modelos em ordem de preferência e resiliência com fallback inteligente
      const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      let lastError: any = null;
      let response: any = null;

      for (let i = 0; i < candidateModels.length; i++) {
        const modelName = candidateModels[i];
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contentsPayload,
            config: {
              systemInstruction:
                'Você é um assistente de inteligência e identificação criminal do Banco de Dados Operacional da Polícia Militar. Extraia dados de forma objetiva, segura e com máxima fidelidade aos caracteres e imagens presentes no documento. Se o documento for um arquivo JSON ou lista de objetos/registros, extraia cada indivíduo para o array suspects. Se o nome civil não constar explicitamente, use a alcunha/vulgo como nome. Retorne estritamente o JSON especificado.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  suspects: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        nome: { type: Type.STRING, description: 'Nome completo do abordado' },
                        mae: { type: Type.STRING, description: 'Nome da mãe do abordado' },
                        rg: { type: Type.STRING, description: 'RG do abordado' },
                        cpf: { type: Type.STRING, description: 'CPF do abordado' },
                        dataNasc: { type: Type.STRING, description: 'Data de nascimento do abordado (DD/MM/AAAA)' },
                        alcunha: { type: Type.STRING, description: 'Vulgo / apelido / alcunha' },
                        endereco: { type: Type.STRING, description: 'Endereço residencial ou bairro' },
                        artigos: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: 'Artigos penais ou crimes encontrados',
                        },
                        artigo: { type: Type.STRING, description: 'Resumo dos crimes' },
                        observacoes: { type: Type.STRING, description: 'Observações, mandados ou passagens' },
                        generoDetectado: { type: Type.STRING, description: 'MASCULINO ou FEMININO' },
                        faceBoundingBox: {
                          type: Type.OBJECT,
                          properties: {
                            ymin: { type: Type.INTEGER },
                            xmin: { type: Type.INTEGER },
                            ymax: { type: Type.INTEGER },
                            xmax: { type: Type.INTEGER },
                            hasPhoto: { type: Type.BOOLEAN },
                          },
                          required: ['hasPhoto'],
                        },
                      },
                    },
                  },
                  nome: { type: Type.STRING, description: 'Nome completo do primeiro abordado' },
                  mae: { type: Type.STRING, description: 'Nome da mãe do abordado' },
                  rg: { type: Type.STRING, description: 'RG do abordado' },
                  cpf: { type: Type.STRING, description: 'CPF do abordado' },
                  dataNasc: { type: Type.STRING, description: 'Data de nascimento do abordado' },
                  alcunha: { type: Type.STRING, description: 'Vulgo / apelido / alcunha' },
                  endereco: { type: Type.STRING, description: 'Endereço residencial ou bairro' },
                  artigos: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Artigos penais ou crimes encontrados',
                  },
                  artigo: { type: Type.STRING, description: 'Resumo dos crimes' },
                  observacoes: { type: Type.STRING, description: 'Observações, mandados ou passagens' },
                  generoDetectado: { type: Type.STRING, description: 'MASCULINO ou FEMININO' },
                  faceBoundingBox: {
                    type: Type.OBJECT,
                    properties: {
                      ymin: { type: Type.INTEGER },
                      xmin: { type: Type.INTEGER },
                      ymax: { type: Type.INTEGER },
                      xmax: { type: Type.INTEGER },
                      hasPhoto: { type: Type.BOOLEAN },
                    },
                    required: ['hasPhoto'],
                  },
                },
              },
            },
          });

          if (response && response.text) {
            // Sucesso na extração
            break;
          }
        } catch (callErr: any) {
          lastError = callErr;
          console.log(`[SERVER AI]: Modelo ${modelName} indisponível temporariamente. Acionando contingência...`);
          // Pausa progressiva para aguardar liberação de demanda do servidor
          await new Promise((r) => setTimeout(r, 600 * (i + 1)));
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error('Serviço de IA temporariamente indisponível.');
      }

      let cleanText = (response.text || '{}').trim();
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(cleanText);
      } catch (e) {
        const match = cleanText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) {
          try {
            parsedData = JSON.parse(match[0]);
          } catch {
            parsedData = { raw: cleanText };
          }
        } else {
          parsedData = { raw: cleanText };
        }
      }

      // Normaliza lista de múltiplos suspeitos tolerante a qualquer formato retornado pela IA
      let suspectsList: any[] = [];
      if (Array.isArray(parsedData)) {
        suspectsList = parsedData;
      } else if (Array.isArray(parsedData.suspects) && parsedData.suspects.length > 0) {
        suspectsList = parsedData.suspects;
      } else if (Array.isArray(parsedData.data) && parsedData.data.length > 0) {
        suspectsList = parsedData.data;
      } else if (Array.isArray(parsedData.records) && parsedData.records.length > 0) {
        suspectsList = parsedData.records;
      } else if (Array.isArray(parsedData.items) && parsedData.items.length > 0) {
        suspectsList = parsedData.items;
      } else if (Array.isArray(parsedData.cadastros) && parsedData.cadastros.length > 0) {
        suspectsList = parsedData.cadastros;
      } else if (Array.isArray(parsedData.abordados) && parsedData.abordados.length > 0) {
        suspectsList = parsedData.abordados;
      } else if (parsedData.nome || parsedData.name || parsedData.alcunha || parsedData.vulgo || parsedData.rg) {
        suspectsList = [parsedData];
      }

      // Higieniza cada item garantindo campos obrigatórios
      suspectsList = suspectsList
        .map((item: any) => {
          if (!item || typeof item !== 'object') return null;
          const nome = item.nome || item.name || item.Nome || item.NOME || item.nomeCompleto || item.alcunha || '';
          const mae = item.mae || item.mother || item.Mae || item.MAE || item.filiacao || '';
          const rg = String(item.rg || item.RG || item.identidade || '').trim();
          const cpf = String(item.cpf || item.CPF || '').trim();
          const dataNasc = item.dataNasc || item.data_nasc || item.dataNascimento || item.nascimento || '';
          const alcunha = item.alcunha || item.vulgo || item.apelido || item.ALCUNHA || item.VULGO || '';
          const endereco = item.endereco || item.endereço || item.address || item.bairro || '';
          const artigo = item.artigo || (Array.isArray(item.artigos) ? item.artigos.join(', ') : item.artigos) || '';
          const artigos = Array.isArray(item.artigos) ? item.artigos : artigo ? [artigo] : [];
          const observacoes = item.observacoes || item.observações || item.obs || '';
          const generoDetectado = item.generoDetectado || item.genero || 'MASCULINO';
          const faceBoundingBox = item.faceBoundingBox || { hasPhoto: false };

          return {
            nome,
            mae,
            rg,
            cpf,
            dataNasc,
            alcunha,
            endereco,
            artigo,
            artigos,
            observacoes,
            generoDetectado,
            faceBoundingBox,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && Boolean(item.nome || item.alcunha || item.rg || item.cpf));

      const primaryData = suspectsList[0] || (parsedData.nome ? parsedData : {});

      return res.json({
        status: 'success',
        data: primaryData,
        suspects: suspectsList,
      });
    } catch (err: any) {
      let userFriendlyMessage = err?.message || 'Erro de comunicação com o servidor de IA';

      // Tratamento humanizado de mensagens de erro comuns da nuvem
      if (
        userFriendlyMessage.includes('503') ||
        userFriendlyMessage.includes('high demand') ||
        userFriendlyMessage.includes('UNAVAILABLE')
      ) {
        userFriendlyMessage =
          'Os servidores de IA estão com alta demanda temporária. Por favor, tente novamente em alguns instantes.';
      } else if (
        userFriendlyMessage.includes('429') ||
        userFriendlyMessage.includes('RESOURCE_EXHAUSTED')
      ) {
        userFriendlyMessage =
          'Limite momentâneo de requisições atingido. Aguarde alguns segundos e tente novamente.';
      } else if (userFriendlyMessage.includes('GEMINI_API_KEY')) {
        userFriendlyMessage = 'A chave de inteligência artificial não está configurada no ambiente.';
      }

      // Retorna 200 com status error para o cliente tratar amigavelmente sem disparar 500 no monitor
      return res.status(200).json({
        status: 'error',
        message: userFriendlyMessage,
      });
    }
  });

  // ============================================================================
  // GEMINI AI FACIAL RECOGNITION & BIOMETRIC COMPARISON ROUTE
  // ============================================================================
  const candidatePhotoCache = new Map<string, { mimeType: string; data: string }>();

  app.post('/api/ai/facial-match', async (req, res) => {
    try {
      const { targetPhoto, candidates } = req.body || {};
      if (!targetPhoto) {
        return res.status(400).json({
          status: 'error',
          message: 'Foto do abordado não informada para comparação biométrica.',
        });
      }

      if (!Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Nenhum registro com foto fornecido para comparação.',
        });
      }

      const ai = getGenAI();

      // Limita aos primeiros 10 candidatos por ciclo para velocidade de resposta em viatura
      const candidatesToProcess = candidates.slice(0, 10);

      // Função assíncrona robusta para resolver imagens (Data URL Base64, URL remota HTTP/HTTPS do Google Drive/CDN, ou Base64 puro)
      // Otimizada para redes móveis 5G/4G: timeout reduzido de 6s, fallback imediato para thumbnail e cache em memória
      async function resolveInlinePhoto(
        photoStr: string
      ): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
        if (!photoStr || typeof photoStr !== 'string') return null;
        let str = photoStr.trim();
        if (!str) return null;

        // Se já foi resolvida anteriormente em memória, devolve instantaneamente (0ms, 0 requisições de rede)
        if (candidatePhotoCache.has(str)) {
          return { inlineData: candidatePhotoCache.get(str)! };
        }

        // 1. Caso seja Data URL: 'data:image/...;base64,...'
        if (str.startsWith('data:')) {
          const match = str.match(/^data:([^;]+);base64,(.+)$/s);
          if (match && match[2]) {
            const inlineObj = {
              mimeType: match[1] || 'image/jpeg',
              data: match[2].trim(),
            };
            return { inlineData: inlineObj };
          }
          const commaIndex = str.indexOf(',');
          if (commaIndex !== -1) {
            const header = str.substring(0, commaIndex);
            const data = str.substring(commaIndex + 1).trim();
            const mimeMatch = header.match(/data:([^;]+)/);
            return {
              inlineData: {
                mimeType: (mimeMatch && mimeMatch[1]) || 'image/jpeg',
                data,
              },
            };
          }
        }

        // 2. Caso seja URL remota (Google Drive, Cloudflare R2, CDN, etc.)
        if (str.startsWith('http://') || str.startsWith('https://')) {
          // Extrai File ID do Google Drive se for o caso
          const fileIdMatch =
            str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
            str.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
            str.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
            str.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);

          const candidateUrls: string[] = [];
          if (fileIdMatch && fileIdMatch[1]) {
            const fid = fileIdMatch[1];
            // 1ª opção: Thumbnail oficial do Google Workspace (ultra rápido, comprimido, sem bloqueio de cota)
            candidateUrls.push(`https://drive.google.com/thumbnail?id=${fid}&sz=w500`);
            // 2ª opção: LH3 CDN
            candidateUrls.push(`https://lh3.googleusercontent.com/d/${fid}`);
            // 3ª opção: export view
            candidateUrls.push(`https://drive.google.com/uc?export=view&id=${fid}`);
          } else {
            candidateUrls.push(str);
          }

          for (const fetchUrl of candidateUrls) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 segundos máx por URL para não travar no 5G

              const resp = await fetch(fetchUrl, {
                signal: controller.signal,
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  Accept: 'image/avif,image/webp,image/apng,image/jpeg,image/png,image/*,*/*;q=0.8',
                },
              });
              clearTimeout(timeoutId);

              if (!resp.ok) continue;

              const arrayBuf = await resp.arrayBuffer();
              const buffer = Buffer.from(arrayBuf);
              if (buffer.length < 50) continue;

              let mimeType = resp.headers.get('content-type') || 'image/jpeg';
              mimeType = mimeType.split(';')[0].trim().toLowerCase();
              if (!mimeType.startsWith('image/')) {
                mimeType = 'image/jpeg';
              }

              const inlineObj = {
                mimeType,
                data: buffer.toString('base64'),
              };

              // Salva no cache em memória do servidor para acelerar buscas subsequentes (0ms na próxima)
              candidatePhotoCache.set(str, inlineObj);

              return {
                inlineData: inlineObj,
              };
            } catch {
              // Tenta próxima URL candidata
              continue;
            }
          }

          console.warn(`[FACIAL MATCH IMAGE]: Não foi possível baixar foto remota após tentativas: ${str}`);
          return null;
        }

        // 3. Caso seja Base64 puro (sem o prefixo data:)
        const cleanedStr = str.replace(/\s+/g, '');
        if (/^[A-Za-z0-9+/=]+$/.test(cleanedStr) && cleanedStr.length > 100) {
          return {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanedStr,
            },
          };
        }

        return null;
      }

      // 1. Resolve a foto alvo do abordado
      const targetInlineObj = await resolveInlinePhoto(targetPhoto);
      if (!targetInlineObj) {
        return res.status(200).json({
          status: 'error',
          message: 'A foto do abordado não pôde ser convertida. Capture novamente pela câmera ou envie uma imagem válida.',
        });
      }

      // 2. Resolve todas as fotos dos candidatos em paralelo com limite de concorrência
      const resolvedCandidates = await Promise.all(
        candidatesToProcess.map(async (c) => {
          const inlineObj = c.photo ? await resolveInlinePhoto(c.photo) : null;
          return {
            candidate: c,
            inlineObj,
          };
        })
      );

      // Filtra candidatos que têm foto biométrica válida
      const validCandidatesWithPhoto = resolvedCandidates.filter(
        (item): item is { candidate: typeof item.candidate; inlineObj: NonNullable<typeof item.inlineObj> } =>
          item.inlineObj !== null
      );

      if (validCandidatesWithPhoto.length === 0) {
        return res.status(200).json({
          status: 'error',
          message:
            'Nenhum dos candidatos selecionados possui foto acessível no momento para realizar a análise comparativa.',
        });
      }

      const contentsPayload: any[] = [];
      contentsPayload.push({
        text: 'FOTO PRINCIPAL ALVO (Foto tirada do abordado na rua pela guarnição):',
      });
      contentsPayload.push(targetInlineObj);

      contentsPayload.push({
        text: `FOTOS DOS CANDIDATOS DO BANCO DE DADOS (${validCandidatesWithPhoto.length} cadastros com foto carregada):`,
      });

      for (let idx = 0; idx < validCandidatesWithPhoto.length; idx++) {
        const item = validCandidatesWithPhoto[idx];
        const c = item.candidate;
        contentsPayload.push({
          text: `[CANDIDATO #${idx + 1}] ID: "${c.id}" | Nome: "${c.nome}" | Alcunha: "${c.alcunha || 'Sem vulgo'}" | RG: "${c.rg || ''}"`,
        });
        contentsPayload.push(item.inlineObj);
      }

      const comparisonPrompt = `Você é um perito em biometria forense e identificação facial tática da Polícia Militar.
Sua missão é realizar o confronto antropométrico e visual minucioso da FOTO PRINCIPAL ALVO (abordado na rua) com cada um dos CANDIDATOS cadastrados.

DIRETRIZES DE AVALIAÇÃO BIOMÉTRICA:
1. Analise proporções craniofaciais (largura facial, linha mandibular, queixo, maçãs do rosto).
2. Região ocular (distância interpupilar, formato e curvatura das sobrancelhas, cantos dos olhos).
3. Região nasal (dorso nasal, largura das asas do nariz, formato da ponta).
4. Região bucal e lábios (espessura, arco do cupido, comissuras labiais).
5. Orelhas (formato dos lóbulos, inserção) e sinais particulares (cicatrizes, sinais, assimetrias).

CLASSIFICAÇÃO OBRIGATÓRIA DOS NÍVEIS DE COMPATIBILIDADE:
Para cada candidato, você DEVE classificar estritamente em um dos 3 níveis:
- "ALTA" (pontuação de 80% a 99%): Elevada correspondência nas proporções biométricas fundamentais e traços característicos.
- "MODERADA" (pontuação de 50% a 79%): Traços fisionômicos semelhantes, com possíveis variações por ângulo, iluminação, ganho/perda de peso ou idade.
- "BAIXA" (pontuação menor que 50%): Discrepâncias anatômicas evidentes ou fisionomia distinta.

TERMO DE RESGUARDO OBRIGATÓRIO:
No campo avisoResguardo, declare taxativamente:
"Resultado probabilístico por inteligência artificial. A confirmação da identidade civil DEVE ser realizada obrigatoriamente pelo agente/policial in loco mediante conferência direta de sinais característicos, tatuagens e documentação."

Retorne os resultados ordenados pelo percentual de compatibilidade decrescente (maior compatibilidade primeiro).`;

      contentsPayload.push({ text: comparisonPrompt });

      // Modelos multimodais oficiais com suporte nativo a visão computacional e velocidade em rede móvel
      const candidateModels = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
      ];
      let lastError: any = null;
      let response: any = null;

      for (let i = 0; i < candidateModels.length; i++) {
        const modelName = candidateModels[i];
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contentsPayload,
            config: {
              systemInstruction:
                'Você é um assistente pericial de identificação e comparação facial da Polícia Militar. Retorne a análise biométrica estritamente em formato JSON estruturado com os 3 níveis de compatibilidade: ALTA, MODERADA ou BAIXA.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  matches: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        candidateId: { type: Type.STRING },
                        candidateNome: { type: Type.STRING },
                        candidateAlcunha: { type: Type.STRING },
                        percentual: { type: Type.INTEGER, description: 'Percentual de 0 a 100' },
                        nivel: {
                          type: Type.STRING,
                          enum: ['ALTA', 'MODERADA', 'BAIXA'],
                          description: 'Nível de compatibilidade: ALTA (>=80%), MODERADA (50-79%), BAIXA (<50%)',
                        },
                        resumoDiagnostico: { type: Type.STRING, description: 'Resumo da semelhança fisionômica' },
                        pontosCoincidentes: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: 'Traços anatômicos coincidentes',
                        },
                        pontosDivergentes: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: 'Divergências ou variações encontradas',
                        },
                        recomendacaoTatica: {
                          type: Type.STRING,
                          description: 'Ação recomendada para conferência in loco pelo agente',
                        },
                        avisoResguardo: {
                          type: Type.STRING,
                          description: 'Aviso de resguardo sobre conferência in loco obrigatória',
                        },
                      },
                      required: [
                        'candidateId',
                        'percentual',
                        'nivel',
                        'resumoDiagnostico',
                        'pontosCoincidentes',
                        'pontosDivergentes',
                        'recomendacaoTatica',
                        'avisoResguardo',
                      ],
                    },
                  },
                },
                required: ['matches'],
              },
            },
          });

          if (response && response.text) {
            break;
          }
        } catch (callErr: any) {
          lastError = callErr;
          console.log(`[FACIAL MATCH AI]: Modelo ${modelName} falhou (${callErr?.message || callErr}). Tentando alternativo...`);
          await new Promise((r) => setTimeout(r, 600 * (i + 1)));
        }
      }


      if (!response || !response.text) {
        throw lastError || new Error('Serviço de análise facial temporariamente indisponível.');
      }

      let cleanText = (response.text || '{}').trim();
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      let parsed: any = {};
      try {
        parsed = JSON.parse(cleanText);
      } catch (parseErr) {
        const match = cleanText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        }
      }

      let matches = parsed.matches || [];

      // Enriquece com dados originais dos candidatos (fotos, RG, etc.)
      const candidateMap = new Map(candidatesToProcess.map((c) => [c.id, c]));
      matches = matches.map((m: any) => {
        const orig = candidateMap.get(m.candidateId);
        return {
          ...m,
          candidateNome: orig?.nome || m.candidateNome || 'Indivíduo Cadastrado',
          candidateAlcunha: orig?.alcunha || m.candidateAlcunha || '',
          candidateRg: orig?.rg || '',
          candidateFoto: orig?.photo || '',
        };
      });

      // Ordena decrescente por percentual
      matches.sort((a: any, b: any) => (b.percentual || 0) - (a.percentual || 0));

      return res.json({
        status: 'success',
        matches,
      });
    } catch (err: any) {
      console.error('[SERVER /api/ai/facial-match ERROR]:', err);
      return res.status(200).json({
        status: 'error',
        message: err?.message || 'Erro ao processar identificação facial por IA.',
      });
    }
  });

  // ============================================================================
  // FRONTEND SPA SERVING (Vite Middleware em Dev, Static em Prod)
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Banco de Dados Operacional] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer();
