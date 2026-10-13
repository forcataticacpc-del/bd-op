/**
 * ====================================================================
 * FORÇA TÁTICA CPC - CLOUDFLARE WORKER REST API (D1 SQL + R2 FOTOS)
 * ====================================================================
 * Arquitetura de altíssimo desempenho, baixa latência e segurança.
 */

// Declaração de tipos para ambientes sem @cloudflare/workers-types instalado
type D1Database = any;
type R2Bucket = any;

export interface Env {
  DB: D1Database;
  PHOTOS_BUCKET?: R2Bucket;
  API_KEY?: string;
}

// Cabeçalhos CORS padrão
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      ...corsHeaders,
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // 1. Tratamento de Preflight CORS
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      const pathname = url.pathname;

      // -------------------------------------------------------------
      // HEALTH CHECK & PING & AUTO SCHEMA INIT
      // -------------------------------------------------------------
      if (pathname === '/' || pathname === '/api/health' || pathname === '/api/init-schema') {
        let dbOk = false;
        let totalCount = 0;
        try {
          if (env.DB) {
            // Auto-criação de tabelas caso ainda não existam no D1
            try {
              if (typeof env.DB.exec === 'function') {
                await env.DB.exec(`
                  CREATE TABLE IF NOT EXISTS suspects (
                    id TEXT PRIMARY KEY,
                    nome TEXT NOT NULL,
                    mae TEXT,
                    dataNasc TEXT,
                    rg TEXT,
                    cpf TEXT,
                    endereco TEXT,
                    enderecos TEXT,
                    codigo TEXT,
                    alcunha TEXT,
                    artigo TEXT,
                    artigos TEXT,
                    marcador TEXT DEFAULT 'NENHUM',
                    localAbordagem TEXT,
                    horaAbordagem TEXT,
                    coordenadas TEXT,
                    bpm TEXT,
                    observacoes TEXT,
                    fotos TEXT,
                    dataCriacao TEXT NOT NULL,
                    dataAtualizacao TEXT,
                    dataAlteracaoFoto TEXT,
                    alterado TEXT,
                    autorCriacaoLogin TEXT,
                    autorCriacaoNome TEXT,
                    autorAlteracaoLogin TEXT,
                    autorAlteracaoNome TEXT
                  );
                  CREATE TABLE IF NOT EXISTS orcrims (
                    id TEXT PRIMARY KEY,
                    nome TEXT NOT NULL,
                    sigla TEXT NOT NULL,
                    origem TEXT,
                    dataSurgimento TEXT,
                    coresSimbolos TEXT,
                    territorios TEXT,
                    atividadesCriminosas TEXT,
                    periculosidade TEXT DEFAULT 'ALTA',
                    status TEXT DEFAULT 'ATIVA',
                    liderPrincipal TEXT,
                    membros TEXT,
                    observacoes TEXT,
                    dataCriacao TEXT NOT NULL,
                    dataAtualizacao TEXT
                  );
                  CREATE TABLE IF NOT EXISTS app_users (
                    login TEXT PRIMARY KEY,
                    nome TEXT NOT NULL,
                    senha TEXT NOT NULL,
                    postoGraduacao TEXT,
                    batalhaoUnidade TEXT,
                    perfil TEXT DEFAULT 'OPERADOR_TATICO',
                    status TEXT DEFAULT 'ATIVO',
                    mustChangePassword INTEGER DEFAULT 1,
                    permissoes TEXT,
                    criadoEm TEXT NOT NULL,
                    ultimoAcesso TEXT
                  );
                  CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                  );
                `);
              }
            } catch (_) {}

            let queryError: string | null = null;
            try {
              const res = (await env.DB.prepare('SELECT COUNT(*) as count FROM suspects').first()) as any;
              totalCount = res?.count || 0;
              dbOk = true;
            } catch (err: any) {
              queryError = err?.message || String(err);
            }

            let dbStatus = 'D1 Conectado';
            if (!dbOk) {
              dbStatus = queryError ? `Tabelas ausentes (${queryError})` : 'Aguardando inicialização do schema';
            }

            return jsonResponse({
              status: 'ok',
              service: 'Força Tática CPC - Cloudflare API',
              database: dbStatus,
              d1BindingPresente: true,
              totalSuspects: totalCount,
              r2Storage: env.PHOTOS_BUCKET ? 'Ativo' : 'Não configurado (usando base64)',
              timestamp: new Date().toISOString(),
            });
          }
        } catch (e: any) {
          return jsonResponse({
            status: 'ok',
            service: 'Força Tática CPC - Cloudflare API',
            database: `Erro ao acessar D1: ${e?.message || e}`,
            d1BindingPresente: !!env.DB,
            timestamp: new Date().toISOString()
          });
        }

        return jsonResponse({
          status: 'ok',
          service: 'Força Tática CPC - Cloudflare API',
          database: 'ERRO: Binding D1 com o nome "DB" não está vinculado no Worker!',
          d1BindingPresente: false,
          instrucao: 'Vá em Workers -> Settings -> Variables and Bindings -> D1 Database Bindings -> Adicione DB apontando para forca_tatica_db',
          timestamp: new Date().toISOString()
        });
      }

      // -------------------------------------------------------------
      // SERVIR FOTOS DO R2: GET /api/photo/:key
      // -------------------------------------------------------------
      if (pathname.startsWith('/api/photo/') && method === 'GET') {
        const photoKey = pathname.replace('/api/photo/', '');
        if (!photoKey || !env.PHOTOS_BUCKET) {
          return new Response('Foto não encontrada ou R2 desativado', { status: 404 });
        }

        const object = await env.PHOTOS_BUCKET.get(photoKey);
        if (!object) {
          return new Response('Imagem não encontrada', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
      }

      // -------------------------------------------------------------
      // UPLOAD DE FOTOS: POST /api/upload-photo
      // -------------------------------------------------------------
      if (pathname === '/api/upload-photo' && method === 'POST') {
        const body = await request.json() as { base64?: string; filename?: string; mimeType?: string };
        const { base64, filename, mimeType = 'image/jpeg' } = body || {};

        if (!base64) {
          return errorResponse('Nenhuma imagem enviada em base64.');
        }

        // Se o R2 estiver configurado, salva no bucket
        if (env.PHOTOS_BUCKET) {
          const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
          const binaryData = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
          const fileId = filename || `foto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;

          await env.PHOTOS_BUCKET.put(fileId, binaryData, {
            httpMetadata: { contentType: mimeType },
          });

          const photoUrl = `${url.origin}/api/photo/${fileId}`;
          return jsonResponse({
            success: true,
            photoUrl,
            key: fileId,
          });
        }

        // Fallback: retorna o próprio base64 se R2 não estiver ativo
        return jsonResponse({
          success: true,
          photoUrl: base64,
          notice: 'Foto salva em formato base64 direto.',
        });
      }

      // -------------------------------------------------------------
      // BUSCA E LISTAGEM: GET /api/suspects
      // -------------------------------------------------------------
      if (pathname === '/api/suspects' && method === 'GET') {
        const termo = (url.searchParams.get('termo') || url.searchParams.get('q') || '').trim();
        const marcador = url.searchParams.get('marcador') || '';
        const limit = parseInt(url.searchParams.get('limit') || '500', 10);

        let query = 'SELECT * FROM suspects WHERE 1=1';
        const params: any[] = [];

        if (termo) {
          query += ` AND (
            nome LIKE ? OR 
            alcunha LIKE ? OR 
            rg LIKE ? OR 
            cpf LIKE ? OR 
            mae LIKE ? OR 
            endereco LIKE ? OR 
            artigo LIKE ? OR 
            observacoes LIKE ?
          )`;
          const wildcard = `%${termo}%`;
          params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
        }

        if (marcador && marcador !== 'TODOS') {
          if (marcador === 'SEM_MARCADOR') {
            query += " AND (marcador IS NULL OR marcador = 'NENHUM' OR marcador = '')";
          } else {
            query += ' AND marcador = ?';
            params.push(marcador);
          }
        }

        query += ' ORDER BY dataCriacao DESC LIMIT ?';
        params.push(limit);

        const stmt = env.DB.prepare(query).bind(...params);
        const { results } = await stmt.all();

        // Deserializa campos JSON (fotos, enderecos, artigos)
        const parsed = (results || []).map((row: any) => {
          let fotos: string[] = [];
          let enderecos: string[] = [];
          let artigos: string[] = [];

          try { fotos = JSON.parse(row.fotos || '[]'); } catch (_) { fotos = row.fotos ? [row.fotos] : []; }
          try { enderecos = JSON.parse(row.enderecos || '[]'); } catch (_) { enderecos = row.endereco ? [row.endereco] : []; }
          try { artigos = JSON.parse(row.artigos || '[]'); } catch (_) { artigos = row.artigo ? [row.artigo] : []; }

          let coords: { lat: number; lng: number } | undefined;
          if (row.coordenadas && row.coordenadas.includes(',')) {
            const [latStr, lngStr] = row.coordenadas.split(',');
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            if (!isNaN(lat) && !isNaN(lng)) {
              coords = { lat, lng };
            }
          }

          return {
            ...row,
            fotos,
            enderecos,
            artigos,
            localAbordagemCoords: coords,
          };
        });

        return jsonResponse({
          success: true,
          status: 'success',
          total: parsed.length,
          data: parsed,
        });
      }

      // -------------------------------------------------------------
      // OBTER UM SUSPEITO: GET /api/suspects/:id
      // -------------------------------------------------------------
      if (pathname.startsWith('/api/suspects/') && method === 'GET') {
        const id = pathname.replace('/api/suspects/', '');
        const row = (await env.DB.prepare('SELECT * FROM suspects WHERE id = ?').bind(id).first()) as any;

        if (!row) {
          return errorResponse('Registro não encontrado', 404);
        }

        let fotos: string[] = [];
        try { fotos = JSON.parse(row.fotos || '[]'); } catch (_) { fotos = row.fotos ? [row.fotos] : []; }

        return jsonResponse({
          success: true,
          data: { ...row, fotos },
        });
      }

      // -------------------------------------------------------------
      // CRIAR NOVO SUSPEITO: POST /api/suspects
      // -------------------------------------------------------------
      if (pathname === '/api/suspects' && method === 'POST') {
        const body = await request.json() as any;
        const record = body?.record || body;

        if (!record || !record.nome) {
          return errorResponse('O campo Nome é obrigatório.');
        }

        const id = record.id || `ft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const fotosJson = JSON.stringify(record.fotos || []);
        const enderecosJson = JSON.stringify(record.enderecos || []);
        const artigosJson = JSON.stringify(record.artigos || []);
        const now = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO suspects (
            id, nome, mae, dataNasc, rg, cpf, endereco, enderecos, codigo, 
            alcunha, artigo, artigos, marcador, localAbordagem, horaAbordagem, coordenadas, 
            bpm, observacoes, fotos, dataCriacao, dataAtualizacao, alterado,
            autorCriacaoLogin, autorCriacaoNome
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          record.nome || '',
          record.mae || '',
          record.dataNasc || '',
          record.rg || '',
          record.cpf || '',
          record.endereco || '',
          enderecosJson,
          record.codigo || '',
          record.alcunha || '',
          record.artigo || '',
          artigosJson,
          record.marcador || 'NENHUM',
          record.localAbordagem || '',
          record.horaAbordagem || '',
          record.coordenadas || '',
          record.bpm || '',
          record.observacoes || '',
          fotosJson,
          record.dataCriacao || now,
          now,
          record.alterado || '',
          record.autorCriacaoLogin || '',
          record.autorCriacaoNome || ''
        ).run();

        return jsonResponse({
          success: true,
          status: 'success',
          message: 'Registro cadastrado com sucesso no Cloudflare D1',
          id,
        });
      }

      // -------------------------------------------------------------
      // EDITAR SUSPEITO: PUT /api/suspects/:id
      // -------------------------------------------------------------
      if (pathname.startsWith('/api/suspects/') && method === 'PUT') {
        const id = pathname.replace('/api/suspects/', '');
        const body = await request.json() as any;
        const record = body?.record || body;

        const fotosJson = JSON.stringify(record.fotos || []);
        const enderecosJson = JSON.stringify(record.enderecos || []);
        const artigosJson = JSON.stringify(record.artigos || []);
        const now = new Date().toISOString();

        await env.DB.prepare(`
          UPDATE suspects SET
            nome = ?, mae = ?, dataNasc = ?, rg = ?, cpf = ?,
            endereco = ?, enderecos = ?, codigo = ?, alcunha = ?,
            artigo = ?, artigos = ?, marcador = ?, localAbordagem = ?, horaAbordagem = ?,
            coordenadas = ?, bpm = ?, observacoes = ?, fotos = ?,
            dataAtualizacao = ?, alterado = ?,
            autorAlteracaoLogin = ?, autorAlteracaoNome = ?
          WHERE id = ?
        `).bind(
          record.nome || '',
          record.mae || '',
          record.dataNasc || '',
          record.rg || '',
          record.cpf || '',
          record.endereco || '',
          enderecosJson,
          record.codigo || '',
          record.alcunha || '',
          record.artigo || '',
          artigosJson,
          record.marcador || 'NENHUM',
          record.localAbordagem || '',
          record.horaAbordagem || '',
          record.coordenadas || '',
          record.bpm || '',
          record.observacoes || '',
          fotosJson,
          now,
          record.alterado || 'Card Editado',
          record.autorAlteracaoLogin || '',
          record.autorAlteracaoNome || '',
          id
        ).run();

        return jsonResponse({
          success: true,
          status: 'success',
          message: 'Registro atualizado com sucesso no Cloudflare D1',
          id,
        });
      }

      // -------------------------------------------------------------
      // EXCLUIR SUSPEITO: DELETE /api/suspects/:id
      // -------------------------------------------------------------
      if (pathname.startsWith('/api/suspects/') && method === 'DELETE') {
        const id = pathname.replace('/api/suspects/', '');
        await env.DB.prepare('DELETE FROM suspects WHERE id = ?').bind(id).run();

        return jsonResponse({
          success: true,
          status: 'success',
          message: 'Registro removido com sucesso do Cloudflare D1',
          id,
        });
      }

      // -------------------------------------------------------------
      // MIGRAÇÃO / SINCRONIZAÇÃO EM MASSA: POST /api/batch-sync
      // -------------------------------------------------------------
      if (pathname === '/api/batch-sync' && method === 'POST') {
        const body = await request.json() as { records?: any[] };
        const records = body?.records || [];

        if (!Array.isArray(records) || records.length === 0) {
          return errorResponse('Nenhum registro recebido para sincronização em massa.');
        }

        let inserted = 0;
        let updated = 0;

        for (const record of records) {
          if (!record.id || !record.nome) continue;

          const existing = await env.DB.prepare('SELECT id FROM suspects WHERE id = ?').bind(record.id).first();
          const fotosJson = JSON.stringify(record.fotos || []);
          const enderecosJson = JSON.stringify(record.enderecos || []);
          const artigosJson = JSON.stringify(record.artigos || []);
          const now = new Date().toISOString();

          if (existing) {
            await env.DB.prepare(`
              UPDATE suspects SET
                nome = ?, mae = ?, dataNasc = ?, rg = ?, cpf = ?,
                endereco = ?, enderecos = ?, codigo = ?, alcunha = ?,
                artigo = ?, artigos = ?, marcador = ?, localAbordagem = ?,
                coordenadas = ?, bpm = ?, observacoes = ?, fotos = ?,
                dataAtualizacao = ?, alterado = ?
              WHERE id = ?
            `).bind(
              record.nome || '',
              record.mae || '',
              record.dataNasc || '',
              record.rg || '',
              record.cpf || '',
              record.endereco || '',
              enderecosJson,
              record.codigo || '',
              record.alcunha || '',
              record.artigo || '',
              artigosJson,
              record.marcador || 'NENHUM',
              record.localAbordagem || '',
              record.coordenadas || '',
              record.bpm || '',
              record.observacoes || '',
              fotosJson,
              now,
              record.alterado || '',
              record.id
            ).run();
            updated++;
          } else {
            await env.DB.prepare(`
              INSERT INTO suspects (
                id, nome, mae, dataNasc, rg, cpf, endereco, enderecos, codigo, 
                alcunha, artigo, artigos, marcador, localAbordagem, coordenadas, 
                bpm, observacoes, fotos, dataCriacao, dataAtualizacao, alterado
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              record.id,
              record.nome || '',
              record.mae || '',
              record.dataNasc || '',
              record.rg || '',
              record.cpf || '',
              record.endereco || '',
              enderecosJson,
              record.codigo || '',
              record.alcunha || '',
              record.artigo || '',
              artigosJson,
              record.marcador || 'NENHUM',
              record.localAbordagem || '',
              record.coordenadas || '',
              record.bpm || '',
              record.observacoes || '',
              fotosJson,
              record.dataCriacao || now,
              now,
              record.alterado || ''
            ).run();
            inserted++;
          }
        }

        return jsonResponse({
          success: true,
          status: 'success',
          message: `Sincronização concluída: ${inserted} inseridos, ${updated} atualizados.`,
          inserted,
          updated,
          total: records.length,
        });
      }

      // 404 para rotas desconhecidas
      return errorResponse(`Rota não encontrada: ${method} ${pathname}`, 404);
    } catch (err: any) {
      console.error('Cloudflare Worker Error:', err);
      return errorResponse(`Erro interno no Worker: ${err?.message || String(err)}`, 500);
    }
  },
};
