#!/usr/bin/env bash
# Gera um .tar.gz com os arquivos necessários para o CloudPanel (sem node_modules/.next)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy-cdwtech-cloudflare.tar.gz"

cd "$ROOT"

tar -czf "$OUT" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env.local' \
  --exclude='legacy' \
  --exclude='deploy-cdwtech-cloudflare.tar.gz' \
  --exclude='.DS_Store' \
  package.json \
  package-lock.json \
  next.config.ts \
  tsconfig.json \
  next-env.d.ts \
  ecosystem.config.cjs \
  .env \
  .env.example \
  .gitignore \
  prisma \
  src \
  README.md

echo "Pacote criado: $OUT"
echo "Envie ao servidor e extraia em htdocs/cdwtech-cloudflare.cdwtech.com.br"
