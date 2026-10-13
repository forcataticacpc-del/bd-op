# Força Tática - Sistema Operacional de Abordagens (CPC)

Aplicativo tático para registro, consulta e controle de abordados da Força Tática CPC, integrado com Google Sheets, Google Drive, busca avançada de bairros de Belo Horizonte, marcadores operacionais e extração inteligente via IA Gemini.

---

## 🚀 Como Executar no Visual Studio Code

### 1. Pré-requisitos
- **Node.js** (versão 18 ou superior): [https://nodejs.org](https://nodejs.org)
- **Visual Studio Code**: [https://code.visualstudio.com](https://code.visualstudio.com)

### 2. Passo a Passo

1. **Descompactar o arquivo ZIP** baixado do Google AI Studio em uma pasta no seu computador.
2. Abra o **Visual Studio Code**.
3. Vá em **File > Open Folder...** (Arquivo > Abrir Pasta...) e selecione a pasta do projeto.
4. Abra o terminal integrado no VS Code (`Ctrl + \`` ou `Terminal > New Terminal`).
5. Instale as dependências executando:
   ```bash
   npm install
   ```
6. (Opcional) Crie o arquivo `.env` a partir do modelo `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *Nota: Caso deseje utilizar extração por IA com o Gemini, insira sua chave `GEMINI_API_KEY` no arquivo `.env`.*

7. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
8. Abra o navegador em:
   ```
   http://localhost:3000
   ```

---

## 🛠️ Scripts Disponíveis

- `npm run dev`: Inicia o servidor full-stack (Express + Vite) com recarregamento em tempo real na porta 3000.
- `npm run build`: Compila a aplicação frontend (Vite) e o servidor backend (esbuild) para produção na pasta `dist/`.
- `npm run start`: Inicia a aplicação compilada em modo de produção.
- `npm run lint`: Executa a verificação estática de tipos com o TypeScript (`tsc --noEmit`).

---

## 📁 Estrutura do Projeto

- `/src`: Código-fonte da aplicação React (TypeScript e Tailwind CSS).
  - `/src/components`: Componentes visuais (Cards táticos, Modal de detalhes, Formulário de cadastro, Diálogo de filtros, etc.).
  - `/src/data`: Bases de dados de apoio (ex: Bairros oficiais de Belo Horizonte - MG).
  - `/src/utils`: Utilitários de sincronização (Google Sheets API, IndexedDB local, Tema Claro/Escuro, Extração IA).
- `server.ts`: Servidor Node.js / Express que atua como proxy seguro e ponte com Google Apps Script / Drive.
- `package.json`: Manifesto de dependências e comandos do projeto.
