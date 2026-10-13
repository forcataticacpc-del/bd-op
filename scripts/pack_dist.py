import zipfile
import os
import subprocess

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
dist_dir = os.path.join(base_dir, 'dist')
public_dir = os.path.join(base_dir, 'public')
os.makedirs(public_dir, exist_ok=True)

# Garante que vite build foi executado
print("🔨 Executando vite build...")
subprocess.run(['npx', 'vite', 'build'], cwd=base_dir, check=True)

zip_path = os.path.join(public_dir, 'cloudflare-pages-dist.zip')
exclude_exts = {'.zip', '.map'}

file_count = 0
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
    for root, dirs, files in os.walk(dist_dir):
        for f in files:
            if any(f.endswith(ext) for ext in exclude_exts):
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, dist_dir)
            zipf.write(full_path, rel_path)
            file_count += 1

zip_size_mb = os.path.getsize(zip_path) / (1024 * 1024)
print(f"✅ cloudflare-pages-dist.zip gerado com sucesso!")
print(f"📦 Arquivos incluídos: {file_count}")
print(f"💾 Tamanho: {zip_size_mb:.2f} MB")
print(f"📍 Destino: {zip_path}")
