import JSZip from 'jszip';
import { SuspectRecord } from '../types';

/**
 * Normaliza o nome do arquivo para evitar caracteres inválidos no sistema de arquivos.
 */
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 60);
}

/**
 * Cria a estrutura de dados padronizada e limpa do card para importação em outros bancos.
 */
export function formatSuspectForExport(suspect: SuspectRecord) {
  return {
    _formato: 'BANCO_DE_DADOS_OPERACIONAL_CARD_V1',
    _exportadoEm: new Date().toISOString(),
    id: suspect.id,
    dadosPessoais: {
      nome: suspect.nome,
      alcunha: suspect.alcunha || null,
      dataNascimento: suspect.dataNasc || null,
      rg: suspect.rg || null,
      cpf: suspect.cpf || null,
      mae: suspect.mae || null,
      pai: (suspect as any).pai || null,
    },
    enderecos: {
      principal: suspect.endereco || null,
      bairro: (suspect as any).bairro || null,
      cidade: (suspect as any).cidade || null,
      todosEnderecos: suspect.enderecos || (suspect.endereco ? [suspect.endereco] : []),
    },
    dadosOperacionais: {
      marcador: suspect.marcador || 'NENHUM',
      artigoPrincipal: suspect.artigo || null,
      artigos: suspect.artigos || (suspect.artigo ? [suspect.artigo] : []),
      localAbordagem: suspect.localAbordagem || null,
      horaAbordagem: suspect.horaAbordagem || null,
      coordenadas: suspect.coordenadas || null,
      bpm: suspect.bpm || null,
      observacoes: suspect.observacoes || null,
      alterado: suspect.alterado || null,
    },
    registrosMidia: {
      totalFotos: suspect.fotos ? suspect.fotos.length : 0,
      fotos: suspect.fotos || [],
      dataAlteracaoFoto: suspect.dataAlteracaoFoto || null,
    },
    vinculosRelacionamentos: {
      pessoasVinculadas: suspect.vinculosPessoas || [],
      faccaoAnotada: (suspect as any).faccao || null,
      funcaoFaccao: (suspect as any).funcaoFaccao || null,
    },
    metadadosSistema: {
      dataCriacao: suspect.dataCriacao,
      dataAtualizacao: suspect.dataAtualizacao || suspect.dataCriacao,
      autorCriacaoNome: suspect.autorCriacaoNome || null,
      autorCriacaoLogin: suspect.autorCriacaoLogin || null,
      autorAlteracaoNome: suspect.autorAlteracaoNome || null,
      autorAlteracaoLogin: suspect.autorAlteracaoLogin || null,
    },
  };
}

/**
 * Exporta um único card em formato JSON para importação direta em outro banco de dados.
 */
export function exportSingleCardJson(suspect: SuspectRecord): void {
  const data = formatSuspectForExport(suspect);
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanName = sanitizeFileName(suspect.nome || 'ABORDADO');
  const cleanRg = sanitizeFileName(suspect.rg || suspect.id);
  const fileName = `CARD_${cleanName}_${cleanRg}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta todos os cards consolidados em um único arquivo JSON estruturado.
 */
export function exportAllCardsConsolidatedJson(suspects: SuspectRecord[]): void {
  const payload = {
    sistema: 'Banco de Dados Operacional',
    versaoExportacao: '1.0.0',
    dataExportacao: new Date().toISOString(),
    totalRegistros: suspects.length,
    cards: suspects.map(formatSuspectForExport),
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.href = url;
  link.download = `BANCO_DE_DADOS_TODOS_OS_CARDS_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta todos os cards em um pacote ZIP contendo arquivos JSON individuais de cada card.
 * Ideal para migração ou importação modular card-a-card em outro banco de dados.
 */
export async function exportAllCardsIndividualZip(
  suspects: SuspectRecord[],
  onProgress?: (msg: string) => void
): Promise<void> {
  const zip = new JSZip();

  if (onProgress) onProgress('Preparando pastas do arquivo ZIP...');

  // Pasta para os cards individuais
  const folder = zip.folder('cards_individuais');

  // Adiciona cada card como um arquivo JSON individual
  suspects.forEach((suspect, idx) => {
    const formatted = formatSuspectForExport(suspect);
    const num = String(idx + 1).padStart(3, '0');
    const cleanName = sanitizeFileName(suspect.nome || `ABORDADO_${num}`);
    const cleanRg = sanitizeFileName(suspect.rg || suspect.id.slice(0, 6));
    const fileName = `${num}_${cleanName}_${cleanRg}.json`;

    folder?.file(fileName, JSON.stringify(formatted, null, 2));
  });

  // Adiciona também o arquivo consolidado de todos os cards
  const consolidado = {
    sistema: 'Banco de Dados Operacional',
    dataExportacao: new Date().toISOString(),
    totalCards: suspects.length,
    cards: suspects.map(formatSuspectForExport),
  };
  zip.file('TODOS_OS_CARDS_CONSOLIDADOS.json', JSON.stringify(consolidado, null, 2));

  // Adiciona documentação de esquema de importação
  const docLeiaMe = `===================================================================
BANCO DE DADOS OPERACIONAL - PACOTE DE EXPORTAÇÃO INDIVIDUAL DE CARDS
===================================================================
Data de Exportação: ${new Date().toLocaleString('pt-BR')}
Total de Cards Exportados: ${suspects.length} registros

CONTEÚDO DESTE PACOTE:
1. /cards_individuais/
   Contém 1 arquivo .JSON individual para cada abordado cadastrado.
   Cada arquivo contém todos os dados pessoais, vulgo, documentos, 
   endereços, artigos criminais, fotos em alta definição (base64/URL),
   vínculos e histórico operacional.

2. TODOS_OS_CARDS_CONSOLIDADOS.json
   Arquivo único contendo a lista completa de todos os cards em formato
   padronizado para importação direta em massa (MongoDB, PostgreSQL,
   Firebase Firestore, Cloudflare D1, SQLite, MySQL, etc.).

ESTRUTURA DOS CAMPOS DE CADA CARD (JSON):
- id: Identificador único universal do abordado
- dadosPessoais: { nome, alcunha, dataNascimento, rg, cpf, mae, pai }
- enderecos: { principal, bairro, cidade, todosEnderecos }
- dadosOperacionais: { marcador, artigoPrincipal, artigos, localAbordagem, horaAbordagem, coordenadas, bpm, observacoes }
- registrosMidia: { totalFotos, fotos: [base64_ou_urls], dataAlteracaoFoto }
- vinculosRelacionamentos: { pessoasVinculadas, faccaoAnotada, funcaoFaccao }
- metadadosSistema: { dataCriacao, dataAtualizacao, autorCriacaoNome, autorCriacaoLogin }

COMO IMPORTAR EM OUTRO BANCO DE DADOS:
- MongoDB: mongoimport --db operacoes --collection cards --file TODOS_OS_CARDS_CONSOLIDADOS.json --jsonArray
- Python / Node.js / SQL: Ler os arquivos da pasta cards_individuais e mapear os campos conforme seu modelo.
===================================================================`;

  zip.file('LEIA-ME_COMO_IMPORTAR_EM_OUTRO_BANCO.txt', docLeiaMe);

  if (onProgress) onProgress('Compactando pacote ZIP...');

  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  if (onProgress) onProgress('Download iniciando...');

  const dateStr = new Date().toISOString().split('T')[0];
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CARDS_INDIVIDUAIS_BANCO_DE_DADOS_${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
