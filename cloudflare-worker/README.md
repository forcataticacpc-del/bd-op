# 🛡️ FORÇA TÁTICA CPC - API CLOUDFLARE WORKER (D1 SQL + R2)

Backend em nuvem de **altíssimo desempenho e baixíssima latência** para o aplicativo da Força Tática CPC.

---

## 🚀 Passo a Passo Rápido de Implantação (Menos de 3 Minutos)

### Método 1: Pelo Terminal com Wrangler (Recomendado)

1. **Instale o Wrangler** (se ainda não tiver):
   ```bash
   npm install -g wrangler
   ```

2. **Faça login na sua conta Cloudflare gratuita**:
   ```bash
   npx wrangler login
   ```

3. **Crie o Banco de Dados D1**:
   ```bash
   npx wrangler d1 create forca_tatica_db
   ```
   *O terminal exibirá o `database_id`. Copie e cole esse ID dentro do arquivo `wrangler.toml` no campo `database_id`.*

4. **Aplique o Schema do Banco de Dados (cria as tabelas e índices)**:
   ```bash
   npx wrangler d1 execute forca_tatica_db --file=schema.sql --remote
   ```

5. **(Opcional) Crie o Bucket de Fotos R2**:
   ```bash
   npx wrangler r2 bucket create forca-tatica-fotos
   ```

6. **Faça o Deploy do Worker na Nuvem**:
   ```bash
   npx wrangler deploy
   ```

7. **Pronto!** O Cloudflare fornecerá uma URL pública, por exemplo:
   `https://forca-tatica-api.seu-nome.workers.dev`

8. Abra o aplicativo da Força Tática -> **Ajustes** -> **Conexão Cloudflare** -> Cole essa URL e clique em **Salvar e Testar**.

---

### Método 2: Diretamente pelo Painel Web do Cloudflare (Sem Terminal)

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) e entre na sua conta.
2. No menu esquerdo, vá em **Workers & Pages** -> **Create application** -> **Create Worker**.
3. Dê o nome de `forca-tatica-api` e clique em **Deploy**.
4. Clique em **Edit code**, apague o código de exemplo e cole o conteúdo de `src/index.ts`.
5. Vá em **Settings** -> **Variables and Bindings**:
   - Adicione o binding D1 com o nome da variável `DB` apontando para o seu banco `forca_tatica_db`.
6. Salve e implante!

---

## 📡 Endpoints Disponíveis

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Status da API, conexão D1 e contagem total |
| `GET` | `/api/suspects` | Lista todos ou filtra com `?termo=...&marcador=...` |
| `GET` | `/api/suspects/:id` | Retorna os detalhes de um abordado |
| `POST` | `/api/suspects` | Cria um novo registro |
| `PUT` | `/api/suspects/:id` | Atualiza ficha e carimba data de alteração |
| `DELETE` | `/api/suspects/:id` | Remove o registro |
| `POST` | `/api/upload-photo` | Envia foto para o bucket R2 |
| `POST` | `/api/batch-sync` | Sincroniza todos os registros em massa de uma só vez |
