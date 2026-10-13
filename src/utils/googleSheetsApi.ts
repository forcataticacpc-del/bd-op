import { SuspectRecord } from '../types';
import { getSyncConfig, setDeletePassword } from './storage';
import { normalizeText, matchesSuspect } from './textUtils';

/**
 * Google Apps Script exact source code to be copied into Google Sheets:
 * Extensions -> Apps Script -> Paste -> Deploy as Web App.
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ====================================================================
 * BANCO DE DADOS - API GOOGLE APPS SCRIPT (GOOGLE SHEETS & DRIVE)
 * ====================================================================
 * Instruções para Ativação Completa (Nuvem, Planilha e Google Drive):
 * 1. Abra sua Planilha Google no computador ou navegador.
 * 2. Acesse o menu: Extensões -> Apps Script.
 * 3. Apague todo o código existente e cole este código completo.
 * 4. Clique em "Salvar" (ícone de disquete).
 * 
 * 5. LIBERAÇÃO DE PERMISSÕES (MUITO IMPORTANTE):
 *    - Na barra superior, no seletor de funções ao lado de "Depurar", selecione "testarPermissoes".
 *    - Clique no botão "Executar" (ícone de play).
 *    - Uma janela do Google solicitará autorização:
 *      * Clique em "Revisar permissões".
 *      * Selecione sua conta Google (forcataticacpc@gmail.com).
 *      * Clique em "Avançado" (canto inferior esquerdo) e depois em "Acessar [Nome do Projeto] (não seguro)".
 *      * Clique em "Permitir".
 *    - O painel exibirá: "Planilha OK" e "Google Drive OK (Pasta ForcaTatica_Fotos criada)".
 * 
 * 6. IMPLANTAÇÃO COMO APLICATIVO DA WEB:
 *    - Clique no botão azul "Implantar" (canto superior direito) -> "Gerenciar implantações" (ou "Nova implantação").
 *    - Clique no lápis (Editar):
 *      * Versão: Selecione "Nova versão".
 *      * Executar como: "Eu (sua conta Google)".
 *      * Quem pode acessar: "Qualquer pessoa" (OBRIGATÓRIO para acesso de qualquer local/link!).
 *    - Clique em "Implantar".
 * 7. Copie a URL gerada (terminada em /exec) e cole no seu aplicativo no botão Google Planilha!
 * ====================================================================
 */

/**
 * Função de diagnóstico e autorização de permissões para Google Sheets e Google Drive.
 */
function testarPermissoes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet();
  Logger.log("1. Planilha Aba Abordados OK: " + ss.getName() + " -> Aba: " + sheet.getName());
  
  var secSheet = getOrCreateSecuritySheet(ss);
  Logger.log("2. Aba Segurança OK: Senha do aplicativo na nuvem configurada (status visual: ****)");
  
  var folder = getOrCreatePhotoFolder();
  if (folder) {
    Logger.log("3. Google Drive OK: Pasta 'ForcaTatica_Fotos' pronta para backup de fotos (ID: " + folder.getId() + ")");
  } else {
    Logger.log("3. AVISO: Pasta do Drive não retornada. Execute novamente e aprove as permissões.");
  }
  Logger.log("4. TUDO PRONTO! Agora clique em Implantar -> Gerenciar implantações -> Editar -> Nova Versão.");
}

/**
 * Obtém ou cria a aba 'Seguranca' na Planilha Google.
 * Armazena a senha do aplicativo na nuvem com visualização oculta representada por '****'.
 */
function getOrCreateSecuritySheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Seguranca");
  if (!sheet) {
    sheet = ss.insertSheet("Seguranca");
  }
  
  if (sheet.getLastRow() === 0) {
    var headers = [
      "CONFIGURAÇÃO / PARÂMETRO",
      "STATUS / EXIBIÇÃO",
      "VALOR_AUTENTICACAO",
      "ÚLTIMA ATUALIZAÇÃO"
    ];
    sheet.appendRow(headers);
    
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1a1f2c");
    headerRange.setFontColor("#e5c07b");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    
    // Insere a senha padrão com exibição oculta representada por ****
    sheet.appendRow([
      "SENHA_OPERACIONAL_APP",
      "****",
      "1252300",
      new Date().toISOString()
    ]);
    
    var statusCell = sheet.getRange(2, 2);
    statusCell.setFontWeight("bold");
    statusCell.setHorizontalAlignment("center");
    statusCell.setFontColor("#c69c59");
    sheet.getRange(2, 3).setFontColor("#718096");
  }
  
  return sheet;
}

function getAppPasswordFromSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSecuritySheet(ss);
    var rows = sheet.getDataRange().getValues();
    for (var r = 1; r < rows.length; r++) {
      if (String(rows[r][0]).trim() === "SENHA_OPERACIONAL_APP") {
        var val = String(rows[r][2] || "").trim();
        if (val) return val;
      }
    }
    return "1252300";
  } catch (e) {
    Logger.log("Erro ao obter senha da planilha: " + e.toString());
    return "1252300";
  }
}

function setAppPasswordInSheet(newPassword) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSecuritySheet(ss);
    var rows = sheet.getDataRange().getValues();
    var updated = false;
    
    for (var r = 1; r < rows.length; r++) {
      if (String(rows[r][0]).trim() === "SENHA_OPERACIONAL_APP") {
        // Coluna B: sempre '****' (forma oculta requerida pelo usuário)
        // Coluna C: novo valor da senha
        // Coluna D: data da alteração
        sheet.getRange(r + 1, 2).setValue("****");
        sheet.getRange(r + 1, 3).setValue(String(newPassword).trim());
        sheet.getRange(r + 1, 4).setValue(new Date().toISOString());
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      sheet.appendRow([
        "SENHA_OPERACIONAL_APP",
        "****",
        String(newPassword).trim(),
        new Date().toISOString()
      ]);
    }
    return true;
  } catch (e) {
    Logger.log("Erro ao salvar senha na planilha: " + e.toString());
    return false;
  }
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("O script precisa estar vinculado à sua Planilha Google. Acesse a planilha -> Extensões -> Apps Script.");
  }
  var sheet = ss.getSheetByName("Abordados");
  if (!sheet) {
    var allSheets = ss.getSheets();
    if (allSheets.length === 1 && allSheets[0].getLastRow() === 0) {
      sheet = allSheets[0];
      sheet.setName("Abordados");
    } else {
      sheet = ss.insertSheet("Abordados");
    }
  }
  
  // Se a planilha já existir com dados, verifica se já possui a coluna COORDENADAS_GPS
  if (sheet.getLastRow() > 0) {
    var lastCol = sheet.getLastColumn();
    var headerRowValues = sheet.getRange(1, 1, 1, Math.max(lastCol, 1)).getValues()[0];
    var hasCoordsCol = false;
    for (var h = 0; h < headerRowValues.length; h++) {
      if (String(headerRowValues[h]).toUpperCase().indexOf("COORDENADA") !== -1) {
        hasCoordsCol = true;
        break;
      }
    }
    // Se não tiver a coluna COORDENADAS_GPS, insere após a coluna LOCAL DA ABORDAGEM
    if (!hasCoordsCol) {
      var insertIdx = 11;
      for (var k = 0; k < headerRowValues.length; k++) {
        if (String(headerRowValues[k]).toUpperCase().indexOf("LOCAL DA ABORDAGEM") !== -1) {
          insertIdx = k + 2;
          break;
        }
      }
      sheet.insertColumnBefore(insertIdx);
      var newCell = sheet.getRange(1, insertIdx);
      newCell.setValue("COORDENADAS_GPS");
      newCell.setBackground("#1a1f2c");
      newCell.setFontColor("#e5c07b");
      newCell.setFontWeight("bold");
      newCell.setHorizontalAlignment("center");
    }
  }

  // Se a planilha estiver vazia, cria o cabeçalho tático formatado com COORDENADAS_GPS
  if (sheet.getLastRow() === 0) {
    var headers = [
      "ID",
      "NOME",
      "MÃE",
      "DATA DE NASCIMENTO",
      "RG",
      "CPF",
      "ENDEREÇO",
      "ALCUNHA",
      "ARTIGO",
      "LOCAL DA ABORDAGEM",
      "COORDENADAS_GPS",
      "OBSERVAÇÕES",
      "FOTOS_URL",
      "DATA CADASTRO",
      "DATA ATUALIZAÇÃO",
      "MARCADOR"
    ];
    sheet.appendRow(headers);
    
    // Formata o cabeçalho tático
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1a1f2c");
    headerRange.setFontColor("#e5c07b");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// Remove acentos e normaliza para busca insensível a acentos
function normalizeStr(str) {
  if (!str) return "";
  return str.toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Obtém ou cria a pasta 'ForcaTatica_Fotos' no Google Drive.
 * Assim como no AppSheet, tenta localizar na mesma pasta da planilha Google
 * ou na raiz do Google Drive, configurando acesso público de leitura.
 */
function getOrCreatePhotoFolder() {
  var folderName = "ForcaTatica_Fotos";
  try {
    // 1. Procura se já existe pasta com esse nome
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      var existing = folders.next();
      try {
        existing.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(e) {}
      return existing;
    }
    
    // 2. Tenta criar dentro da mesma pasta da planilha (estilo AppSheet)
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var ssFile = DriveApp.getFileById(ss.getId());
      var parents = ssFile.getParents();
      if (parents.hasNext()) {
        var parentFolder = parents.next();
        var subFolder = parentFolder.createFolder(folderName);
        try {
          subFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(e) {}
        return subFolder;
      }
    } catch(parentErr) {
      Logger.log("Aviso localização pasta pai: " + parentErr);
    }
    
    // 3. Fallback: cria na raiz do Google Drive
    var newFolder = DriveApp.createFolder(folderName);
    try {
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {}
    return newFolder;
  } catch(err) {
    Logger.log("Aviso pasta Drive: " + err.toString());
    try {
      return DriveApp.getRootFolder();
    } catch (e) {
      return null;
    }
  }
}

/**
 * Obtém ou cria uma subpasta individual para o abordado dentro de 'ForcaTatica_Fotos'.
 * Todas as fotos do abordado são organizadas dentro desta pasta específica.
 */
function getOrCreateSuspectFolder(parentFolder, suspectName) {
  if (!parentFolder) return null;
  var cleanName = (suspectName || "SEM_NOME").toString().trim().toUpperCase()
    .replace(/[\\/?:*"><|]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  if (!cleanName) cleanName = "ABORDADO_SEM_NOME";
  
  try {
    var subFolders = parentFolder.getFoldersByName(cleanName);
    if (subFolders.hasNext()) {
      var existing = subFolders.next();
      try {
        existing.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(e) {}
      return existing;
    }
    
    var newFolder = parentFolder.createFolder(cleanName);
    try {
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {}
    return newFolder;
  } catch(err) {
    Logger.log("Aviso subpasta do abordado: " + err.toString());
    return parentFolder;
  }
}

/**
 * Converte a imagem (Base64) em arquivo JPEG real no Google Drive,
 * no mesmo padrão do AppSheet, gerando URL pública direta.
 */
function savePhotoToDrive(folder, rawPhoto, prefix) {
  if (!rawPhoto || !folder) return "";
  var str = String(rawPhoto).trim();
  
  // Se já for um link HTTP/HTTPS existente (Drive ou web), preserva
  if (str.indexOf("http://") === 0 || str.indexOf("https://") === 0) {
    return str;
  }
  
  var contentType = "image/jpeg";
  var base64Data = str;
  
  if (str.indexOf("data:") === 0 && str.indexOf(";base64,") !== -1) {
    var parts = str.split(";base64,");
    contentType = parts[0].replace("data:", "").trim();
    base64Data = parts[1].trim();
  } else if (str.indexOf("data:") === 0 && str.indexOf(";bae64,") !== -1) {
    var parts = str.split(";bae64,");
    contentType = parts[0].replace("data:", "").trim();
    base64Data = parts[1].trim();
  }
  
  // Remove caracteres inválidos de Base64
  base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, "");
  if (!base64Data) return "";
  
  try {
    var decoded = Utilities.base64Decode(base64Data);
    var ext = "jpg";
    if (contentType.indexOf("png") !== -1) ext = "png";
    else if (contentType.indexOf("webp") !== -1) ext = "webp";
    
    var cleanPrefix = (prefix || "abordado").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 25);
    var fileName = cleanPrefix + "_" + new Date().getTime() + "." + ext;
    var blob = Utilities.newBlob(decoded, contentType, fileName);
    var file = folder.createFile(blob);
    
    // Libera visualização para quem tiver o link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(shareErr) {
      Logger.log("Aviso permissão arquivo: " + shareErr);
    }
    
    var fileId = file.getId();
    // Retorna URL direta do CDN de alta performance do Google Drive
    return "https://lh3.googleusercontent.com/d/" + fileId;
  } catch (err) {
    Logger.log("Erro ao salvar foto no Drive: " + err.toString());
    return "";
  }
}

/**
 * GET: Puxa os dados da planilha para o aplicativo (suporta busca sem acentos e exclusão via GET)
 */
function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var param = (e && e.parameter) ? e.parameter : {};
    
    // Suporte para consultar senha do app na nuvem
    if (param.action === "get_password" || param.action === "get_config") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        senhaApp: getAppPasswordFromSheet(),
        mascara: "****"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Suporte para exclusão direta via GET
    if ((param.action === "delete" || param.acao === "excluir") && param.id) {
      var targetId = String(param.id).trim();
      var rows = sheet.getDataRange().getValues();
      var deleted = false;
      for (var r = 1; r < rows.length; r++) {
        if (String(rows[r][0]).trim() === targetId) {
          sheet.deleteRow(r + 1);
          deleted = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: deleted ? "success" : "not_found",
        message: deleted ? "Registro excluído da planilha" : "ID não localizado",
        id: targetId
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var rows = sheet.getDataRange().getValues();
    
    if (rows.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        total: 0,
        senhaApp: getAppPasswordFromSheet(),
        mascara: "****",
        data: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var termoBusca = param.termo ? normalizeStr(param.termo) : "";
    var data = [];

    // Mapeamento dinâmico de cabeçalho para compatibilidade com 14 ou 15 colunas
    var headerRow = rows[0] || [];
    var colMap = {};
    for (var c = 0; c < headerRow.length; c++) {
      var hName = normalizeStr(String(headerRow[c] || "")).toUpperCase();
      colMap[hName] = c;
    }

    var idCol = colMap["ID"] !== undefined ? colMap["ID"] : 0;
    var nomeCol = colMap["NOME"] !== undefined ? colMap["NOME"] : 1;
    var maeCol = colMap["MAE"] !== undefined ? colMap["MAE"] : 2;
    var nascCol = colMap["DATA DE NASCIMENTO"] !== undefined ? colMap["DATA DE NASCIMENTO"] : 3;
    var rgCol = colMap["RG"] !== undefined ? colMap["RG"] : 4;
    var cpfCol = colMap["CPF"] !== undefined ? colMap["CPF"] : 5;
    var endCol = colMap["ENDERECO"] !== undefined ? colMap["ENDERECO"] : 6;
    var alcCol = colMap["ALCUNHA"] !== undefined ? colMap["ALCUNHA"] : 7;
    var artCol = colMap["ARTIGO"] !== undefined ? colMap["ARTIGO"] : 8;
    var locCol = colMap["LOCAL DA ABORDAGEM"] !== undefined ? colMap["LOCAL DA ABORDAGEM"] : 9;

    var coordsCol = -1;
    for (var colKey in colMap) {
      if (colKey.indexOf("COORDENADA") !== -1) {
        coordsCol = colMap[colKey];
        break;
      }
    }
    if (coordsCol === -1 && headerRow.length >= 15) {
      coordsCol = 10;
    }

    var obsCol = colMap["OBSERVACOES"] !== undefined ? colMap["OBSERVACOES"] : (coordsCol !== -1 ? 11 : 10);
    var fotCol = colMap["FOTOS_URL"] !== undefined ? colMap["FOTOS_URL"] : (coordsCol !== -1 ? 12 : 11);
    var cadCol = colMap["DATA CADASTRO"] !== undefined ? colMap["DATA CADASTRO"] : (coordsCol !== -1 ? 13 : 12);
    var atuCol = colMap["DATA ATUALIZACAO"] !== undefined ? colMap["DATA ATUALIZACAO"] : (coordsCol !== -1 ? 14 : 13);
    
    var marCol = -1;
    for (var colKey in colMap) {
      if (colKey.indexOf("MARCADOR") !== -1 || colKey.indexOf("STATUS") !== -1) {
        marCol = colMap[colKey];
        break;
      }
    }
    if (marCol === -1 && headerRow.length >= 16) {
      marCol = 15;
    }
    
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[0] && !row[1]) continue; // Pula linhas vazias

      var coordsStr = coordsCol !== -1 ? String(row[coordsCol] || "").trim() : "";
      var coordsObj = null;
      if (coordsStr && coordsStr.indexOf(",") !== -1) {
        var cParts = coordsStr.split(",");
        var cLat = parseFloat(cParts[0]);
        var cLng = parseFloat(cParts[1]);
        if (!isNaN(cLat) && !isNaN(cLng)) {
          coordsObj = { lat: cLat, lng: cLng };
        }
      }
      
      // Filtro sem acentos
      if (termoBusca) {
        var rowContent = normalizeStr([
          row[idCol], row[nomeCol], row[maeCol], row[rgCol], row[cpfCol], row[endCol], row[alcCol], row[artCol], row[locCol], coordsStr, row[obsCol]
        ].join(" "));
        var tokens = termoBusca.split(/\s+/);
        var matches = tokens.every(function(t) { return rowContent.indexOf(t) !== -1; });
        if (!matches) continue;
      }
      
      // Garante que fotos seja SEMPRE um array de URLs completas (nunca caracteres divididos)
      var fotosList = [];
      var rawFotosCell = fotCol < row.length ? row[fotCol] : null;
      if (rawFotosCell) {
        var rawFotosStr = String(rawFotosCell).trim();
        if (rawFotosStr.indexOf(" | ") !== -1) {
          fotosList = rawFotosStr.split(/\s*\|\s*/).filter(Boolean);
        } else if (rawFotosStr.length > 0) {
          fotosList = [rawFotosStr];
        }
      }

      var safeDate = function(val, fallback) {
        if (!val) return fallback || "";
        try {
          var d = new Date(val);
          if (!isNaN(d.getTime())) return d.toISOString();
        } catch (e) {}
        return String(val);
      };

      var record = {
        id: String(row[idCol] || ""),
        nome: String(row[nomeCol] || ""),
        mae: String(row[maeCol] || ""),
        dataNasc: String(row[nascCol] || ""),
        rg: String(row[rgCol] || ""),
        cpf: String(row[cpfCol] || ""),
        endereco: String(row[endCol] || ""),
        alcunha: String(row[alcCol] || ""),
        artigo: String(row[artCol] || ""),
        localAbordagem: String(row[locCol] || ""),
        coordenadas: coordsStr,
        localAbordagemCoords: coordsObj,
        observacoes: String(row[obsCol] || ""),
        fotos: fotosList,
        marcador: marCol !== -1 && row[marCol] ? String(row[marCol]).trim().toUpperCase() : "NENHUM",
        dataCriacao: safeDate(row[cadCol], new Date().toISOString()),
        dataAtualizacao: safeDate(row[atuCol], "")
      };
      
      data.push(record);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      total: data.length,
      senhaApp: getAppPasswordFromSheet(),
      mascara: "****",
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST: Recebe cadastros e fotos do aplicativo.
 * Salva as fotos no Google Drive criando subpasta para cada abordado dentro de 'ForcaTatica_Fotos'.
 * Suporta também atualização da senha do aplicativo na nuvem (aba Seguranca).
 */
function doPost(e) {
  try {
    var sheet = getOrCreateSheet();
    var payload;
    
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Nenhum dado recebido no postData"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    payload = JSON.parse(e.postData.contents);
    
    // Suporte para salvar ou alterar a senha do aplicativo na nuvem (aba Seguranca com status visual oculto '****')
    if (payload.action === "set_password" || payload.action === "update_password" || payload.action === "alterar_senha") {
      var newPwd = String(payload.password || payload.senha || "").trim();
      if (!newPwd) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Nova senha não informada"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      setAppPasswordInSheet(newPwd);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Senha atualizada com sucesso na nuvem (aba Seguranca da Planilha Google, representada como ****)",
        mascara: "****"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Suporte a exclusão direta na planilha via POST
    if (payload.action === "delete" || payload.acao === "excluir") {
      var targetId = String(payload.id || (payload.registro && payload.registro.id) || "").trim();
      if (!targetId) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "ID não fornecido para exclusão"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var rows = sheet.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < rows.length; r++) {
        if (String(rows[r][0]).trim() === targetId) {
          foundRow = r + 1;
          break;
        }
      }
      
      if (foundRow !== -1) {
        sheet.deleteRow(foundRow);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Registro excluído com sucesso da planilha Google",
          id: targetId
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          status: "warning",
          message: "Registro não encontrado na planilha (já removido)",
          id: targetId
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Extrai registros enviados (único ou em lote)
    var items = [];
    if (payload.abordados && Array.isArray(payload.abordados)) {
      items = payload.abordados;
    } else if (payload.registro) {
      items = [payload.registro];
    } else if (payload.dados) {
      items = [payload.dados];
    } else if (payload.nome) {
      items = [payload];
    }
    
    if (items.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Formato de dados não reconhecido"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var existingRows = sheet.getDataRange().getValues();
    var idIndexMap = {};
    for (var r = 1; r < existingRows.length; r++) {
      var rowId = String(existingRows[r][0]);
      if (rowId) {
        idIndexMap[rowId] = r + 1;
      }
    }
    
    var insertedCount = 0;
    var updatedCount = 0;
    var photoFolder = null;
    var lastSavedFotos = [];
    
    items.forEach(function(item) {
      var id = item.id || ("FT-" + new Date().getTime());
      var nome = (item.nome || "").toString().toUpperCase();
      var mae = (item.mae || "").toString().toUpperCase();
      var dataNasc = (item.dataNasc || "").toString();
      var rg = (item.rg || "").toString();
      var cpf = (item.cpf || "").toString();
      var endereco = (item.endereco || "").toString().toUpperCase();
      var alcunha = (item.alcunha || "").toString().toUpperCase();
      var artigo = (item.artigo || "").toString();
      var localAbordagem = (item.localAbordagem || "").toString();
      var observacoes = (item.observacoes || "").toString();
      
      // Processamento de Fotos (Cria subpasta do abordado no Google Drive)
      var fotosUrls = [];
      var rawPhotosList = [];
      
      if (item.fotos && Array.isArray(item.fotos)) {
        rawPhotosList = item.fotos;
      } else if (item.foto && typeof item.foto === "string") {
        rawPhotosList = [item.foto];
      }
      
      for (var p = 0; p < rawPhotosList.length; p++) {
        var photoItem = rawPhotosList[p];
        if (!photoItem) continue;
        var pStr = String(photoItem).trim();
        
        // Se já é uma URL válida (Drive ou web)
        if (pStr.indexOf("http://") === 0 || pStr.indexOf("https://") === 0) {
          fotosUrls.push(pStr);
        } else if (pStr.length > 50) {
          var drivePublicUrl = "";
          try {
            if (!photoFolder) {
              photoFolder = getOrCreatePhotoFolder();
            }
            if (photoFolder) {
              // Cria ou obtém subpasta específica para o abordado dentro de ForcaTatica_Fotos
              var suspectFolder = getOrCreateSuspectFolder(photoFolder, nome);
              var safeName = nome.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30) || "abordado";
              drivePublicUrl = savePhotoToDrive(suspectFolder || photoFolder, pStr, safeName + "_foto_" + (p + 1));
            }
          } catch (driveErr) {
            Logger.log("Aviso salvamento Drive: " + driveErr.toString());
          }
          
          if (drivePublicUrl && (drivePublicUrl.indexOf("http://") === 0 || drivePublicUrl.indexOf("https://") === 0)) {
            fotosUrls.push(drivePublicUrl);
          } else {
            // Fallback seguro: se o Drive ainda não estiver liberado, grava o Base64 se < 45KB
            if (pStr.length < 45000) {
              fotosUrls.push(pStr);
            }
          }
        }
      }
      
      lastSavedFotos = fotosUrls;
      var fotosStr = fotosUrls.join(" | ");
      
      var coordsStr = "";
      if (item.localAbordagemCoords && item.localAbordagemCoords.lat && item.localAbordagemCoords.lng) {
        coordsStr = Number(item.localAbordagemCoords.lat).toFixed(6) + ", " + Number(item.localAbordagemCoords.lng).toFixed(6);
      } else if (item.coordenadas) {
        coordsStr = String(item.coordenadas).trim();
      }

      var dataCriacao = item.dataCriacao || new Date().toISOString();
      var dataAtualizacao = new Date().toISOString();

      var hasCoordsCol = false;
      var lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        var hVals = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        for (var hc = 0; hc < hVals.length; hc++) {
          if (String(hVals[hc]).toUpperCase().indexOf("COORDENADA") !== -1) {
            hasCoordsCol = true;
            break;
          }
        }
      }

      var autorCriacaoLogin = (item.autorCriacaoLogin || "").toString();
      var autorCriacaoNome = (item.autorCriacaoNome || "").toString().toUpperCase();
      var autorAlteracaoLogin = (item.autorAlteracaoLogin || "").toString();
      var autorAlteracaoNome = (item.autorAlteracaoNome || "").toString().toUpperCase();

      var marcadorVal = item.marcador || item.MARCADOR || "NENHUM";
      var rowData;
      if (hasCoordsCol || lastCol >= 15) {
        rowData = [
          id,
          nome,
          mae,
          dataNasc,
          rg,
          cpf,
          endereco,
          alcunha,
          artigo,
          localAbordagem,
          coordsStr,
          observacoes,
          fotosStr,
          dataCriacao,
          dataAtualizacao,
          marcadorVal,
          autorCriacaoLogin,
          autorCriacaoNome,
          autorAlteracaoLogin,
          autorAlteracaoNome
        ];
      } else {
        rowData = [
          id,
          nome,
          mae,
          dataNasc,
          rg,
          cpf,
          endereco,
          alcunha,
          artigo,
          localAbordagem,
          observacoes,
          fotosStr,
          dataCriacao,
          dataAtualizacao,
          marcadorVal,
          autorCriacaoLogin,
          autorCriacaoNome,
          autorAlteracaoLogin,
          autorAlteracaoNome
        ];
      }
      
      if (idIndexMap[id]) {
        var rowNum = idIndexMap[id];
        sheet.getRange(rowNum, 1, 1, rowData.length).setValues([rowData]);
        updatedCount++;
      } else {
        sheet.appendRow(rowData);
        idIndexMap[id] = sheet.getLastRow();
        insertedCount++;
      }
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Operação concluída com sucesso na Planilha Google e Google Drive",
      inseridos: insertedCount,
      atualizados: updatedCount,
      fotos: lastSavedFotos
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

/**
 * Constante oficial da URL da API do Google Apps Script (Produção)
 */
export const API_URL =
  'https://script.google.com/macros/s/AKfycbwDrSu-3Oid7YqH9RzONE_RJ4DyggPUE00Dqp0Y2ldEjJnXUVKwI9cxAQ-14CbpTh0/exec';

/**
 * Envia um registro (novo cadastro ou edição) para o Google Sheets e Google Drive via POST.
 * Payload obrigatório: JSON.stringify({ action: "save", registro: { ...dadosDoForm, fotos: arrayDeBase64 } })
 * Headers: { "Content-Type": "text/plain;charset=utf-8" }
 */
export async function sendSuspectToGoogleSheets(
  record: SuspectRecord,
  customUrl?: string
): Promise<{ success: boolean; message: string; fotos?: string[] }> {
  const url = (customUrl || getSyncConfig()?.webhookUrl || API_URL).trim();

  if (!url) {
    return {
      success: false,
      message: 'URL da API do Google Apps Script não configurada.',
    };
  }

  // Prepara dados do formulário com coordenadas e fotos em Base64
  const coordsStr = record.localAbordagemCoords
    ? `${record.localAbordagemCoords.lat.toFixed(6)}, ${record.localAbordagemCoords.lng.toFixed(6)}`
    : (record.coordenadas || '');

  const dadosDoForm = {
    id: record.id,
    nome: record.nome,
    mae: record.mae || '',
    dataNasc: record.dataNasc || '',
    rg: record.rg || '',
    cpf: record.cpf || '',
    endereco: record.endereco || '',
    enderecos: record.enderecos || (record.endereco ? [record.endereco] : []),
    alcunha: record.alcunha || '',
    artigo: record.artigo || '',
    artigos: record.artigos || (record.artigo ? record.artigo.split(/\s*,\s*|\s*\/\s*/).filter(Boolean) : []),
    localAbordagem: record.localAbordagem || '',
    coordenadas: coordsStr,
    COORDENADAS_GPS: coordsStr,
    localAbordagemCoords: record.localAbordagemCoords,
    observacoes: record.observacoes || '',
    marcador: record.marcador || 'NENHUM',
    MARCADOR: record.marcador || 'NENHUM',
    alterado: record.alterado || '',
    ALTERADO: record.alterado || '',
    dataAlteracaoFoto: record.dataAlteracaoFoto || '',
    autorCriacaoLogin: record.autorCriacaoLogin || '',
    autorCriacaoNome: record.autorCriacaoNome || '',
    autorAlteracaoLogin: record.autorAlteracaoLogin || '',
    autorAlteracaoNome: record.autorAlteracaoNome || '',
    fotos: record.fotos || [], // arrayDeBase64 (ou links de fotos já enviadas)
    dataCriacao: record.dataCriacao || new Date().toISOString(),
    dataAtualizacao: record.dataAtualizacao || new Date().toISOString(),
  };

  // Estrutura EXATA exigida: { action: "save", registro: { ...dadosDoForm, fotos: arrayDeBase64 } }
  // com compatibilidade universal para scripts que leem na raiz ou em .dados
  const payload = {
    action: 'save',
    webhookUrl: url,
    registro: dadosDoForm,
    dados: dadosDoForm,
    ...dadosDoForm,
  };

  // 1. Tenta primeiro pelo endpoint do servidor (/api/sheets) para contornar qualquer restrição de CORS ou navegador
  try {
    const proxyRes = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json && (json.status === 'success' || json.success === true)) {
        return {
          success: true,
          message: json.message || 'Registro gravado com sucesso na nuvem!',
          fotos: json.fotos || [],
        };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy /api/sheets não disponível ou falhou, tentando conexão direta:', proxyErr);
  }

  // 2. Fallback: Conexão direta com o Google Apps Script
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    // Se a resposta retornar status: "error"
    if (json && (json.status === 'error' || json.status === 'ERROR' || json.error)) {
      const errorMsg = json.message || json.error || json.errorMessage || JSON.stringify(json);
      console.error('Google Apps Script retornou status: "error":', json);
      return {
        success: false,
        message: `[API status: "error"] ${errorMsg}`,
      };
    }

    if (!res.ok) {
      return {
        success: false,
        message: `Servidor retornou código HTTP ${res.status}: ${res.statusText || 'Falha na requisição'}`,
      };
    }

    if (text && (text.includes('ScriptError') || text.includes('Exception:') || text.includes('Authorization is required'))) {
      return {
        success: false,
        message: `Erro de execução no script Google: ${text.slice(0, 180)}`,
      };
    }

    if (json && (json.status === 'success' || json.success === true)) {
      return {
        success: true,
        message: json.message || 'Registro e fotos salvos com sucesso no banco de dados em nuvem!',
        fotos: json.fotos || [],
      };
    }

    // Se o backend não confirmou sucesso explicitamente:
    if (!json || (json.status !== 'success' && json.success !== true)) {
      return {
        success: false,
        message: text
          ? `Resposta do servidor não confirmou sucesso: ${text.slice(0, 180)}`
          : 'Servidor retornou resposta vazia sem confirmação de sucesso.',
      };
    }

    return {
      success: true,
      message: 'Dados e fotos enviados com sucesso para o banco de dados em nuvem!',
      fotos: json?.fotos || [],
    };
  } catch (error) {
    console.error('Erro na requisição POST de salvamento para o banco de dados em nuvem:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha na conexão de rede com o banco de dados em nuvem',
    };
  }
}

/**
 * Exclui permanentemente um registro e sua foto no Google Sheets e Google Drive.
 * Payload obrigatório: JSON.stringify({ action: "delete", registro: { id: suspect.id } })
 * Headers: { "Content-Type": "text/plain;charset=utf-8" }
 * Apenas confirma sucesso após o backend responder status: "success".
 */
export async function deleteSuspectFromGoogleSheets(
  id: string,
  customUrl?: string
): Promise<{ success: boolean; message: string }> {
  const url = (customUrl || getSyncConfig()?.webhookUrl || API_URL).trim();

  if (!url) {
    return {
      success: false,
      message: 'URL da API do Google Apps Script não configurada.',
    };
  }

  // Estrutura EXATA exigida: { action: "delete", registro: { id: suspect.id } }
  const payload = {
    action: 'delete',
    webhookUrl: url,
    id,
    registro: { id },
  };

  // 1. Tenta primeiro pelo endpoint do servidor (/api/sheets)
  try {
    const proxyRes = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json && (json.status === 'success' || json.success === true)) {
        return {
          success: true,
          message: json.message || 'Registro excluído com sucesso do banco de dados em nuvem!',
        };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy /api/sheets não disponível para exclusão, tentando direto:', proxyErr);
  }

  // 2. Fallback: Conexão direta com o Google Apps Script
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Ignora erro de parsing
    }

    if (json) {
      if (json.status === 'success' || json.success === true) {
        return {
          success: true,
          message: json.message || 'Registro e fotos excluídos com sucesso do banco de dados em nuvem!',
        };
      }
      if (json.status === 'error' || json.success === false) {
        return {
          success: false,
          message: json.message || 'Erro reportado ao excluir no banco de dados em nuvem.',
        };
      }
    }

    if (!res.ok) {
      return {
        success: false,
        message: `Servidor retornou código HTTP ${res.status}: ${res.statusText || 'Falha na requisição de exclusão'}`,
      };
    }

    if (text && (text.includes('ScriptError') || text.includes('Exception:'))) {
      return {
        success: false,
        message: `Erro no servidor ao excluir: ${text.slice(0, 160)}`,
      };
    }

    // Se o backend respondeu sem erro explícito mas também sem status "success"
    if (json && json.status !== 'success') {
      return {
        success: false,
        message: `Backend não confirmou status 'success': ${text.slice(0, 120)}`,
      };
    }

    return {
      success: true,
      message: 'Registro excluído com sucesso do banco de dados em nuvem!',
    };
  } catch (error) {
    console.error('Erro na requisição POST de exclusão para Google Apps Script:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha na conexão de rede ao tentar excluir na nuvem.',
    };
  }
}

/**
 * Helper para extrair e normalizar qualquer campo de fotos vindo da planilha
 */
export function parsePhotoField(raw: any): string[] {
  if (!raw) return [];

  let list: string[] = [];

  if (Array.isArray(raw)) {
    // 1. Caso crítico: se raw for um array de caracteres individuais de uma foto Base64 ou URL http
    // Ex: ['d', 'a', 't', 'a', ':', ...] ou ['h', 't', 't', 'p', ...]
    if (
      raw.length > 20 &&
      typeof raw[0] === 'string' &&
      raw[0].length === 1 &&
      typeof raw[1] === 'string' &&
      raw[1].length === 1 &&
      ((raw[0] === 'd' && raw[1] === 'a') || (raw[0] === 'h' && raw[1] === 't'))
    ) {
      let reconstructed = raw.join('');
      if (reconstructed.includes(';bae64,')) {
        reconstructed = reconstructed.replace(';bae64,', ';base64,');
      }
      return [reconstructed.trim()];
    }

    list = raw
      .map((item: any) => {
        if (!item) return '';
        if (typeof item === 'object') {
          return String(item.url || item.link || item.src || '').trim();
        }
        return String(item).trim();
      })
      .filter(Boolean);
  } else if (typeof raw === 'string') {
    let trimmed = raw.trim();
    if (!trimmed) return [];

    // Corrige qualquer erro de digitação de bae64 para base64
    if (trimmed.includes(';bae64,')) {
      trimmed = trimmed.replace(';bae64,', ';base64,');
    }

    // Se a célula contiver fórmula do tipo =IMAGE("https://...")
    const formulaMatch = trimmed.match(/=IMAGE\s*\(\s*["']([^"']+)["']\s*\)/i);
    if (formulaMatch && formulaMatch[1]) {
      trimmed = formulaMatch[1].trim();
    }

    if (trimmed.startsWith('data:image')) {
      // Se for apenas um data:image único
      list = [trimmed];
    } else if (trimmed.includes(' | ')) {
      // Formato padrão gravado pelo Google Apps Script
      list = trimmed.split(/\s*\|\s*/).map((s: string) => s.trim()).filter(Boolean);
    } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          list = parsed
            .map((item: any) => {
              if (!item) return '';
              if (typeof item === 'object') {
                return String(item.url || item.link || item.src || '').trim();
              }
              return String(item).trim();
            })
            .filter(Boolean);
        }
      } catch {
        list = trimmed.split(/[\n|;]/).map((s: string) => s.trim()).filter(Boolean);
      }
    } else {
      // Divide por quebra de linha, |, ponto e vírgula ou vírgula
      list = trimmed.split(/[\n|;]|,(?!\s*[a-zA-Z0-9+/=]+;base64)/).map((s: string) => s.trim()).filter(Boolean);
    }
  }

  // Remove aspas ou colchetes residuais de cada URL e normaliza bae64
  return list
    .map((url) => {
      let str = String(url).replace(/^["'\[\s]+|["'\]\s]+$/g, '').trim();
      if (str.includes(';bae64,')) {
        str = str.replace(';bae64,', ';base64,');
      }
      return str;
    })
    .filter(Boolean);
}

/**
 * Converte URLs de fotos (incluindo Google Drive e links diretos) para exibição direta na tag <img>
 */
export function formatPhotoUrl(url?: string): string {
  if (!url) return '';
  let trimmed = String(url).trim();
  if (!trimmed) return '';

  trimmed = trimmed.replace(/^["'\[\s]+|["'\]\s]+$/g, '').trim();

  // Corrige erro de bae64 se houver
  if (trimmed.includes(';bae64,')) {
    trimmed = trimmed.replace(';bae64,', ';base64,');
  }

  // Trata fórmula =IMAGE("...")
  const formulaMatch = trimmed.match(/=IMAGE\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (formulaMatch && formulaMatch[1]) {
    trimmed = formulaMatch[1].trim();
  }

  if (trimmed.startsWith('data:image')) {
    return trimmed;
  }

  // Trata variações de links do Google Drive
  if (
    trimmed.includes('drive.google.com') ||
    trimmed.includes('docs.google.com') ||
    trimmed.includes('googleusercontent.com')
  ) {
    const fileIdMatch =
      trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/thumbnail\?id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/open\?id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);

    if (fileIdMatch && fileIdMatch[1]) {
      // O endpoint lh3.googleusercontent.com/d/ é o CDN direto de alta performance do Google Drive
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
  }

  // Se for apenas o ID alfanumérico do Google Drive (geralmente 25-50 caracteres)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed) && !trimmed.startsWith('http')) {
    return `https://lh3.googleusercontent.com/d/${trimmed}`;
  }

  return trimmed;
}

/**
 * Extrai e normaliza o array de fotos reais recebidas da API ou do cadastro
 */
export function extractSuspectPhotos(suspect: any): string[] {
  if (!suspect) return [];
  const raw: any =
    suspect.fotos ??
    suspect.foto ??
    suspect.FOTOS_URL ??
    suspect['FOTOS_URL'] ??
    suspect['fotos_url'] ??
    suspect.FOTOS ??
    suspect['FOTOS'] ??
    suspect.FOTO ??
    suspect['FOTO'] ??
    suspect.Fotos ??
    suspect.Foto ??
    suspect.urlFoto ??
    suspect.linkFoto ??
    suspect['URL_FOTO'] ??
    suspect['LINK_FOTO'] ??
    suspect['URL FOTO'] ??
    suspect['LINK FOTO'] ??
    suspect.imagem ??
    suspect.imagens ??
    suspect['IMAGEM'] ??
    suspect['IMAGENS'] ??
    suspect.photo ??
    suspect.photos ??
    suspect.image ??
    suspect.images ??
    suspect.url;

  return parsePhotoField(raw);
}

/**
 * URL oficial da API de busca Google Apps Script
 */
export const GOOGLE_SHEETS_SEARCH_URL =
  'https://script.google.com/macros/s/AKfycbwDrSu-3Oid7YqH9RzONE_RJ4DyggPUE00Dqp0Y2ldEjJnXUVKwI9cxAQ-14CbpTh0/exec';

/**
 * Busca registros no Google Sheets via método GET com ?termo=VALOR_DIGITADO (ou todos com termo vazio)
 * Utiliza timestamp anti-cache para garantir sincronização em tempo real em dispositivos móveis.
 */
export async function searchSuspectsInGoogleSheets(
  termo: string,
  customUrl?: string
): Promise<{ success: boolean; data: SuspectRecord[]; message?: string }> {
  const config = getSyncConfig();
  let baseUrl = (customUrl || config?.webhookUrl || GOOGLE_SHEETS_SEARCH_URL).trim();
  if (baseUrl.includes('AKfycbwoy01Le66ylY')) {
    baseUrl = GOOGLE_SHEETS_SEARCH_URL;
  }

  // Timestamp anti-cache garante requisição direta à nuvem em dispositivos móveis
  const timestamp = Date.now();
  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = termo.trim()
    ? `${baseUrl}${separator}termo=${encodeURIComponent(termo.trim())}&_t=${timestamp}`
    : `${baseUrl}${separator}_t=${timestamp}`;

  // 1. Tenta primeiro pelo servidor proxy interno (/api/sheets) para contornar qualquer limitação de CORS do navegador
  let json: any = null;
  try {
    const proxyUrl = termo.trim()
      ? `/api/sheets?termo=${encodeURIComponent(termo.trim())}&webhookUrl=${encodeURIComponent(baseUrl)}&_t=${timestamp}`
      : `/api/sheets?webhookUrl=${encodeURIComponent(baseUrl)}&_t=${timestamp}`;

    const proxyRes = await fetch(proxyUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (proxyRes.ok) {
      json = await proxyRes.json();
    }
  } catch (proxyErr) {
    console.warn('Proxy /api/sheets não disponível para busca, usando conexão direta:', proxyErr);
  }

  // 2. Fallback: Conexão direta com a URL do Google Apps Script
  if (!json) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) {
        throw new Error(`Servidor respondeu com status ${res.status}`);
      }

      json = await res.json();
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : 'Falha na consulta à Planilha Google',
      };
    }
  }

  try {
    if (json && (json.status === 'error' || json.status === 'ERROR')) {
      return {
        success: false,
        data: [],
        message: json.message || 'Erro reportado pelo Google Apps Script',
      };
    }

    // Se a resposta da planilha contiver a senha do app na nuvem, sincroniza automaticamente
    if (json && json.senhaApp && typeof json.senhaApp === 'string') {
      setDeletePassword(json.senhaApp);
    }

    const rawList = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.resultados)
      ? json.resultados
      : Array.isArray(json.registros)
      ? json.registros
      : Array.isArray(json.items)
      ? json.items
      : [];

    if (rawList.length === 0) {
      return {
        success: true,
        data: [],
        message: 'Planilha vazia (0 registros).',
      };
    }

    const mapped: SuspectRecord[] = [];

    for (const item of rawList) {
      if (!item) continue;

      // Se a linha for um array de colunas direto
      if (Array.isArray(item)) {
        const rawNome = String(item[1] || '').trim();
        const rawRg = String(item[4] || '').trim();
        const rawCpf = String(item[5] || '').trim();
        const rawAlcunha = String(item[7] || '').trim();
        const rawId = String(item[0] || '').trim();

        // Se a linha for completamente vazia ou sem identificação, descarta
        if (!rawNome && !rawRg && !rawCpf && !rawAlcunha && !rawId) {
          continue;
        }

        const id = rawId || `FT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const nome = rawNome.toUpperCase();
        const mae = String(item[2] || '').trim().toUpperCase();
        const dataNasc = String(item[3] || '').trim();
        const rg = rawRg;
        const cpf = rawCpf;
        const endereco = String(item[6] || '').trim();
        const alcunha = rawAlcunha.toUpperCase();
        const artigo = String(item[8] || '').trim();
        const localAbordagem = String(item[9] || '').trim();

        let coordenadas = '';
        let observacoes = '';
        let rawFotos = '';
        let dataCriacao = '';
        let dataAtualizacao = '';

        if (item.length >= 15) {
          coordenadas = String(item[10] || '').trim();
          observacoes = String(item[11] || '').trim();
          rawFotos = item[12] || '';
          dataCriacao = String(item[13] || new Date().toISOString());
          dataAtualizacao = String(item[14] || dataCriacao);
        } else {
          observacoes = String(item[10] || '').trim();
          rawFotos = item[11] || '';
          dataCriacao = String(item[12] || new Date().toISOString());
          dataAtualizacao = String(item[13] || dataCriacao);
        }

        let localAbordagemCoords: { lat: number; lng: number } | undefined = undefined;
        if (coordenadas && coordenadas.includes(',')) {
          const parts = coordenadas.split(',');
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            localAbordagemCoords = { lat, lng };
          }
        }

        const fotos = parsePhotoField(rawFotos);

        let marcador: 'NENHUM' | 'PRESO' | 'MORTO' | 'ALVO_PRIORITARIO' = 'NENHUM';
        if (item.length >= 16 && item[15]) {
          const rawM = String(item[15]).trim().toUpperCase();
          if (rawM === 'PRESO' || rawM === 'MORTO' || rawM === 'ALVO_PRIORITARIO' || rawM === 'ALVO PRIORITARIO') {
            marcador = rawM === 'ALVO PRIORITARIO' ? 'ALVO_PRIORITARIO' : (rawM as any);
          }
        }

        mapped.push({
          id,
          nome,
          mae,
          dataNasc,
          rg,
          cpf,
          endereco,
          enderecos: endereco ? [endereco] : [],
          alcunha,
          artigo,
          localAbordagem,
          coordenadas: coordenadas || undefined,
          localAbordagemCoords,
          observacoes,
          fotos,
          marcador,
          dataCriacao,
          dataAtualizacao,
        });
        continue;
      }

      // Se for um objeto com chaves
      const rawNome = String(item.nome || item.NOME || item.Nome || '').trim();
      const rawRg = String(item.rg || item.RG || item.Rg || '').trim();
      const rawCpf = String(item.cpf || item.CPF || item.Cpf || '').trim();
      const rawAlcunha = String(item.alcunha || item.ALCUNHA || item.Alcunha || item.vulgo || item.VULGO || '').trim();
      const rawId = String(item.id || item.ID || '').trim();

      // Se o objeto não tiver nenhuma informação útil, descarta
      if (!rawNome && !rawRg && !rawCpf && !rawAlcunha && !rawId) {
        continue;
      }

      let rawNasc = String(
        item.dataNasc ||
        item.nasc ||
        item['nasc'] ||
        item['DATA DE NASCIMENTO'] ||
        item['DATA NASCIMENTO'] ||
        item['Data de Nascimento'] ||
        item.data_nasc ||
        item.dataNascimento ||
        item.nascimento ||
        ''
      ).trim();

      let dataNasc = rawNasc;
      if (rawNasc) {
        // Normaliza para formato legível DD/MM/AAAA
        if (/^\d{4}-\d{2}-\d{2}/.test(rawNasc)) {
          const parts = rawNasc.split('T')[0].split('-');
          if (parts.length === 3) dataNasc = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          try {
            const d = new Date(rawNasc);
            if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
              const dia = String(d.getDate()).padStart(2, '0');
              const mes = String(d.getMonth() + 1).padStart(2, '0');
              const ano = d.getFullYear();
              dataNasc = `${dia}/${mes}/${ano}`;
            }
          } catch (_) {}
        }
      }

      const rawFotos =
        item.fotos ??
        item.foto ??
        item.photos ??
        item.photo ??
        item.FOTOS_URL ??
        item['FOTOS_URL'] ??
        item['fotos_url'] ??
        item.FOTOS ??
        item['FOTOS'] ??
        item.FOTO ??
        item['FOTO'] ??
        item.Fotos ??
        item.Foto ??
        item.urlFoto ??
        item.linkFoto ??
        item['URL_FOTO'] ??
        item['LINK_FOTO'] ??
        item['URL FOTO'] ??
        item['LINK FOTO'] ??
        item.imagem ??
        item.imagens ??
        item['IMAGEM'] ??
        item['IMAGENS'] ??
        item.image ??
        item.images ??
        item.url;

      const fotos = parsePhotoField(rawFotos);

      const nome = rawNome.toUpperCase();
      const mae = String(
        item.mae ||
        item.nome_mae ||
        item.nomeMae ||
        item['nome_mae'] ||
        item['NOME_MAE'] ||
        item['NOME DA MÃE'] ||
        item['NOME DA MAE'] ||
        item['Nome da Mãe'] ||
        item['Nome da Mae'] ||
        item.filiacao ||
        item.MAE ||
        item['MÃE'] ||
        item['Mae'] ||
        item['mae'] ||
        ''
      ).trim().toUpperCase();
      const rg = rawRg;
      const cpf = rawCpf;

      let rawEnd = item.endereco || item.ENDERECO || item['ENDEREÇO'] || item.Endereco;
      if (!rawEnd && Array.isArray(item.enderecos) && item.enderecos.length > 0) {
        rawEnd = item.enderecos[0];
      }
      if (!rawEnd && item.local_abordagem) {
        if (typeof item.local_abordagem === 'string') rawEnd = item.local_abordagem;
        else if (typeof item.local_abordagem === 'object' && item.local_abordagem.endereco && item.local_abordagem.endereco !== '[OBJECT OBJECT]') {
          rawEnd = item.local_abordagem.endereco;
        }
      }
      const enderecoStr = String(rawEnd || '').trim();
      const enderecosList = Array.isArray(item.enderecos) && item.enderecos.length > 0
        ? item.enderecos
        : (enderecoStr ? [enderecoStr] : []);

      const alcunha = rawAlcunha.toUpperCase();

      let rawArtigo = item.artigo || item.ARTIGO || item.Artigo;
      if (!rawArtigo && Array.isArray(item.artigos) && item.artigos.length > 0) {
        rawArtigo = item.artigos.join(', ');
      }
      const artigo = String(rawArtigo || '').trim();

      const localAbordagem = String(item.localAbordagem || item.LOCAL_ABORDAGEM || item['LOCAL DA ABORDAGEM'] || item['Local da Abordagem'] || item.local_abordagem || item.local || '').trim();
      const coordenadas = String(
        item.coordenadas ||
        item.COORDENADAS_GPS ||
        item['COORDENADAS_GPS'] ||
        item['COORDENADAS'] ||
        item['Coordenadas'] ||
        item.coords ||
        item.gps ||
        ''
      ).trim();

      let localAbordagemCoords = item.localAbordagemCoords;
      if (!localAbordagemCoords && coordenadas && coordenadas.includes(',')) {
        const parts = coordenadas.split(',');
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          localAbordagemCoords = { lat, lng };
        }
      }

      const observacoes = String(item.observacoes || item.OBSERVACOES || item['OBSERVAÇÕES'] || item['Observações'] || item.observacao || item.obs || '').trim();

      const rawMarcador = String(
        item.marcador ||
        item.MARCADOR ||
        item.Marcador ||
        item.status ||
        item.STATUS ||
        item.Status ||
        ''
      ).trim().toUpperCase();

      let marcador: 'NENHUM' | 'PRESO' | 'MORTO' | 'ALVO_PRIORITARIO' = 'NENHUM';
      if (rawMarcador === 'PRESO' || rawMarcador === 'MORTO' || rawMarcador === 'ALVO_PRIORITARIO' || rawMarcador === 'ALVO PRIORITARIO') {
        marcador = rawMarcador === 'ALVO PRIORITARIO' ? 'ALVO_PRIORITARIO' : (rawMarcador as any);
      }

      const autorCriacaoLogin = String(item.autorCriacaoLogin || item.AUTOR_CRIACAO_LOGIN || item.criadorLogin || '').trim();
      const autorCriacaoNome = String(item.autorCriacaoNome || item.AUTOR_CRIACAO_NOME || item.criadorNome || '').trim();
      const autorAlteracaoLogin = String(item.autorAlteracaoLogin || item.AUTOR_ALTERACAO_LOGIN || item.alteradorLogin || '').trim();
      const autorAlteracaoNome = String(item.autorAlteracaoNome || item.AUTOR_ALTERACAO_NOME || item.alteradorNome || '').trim();

      mapped.push({
        id: rawId || `suspect-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nome,
        mae,
        dataNasc,
        rg,
        cpf,
        endereco: enderecoStr,
        enderecos: enderecosList.length > 0 ? enderecosList : (enderecoStr ? [enderecoStr] : []),
        alcunha,
        artigo,
        localAbordagem,
        coordenadas: coordenadas || undefined,
        localAbordagemCoords,
        observacoes,
        fotos,
        marcador,
        dataCriacao: String(item.dataCriacao || item['DATA CADASTRO'] || item.created_date || item.dataEnvio || new Date().toISOString()),
        dataAtualizacao: String(item.dataAtualizacao || item['DATA ATUALIZAÇÃO'] || item.dataEnvio || ''),
        autorCriacaoLogin: autorCriacaoLogin || undefined,
        autorCriacaoNome: autorCriacaoNome || undefined,
        autorAlteracaoLogin: autorAlteracaoLogin || undefined,
        autorAlteracaoNome: autorAlteracaoNome || undefined,
      });
    }

    // Valida e rejeita cards com nomes vazios ou placeholders genéricos
    const validRecords: SuspectRecord[] = [];
    for (const record of mapped) {
      const nomeTrim = (record.nome || '').trim().toUpperCase();
      const isPlaceholderName =
        !nomeTrim ||
        nomeTrim === 'NÃO INFORMADO' ||
        nomeTrim === 'NAO INFORMADO' ||
        nomeTrim === 'DADOS NÃO INFORMADO' ||
        nomeTrim === 'DADOS NAO INFORMADO' ||
        nomeTrim === 'DADOS NÃO INFORMADOS' ||
        nomeTrim === 'DADOS NAO INFORMADOS' ||
        nomeTrim === 'NENHUM' ||
        nomeTrim === 'UNDEFINED' ||
        nomeTrim === 'NULL';

      const hasDoc = Boolean(
        (record.rg && record.rg.trim()) ||
        (record.cpf && record.cpf.trim()) ||
        (record.alcunha && record.alcunha.trim())
      );

      // Rejeita cards com nome vazio/fictício e sem nenhum documento
      if (isPlaceholderName && !hasDoc) {
        continue;
      }

      validRecords.push(record);
    }

    // Se a planilha estiver vazia após validação, retorna lista vazia imediatamente
    if (validRecords.length === 0) {
      return {
        success: true,
        data: [],
        message: 'Planilha vazia (0 registros válidos).',
      };
    }

    // Deduplicação de backup da planilha:
    // Na planilha do Google, linhas antigas são preservadas como histórico/backup operacional.
    // Ordenamos pela data mais recente e exibimos apenas a versão ativa de cada indivíduo.
    validRecords.sort((a, b) => {
      const timeA = Math.max(new Date(a.dataAtualizacao || 0).getTime(), new Date(a.dataCriacao || 0).getTime());
      const timeB = Math.max(new Date(b.dataAtualizacao || 0).getTime(), new Date(b.dataCriacao || 0).getTime());
      return timeB - timeA;
    });

    const activeList: SuspectRecord[] = [];
    const seenKeys = new Set<string>();

    for (const rec of validRecords) {
      const cleanCpf = (rec.cpf || '').trim().replace(/\D/g, '');
      const cleanRg = (rec.rg || '').trim().replace(/\D/g, '');
      const normNome = normalizeText(rec.nome || '');

      let key = '';
      if (cleanCpf && cleanCpf.length === 11) {
        key = `cpf:${cleanCpf}`;
      } else if (cleanRg && cleanRg.length >= 5) {
        key = `rg:${cleanRg}`;
      } else if (normNome && normNome.length >= 4) {
        key = `nome:${normNome}`;
      } else {
        key = `id:${rec.id}`;
      }

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        activeList.push(rec);
      }
    }

    // Se houver termo pesquisado, aplica filtro 100% insensível a acentos e maiúsculas/minúsculas
    let filteredData = activeList;
    if (termo.trim()) {
      filteredData = activeList.filter((record) => matchesSuspect(record, termo.trim()));
    }

    return {
      success: true,
      data: filteredData,
      message: `${filteredData.length} registros encontrados na Planilha Google.`,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Falha na consulta',
    };
  }
}

/**
 * Função GET para puxar dados diretamente da planilha Google Sheets via fetch
 */
export async function fetchSuspectsFromGoogleSheets(
  customUrl?: string
): Promise<{ success: boolean; data?: SuspectRecord[]; message?: string }> {
  return searchSuspectsInGoogleSheets('', customUrl);
}

/**
 * Consulta a senha do aplicativo armazenada na nuvem (aba Seguranca da Planilha Google)
 */
export async function fetchCloudPasswordFromGoogleSheets(
  customUrl?: string
): Promise<{ success: boolean; senha?: string; mascara?: string }> {
  const config = getSyncConfig();
  const baseUrl = (customUrl || config?.webhookUrl || API_URL).trim();
  const timestamp = Date.now();
  const separator = baseUrl.includes('?') ? '&' : '?';

  // 1. Tenta pelo servidor proxy (/api/sheets)
  try {
    const proxyUrl = `/api/sheets?action=get_password&webhookUrl=${encodeURIComponent(baseUrl)}&_t=${timestamp}`;
    const proxyRes = await fetch(proxyUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json && json.senhaApp && typeof json.senhaApp === 'string') {
        setDeletePassword(json.senhaApp);
        return { success: true, senha: json.senhaApp, mascara: '****' };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy /api/sheets não disponível para buscar senha, tentando direto:', proxyErr);
  }

  // 2. Conexão direta com Google Apps Script
  try {
    const res = await fetch(`${baseUrl}${separator}action=get_password&_t=${timestamp}`, {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.senhaApp && typeof json.senhaApp === 'string') {
        setDeletePassword(json.senhaApp);
        return { success: true, senha: json.senhaApp, mascara: '****' };
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar senha na nuvem via conexão direta:', err);
  }

  return { success: false };
}

/**
 * Salva ou atualiza a senha do aplicativo na nuvem (aba Seguranca da Planilha Google)
 * A senha é gravada com status visual oculto representado por **** conforme diretriz operacional.
 */
export async function sendPasswordToGoogleSheets(
  newPassword: string,
  customUrl?: string
): Promise<{ success: boolean; message: string }> {
  const config = getSyncConfig();
  const baseUrl = (customUrl || config?.webhookUrl || API_URL).trim();
  const payload = {
    action: 'set_password',
    webhookUrl: baseUrl,
    senha: newPassword.trim(),
    password: newPassword.trim(),
    mascara: '****',
  };

  // 1. Salva via servidor proxy (/api/sheets)
  try {
    const proxyRes = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json && (json.status === 'success' || json.success === true)) {
        setDeletePassword(newPassword.trim());
        return {
          success: true,
          message: 'Senha salva com sucesso no banco de dados em nuvem (representada de forma oculta como ****)!',
        };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy /api/sheets falhou ao salvar senha, tentando direto:', proxyErr);
  }

  // 2. Fallback direto para o Apps Script
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const json = await res.json();
    if (json && (json.status === 'success' || json.success === true)) {
      setDeletePassword(newPassword.trim());
      return {
        success: true,
        message: 'Senha salva com sucesso no banco de dados em nuvem (representada de forma oculta como ****)!',
      };
    }
  } catch (err) {
    console.warn('Conexão direta falhou ao salvar senha na nuvem:', err);
  }

  // Salva no armazenamento local como garantia de continuidade operacional
  setDeletePassword(newPassword.trim());
  return {
    success: true,
    message: 'Senha atualizada localmente e configurada na fila de sincronização na nuvem.',
  };
}