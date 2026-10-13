import zipfile
import os
import shutil

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
public_dir = os.path.join(base_dir, 'public')
os.makedirs(public_dir, exist_ok=True)

zip_path_banco = os.path.join(public_dir, 'banco-de-dados-app-completo.zip')
zip_path_legacy = os.path.join(public_dir, 'forca-tatica-app.zip')

exclude_dirs = {'.git', 'node_modules', 'dist', '.cache', '__pycache__', '.temp'}
exclude_files = {'banco-de-dados-app-completo.zip', 'forca-tatica-app.zip', '.DS_Store'}

file_count = 0
total_uncompressed_bytes = 0

with zipfile.ZipFile(zip_path_banco, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
    for root, dirs, files in os.walk(base_dir):
        # Filtra diretórios ocultos e de build/deps
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        for f in files:
            if f in exclude_files or f.endswith('.zip') or f.endswith('.pyc'):
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, base_dir)
            zipf.write(full_path, rel_path)
            file_count += 1
            total_uncompressed_bytes += os.path.getsize(full_path)

# Copia para compatibilidade legado
shutil.copyfile(zip_path_banco, zip_path_legacy)

zip_size_mb = os.path.getsize(zip_path_banco) / (1024 * 1024)
print(f"✅ ZIP gerado com sucesso!")
print(f"📦 Arquivos incluídos: {file_count}")
print(f"💾 Tamanho compactado: {zip_size_mb:.2f} MB")
print(f"📍 Destinos: {zip_path_banco} e {zip_path_legacy}")
