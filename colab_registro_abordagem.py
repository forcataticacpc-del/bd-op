# -*- coding: utf-8 -*-
"""
=============================================================================
FORÇA TÁTICA CPC - FORMULÁRIO DE CADASTRO NO GOOGLE COLAB
=============================================================================
Instruções de Execução no Google Colab:
1. Acesse: https://colab.research.google.com
2. Crie um "Novo notebook".
3. Cole o código desta célula inteira e execute (Ctrl + Enter ou Shift + Enter).
4. O Google Colab solicitará autorização com sua conta Google (forcataticacpc@gmail.com).
5. O formulário interativo tático será renderizado na tela.
6. Preencha os campos, anexe a foto e clique em "Salvar Registro na Nuvem".
=============================================================================
"""

# 1. Instalação e importação das dependências
import io
import time
from datetime import datetime
import ipywidgets as widgets
from IPython.display import display, HTML, clear_output

# Autenticação nativa Google Colab
from google.colab import auth
import gspread
from google.auth import default
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

print("Autenticando com sua conta Google...")
auth.authenticate_user()
creds, _ = default()

# Inicializa clientes de API
gc = gspread.authorize(creds)
drive_service = build('drive', 'v3', credentials=creds)
print("Autenticação Google concluída com sucesso!")


# 2. Funções auxiliares do Google Drive e Google Sheets
def obter_ou_criar_pasta_drive(nome_pasta="ForcaTatica_Fotos"):
    """Localiza ou cria a pasta no Google Drive e libera acesso de leitura com link."""
    query = f"name = '{nome_pasta}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    response = drive_service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    files = response.get('files', [])

    if files:
        folder_id = files[0].get('id')
    else:
        file_metadata = {
            'name': nome_pasta,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        folder = drive_service.files().create(body=file_metadata, fields='id').execute()
        folder_id = folder.get('id')

    # Garante compartilhamento de visualização por link (público)
    try:
        drive_service.permissions().create(
            fileId=folder_id,
            body={'role': 'reader', 'type': 'anyone'},
            fields='id'
        ).execute()
    except Exception:
        pass

    return folder_id


def upload_foto_drive(nome_arquivo, dados_bytes, folder_id):
    """Faz o upload do arquivo binário para a pasta e retorna o link direto de alta velocidade."""
    file_metadata = {
        'name': nome_arquivo,
        'parents': [folder_id]
    }
    media = MediaIoBaseUpload(io.BytesIO(dados_bytes), mimetype='image/jpeg', resumable=True)

    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, webViewLink, webContentLink'
    ).execute()

    file_id = file.get('id')

    # Torna a foto acessível para visualização com link
    try:
        drive_service.permissions().create(
            fileId=file_id,
            body={'role': 'reader', 'type': 'anyone'},
            fields='id'
        ).execute()
    except Exception:
        pass

    # Formato de CDN direto do Google Drive (compatível com visualização e tag <img>)
    return f"https://lh3.googleusercontent.com/d/{file_id}"


def obter_ou_criar_planilha(nome_planilha="APPFT", nome_aba="Abordados"):
    """Localiza a planilha APPFT e garante que a aba e o cabeçalho existam."""
    try:
        sh = gc.open(nome_planilha)
    except gspread.exceptions.SpreadsheetNotFound:
        # Se não encontrar pelo nome exato, cria uma nova
        sh = gc.create(nome_planilha)
        print(f"Planilha '{nome_planilha}' criada com sucesso no seu Google Drive.")

    try:
        worksheet = sh.worksheet(nome_aba)
    except gspread.exceptions.WorksheetNotFound:
        worksheet = sh.add_worksheet(title=nome_aba, rows="1000", cols="20")

    # Verifica se já tem cabeçalho na linha 1
    existing_headers = worksheet.row_values(1)
    if not existing_headers:
        headers = [
            "ID",                   # Coluna A
            "NOME",                 # Coluna B
            "MÃE",                  # Coluna C
            "DATA DE NASCIMENTO",   # Coluna D
            "RG",                   # Coluna E
            "CPF",                  # Coluna F
            "ENDEREÇO",             # Coluna G
            "ALCUNHA",              # Coluna H
            "ARTIGO",               # Coluna I
            "LOCAL DA ABORDAGEM",   # Coluna J
            "OBSERVAÇÕES",          # Coluna K
            "FOTOS_URL",            # Coluna L
            "DATA CADASTRO",        # Coluna M
            "DATA ATUALIZAÇÃO"      # Coluna N
        ]
        worksheet.append_row(headers)
        worksheet.format('A1:N1', {
            "backgroundColor": {"red": 0.1, "green": 0.12, "blue": 0.17},
            "horizontalAlignment": "CENTER",
            "textFormat": {"foregroundColor": {"red": 0.9, "green": 0.75, "blue": 0.48}, "bold": True}
        })

    return worksheet


# 3. Construção dos Componentes de Interface com ipywidgets
def gerar_id_tatico():
    return f"FT-{int(time.time())}"

header_html = widgets.HTML("""
<div style="background: linear-gradient(135deg, #0e131b, #1a2230); border: 1px solid #c69c59; border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center;">
  <h2 style="color: #e5c07b; margin: 0; font-family: sans-serif; letter-spacing: 1px; font-weight: 800;">
    POLÍCIA MILITAR - FORÇA TÁTICA CPC
  </h2>
  <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px; font-family: sans-serif;">
    Módulo Interativo Google Colab • Cadastro e Sincronização em Nuvem (Planilha APPFT & Drive)
  </p>
</div>
""")

layout_full = widgets.Layout(width='98%', margin='4px 0')
layout_half = widgets.Layout(width='48%', margin='4px 1%')

txt_id = widgets.Text(description='ID:', value=gerar_id_tatico(), layout=layout_half)
btn_novo_id = widgets.Button(description='Gerar Novo ID', icon='refresh', layout=widgets.Layout(width='180px', margin='4px 0'))

txt_nome = widgets.Text(description='Nome:', placeholder='Nome completo do abordado (obrigatório)', layout=layout_full)
txt_mae = widgets.Text(description='Mãe:', placeholder='Nome completo da mãe', layout=layout_full)
txt_data_nasc = widgets.Text(description='Data Nasc.:', placeholder='Ex: 15/08/1995', layout=layout_half)
txt_rg = widgets.Text(description='RG:', placeholder='Apenas números ou com dígito', layout=layout_half)
txt_cpf = widgets.Text(description='CPF:', placeholder='000.000.000-00', layout=layout_half)
txt_alcunha = widgets.Text(description='Alcunha:', placeholder='Vulgo / Apelido', layout=layout_half)
txt_endereco = widgets.Text(description='Endereço:', placeholder='Rua, número, bairro, cidade', layout=layout_full)
txt_artigo = widgets.Text(description='Artigo:', placeholder='Ex: Art. 33 (Tráfico), Art. 157 (Roubo)', layout=layout_full)
txt_local = widgets.Text(description='Local:', placeholder='Local exato da abordagem policial', layout=layout_full)
txt_obs = widgets.Textarea(description='Observações:', placeholder='Tatuagens, características marcantes, comparsas, histórico...', layout=widgets.Layout(width='98%', height='90px', margin='4px 0'))

upload_foto = widgets.FileUpload(
    accept='image/*',
    multiple=False,
    description='Foto Abordado',
    layout=widgets.Layout(width='220px', margin='8px 0')
)

lbl_foto_info = widgets.HTML(value="<span style='color: #64748b; font-size: 12px;'>Selecione foto (.jpg, .png) do dispositivo</span>")

def ao_mudar_foto(change):
    if upload_foto.value:
        lbl_foto_info.value = "<span style='color: #10b981; font-weight: bold;'> Foto selecionada e pronta para envio</span>"
    else:
        lbl_foto_info.value = "<span style='color: #64748b; font-size: 12px;'>Nenhuma foto selecionada</span>"

upload_foto.observe(ao_mudar_foto, names='value')

def regenerar_id(b):
    txt_id.value = gerar_id_tatico()

btn_novo_id.on_click(regenerar_id)

btn_salvar = widgets.Button(
    description='SALVAR REGISTRO NA NUVEM',
    button_style='success',
    icon='cloud-upload',
    layout=widgets.Layout(width='98%', height='48px', margin='16px 0')
)

btn_limpar = widgets.Button(
    description='Limpar Campos',
    icon='eraser',
    layout=widgets.Layout(width='180px', margin='4px 0')
)

output_msg = widgets.Output()

def limpar_formulario(b=None):
    txt_id.value = gerar_id_tatico()
    txt_nome.value = ""
    txt_mae.value = ""
    txt_data_nasc.value = ""
    txt_rg.value = ""
    txt_cpf.value = ""
    txt_endereco.value = ""
    txt_alcunha.value = ""
    txt_artigo.value = ""
    txt_local.value = ""
    txt_obs.value = ""
    upload_foto.value.clear()
    lbl_foto_info.value = "<span style='color: #64748b; font-size: 12px;'>Selecione foto (.jpg, .png) do dispositivo</span>"
    with output_msg:
        clear_output()

btn_limpar.on_click(limpar_formulario)


# 4. Ação do Botão Salvar
def salvar_registro(b):
    with output_msg:
        clear_output()

        nome_val = txt_nome.value.strip().upper()
        if not nome_val:
            print(" ERRO: O campo 'Nome' é obrigatório!")
            return

        print(" Processando salvamento na nuvem Google...")

        try:
            # 1) Upload da foto no Google Drive
            url_foto = ""
            if upload_foto.value:
                print(" Enviando foto para o Google Drive na pasta 'ForcaTatica_Fotos'...")
                folder_id = obter_ou_criar_pasta_drive("ForcaTatica_Fotos")

                # Compatibilidade com diferentes versões de ipywidgets FileUpload
                if isinstance(upload_foto.value, dict):
                    # Versões anteriores do ipywidgets
                    file_info = list(upload_foto.value.values())[0]
                    content_bytes = file_info.get('content', b'')
                    orig_name = file_info.get('metadata', {}).get('name', 'foto.jpg')
                else:
                    # Versões mais recentes (tuple de dicts)
                    first_file = upload_foto.value[0]
                    content_bytes = first_file['content']
                    orig_name = first_file.get('name', 'foto.jpg')

                ext = orig_name.split('.')[-1] if '.' in orig_name else 'jpg'
                safe_name = "".join(c for c in nome_val if c.isalnum() or c in ('_', ' ')).strip().replace(' ', '_')[:25]
                nome_final = f"{safe_name}_{int(time.time())}.{ext}"

                url_foto = upload_foto_drive(nome_final, content_bytes, folder_id)
                print(f" Foto salva com sucesso no Drive!")

            # 2) Inserção na Planilha Google Sheets 'APPFT'
            print(" Inserindo registro na planilha 'APPFT'...")
            worksheet = obter_ou_criar_planilha("APPFT", "Abordados")

            agora_iso = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

            # Ordem estrita das colunas de A até N:
            # A: ID
            # B: NOME
            # C: MÃE
            # D: DATA DE NASCIMENTO
            # E: RG
            # F: CPF
            # G: ENDEREÇO
            # H: ALCUNHA
            # I: ARTIGO
            # J: LOCAL DA ABORDAGEM
            # K: OBSERVAÇÕES
            # L: FOTOS_URL
            # M: DATA CADASTRO
            # N: DATA ATUALIZAÇÃO
            linha = [
                txt_id.value.strip(),
                nome_val,
                txt_mae.value.strip().upper(),
                txt_data_nasc.value.strip(),
                txt_rg.value.strip(),
                txt_cpf.value.strip(),
                txt_endereco.value.strip().upper(),
                txt_alcunha.value.strip().upper(),
                txt_artigo.value.strip(),
                txt_local.value.strip(),
                txt_obs.value.strip(),
                url_foto,
                agora_iso,
                agora_iso
            ]

            worksheet.append_row(linha)

            # Exibe confirmação visual
            display(HTML(f"""
            <div style="background-color: #064e3b; border: 1px solid #10b981; border-radius: 8px; padding: 14px; margin-top: 10px; color: #ecfdf5; font-family: sans-serif;">
              <h4 style="margin: 0 0 8px 0; color: #34d399;"> REGISTRO GRAVADO COM SUCESSO!</h4>
              <p style="margin: 2px 0;"><strong>ID:</strong> {txt_id.value}</p>
              <p style="margin: 2px 0;"><strong>Nome:</strong> {nome_val}</p>
              <p style="margin: 2px 0;"><strong>Planilha:</strong> APPFT (Aba: Abordados)</p>
              <p style="margin: 2px 0;"><strong>Foto Drive:</strong> {f'<a href="{url_foto}" target="_blank" style="color: #6ee7b7;">Visualizar Foto</a>' if url_foto else 'Sem foto anexada'}</p>
            </div>
            """))

            # Gera novo ID para o próximo cadastro
            txt_id.value = gerar_id_tatico()

        except Exception as err:
            display(HTML(f"""
            <div style="background-color: #7f1d1d; border: 1px solid #ef4444; border-radius: 8px; padding: 14px; margin-top: 10px; color: #fef2f2; font-family: sans-serif;">
              <h4 style="margin: 0 0 8px 0; color: #fca5a5;">❌ FALHA AO GRAVAR REGISTRO:</h4>
              <p style="margin: 2px 0;">{str(err)}</p>
            </div>
            """))

btn_salvar.on_click(salvar_registro)


# 5. Renderização do Layout do Formulário
linha_id = widgets.HBox([txt_id, btn_novo_id])
linha_nasc_rg = widgets.HBox([txt_data_nasc, txt_rg])
linha_cpf_alcunha = widgets.HBox([txt_cpf, txt_alcunha])
linha_foto = widgets.HBox([upload_foto, lbl_foto_info], layout=widgets.Layout(align_items='center'))

formulario = widgets.VBox([
    header_html,
    linha_id,
    txt_nome,
    txt_mae,
    linha_nasc_rg,
    linha_cpf_alcunha,
    txt_endereco,
    txt_artigo,
    txt_local,
    txt_obs,
    widgets.HTML("<hr style='border: 0; border-top: 1px solid #334155; margin: 12px 0;' />"),
    linha_foto,
    btn_salvar,
    btn_limpar,
    output_msg
], layout=widgets.Layout(
    max_width='800px',
    padding='20px',
    border='1px solid #334155',
    border_radius='12px',
    background_color='#0b0f17'
))

display(formulario)
