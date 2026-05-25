# Deploy no CloudPanel — passo a passo

## Por que deu erro no `npm install`?

O comando `ls` no servidor não listou nada: a pasta  
`/home/cdwtech-cdwtech-cloudflare/htdocs/cdwtech-cloudflare.cdwtech.com.br`  
está **vazia**. O projeto Next.js foi criado no seu Mac; ainda não foi enviado para o servidor.

---

## Opção A — Enviar pacote (recomendado)

### 1. No seu Mac (pasta do projeto)

```bash
cd "/Users/jhonathandecarvalho/Documents/sistemas /cloudlare"
chmod +x scripts/pack-deploy.sh
./scripts/pack-deploy.sh
```

Isso gera `deploy-cdwtech-cloudflare.tar.gz`.

### 2. Enviar para o servidor (substitua IP/host e usuário)

```bash
scp deploy-cdwtech-cloudflare.tar.gz \
  cdwtech-cdwtech-cloudflare@SEU_SERVIDOR:/home/cdwtech-cdwtech-cloudflare/htdocs/cdwtech-cloudflare.cdwtech.com.br/
```

Ou use o **File Manager** do CloudPanel para fazer upload do `.tar.gz`.

### 3. No servidor (SSH)

```bash
cd ~/htdocs/cdwtech-cloudflare.cdwtech.com.br
tar -xzf deploy-cdwtech-cloudflare.tar.gz
ls   # deve aparecer package.json, src/, prisma/, etc.

cp .env.example .env
nano .env   # DATABASE_URL, ENCRYPTION_KEY, PORT=3015

npm install
npx prisma db push
npm run build
# Opção A — CloudPanel gerencia o processo (recomendado, sem PM2 global)
# Painel → Sites → cdwtech-cloudflare → Node.js:
#   Start Command: npm start
#   Application Port: 3015
#   → Salvar e clicar "Restart" / "Start"

# Opção B — PM2 local do projeto (sem instalar pm2 global)
npm install
npx pm2 start ecosystem.config.cjs
npx pm2 save

# Opção C — manual (se o painel não subir sozinho)
nohup npm start > app.log 2>&1 &
```

No CloudPanel → site Node.js → **Application Port**: `3015`.

---

## Opção B — rsync direto (sem .tar.gz)

No Mac:

```bash
rsync -avz --progress \
  --exclude node_modules \
  --exclude .next \
  --exclude .env \
  --exclude legacy \
  --exclude .DS_Store \
  "/Users/jhonathandecarvalho/Documents/sistemas /cloudlare/" \
  cdwtech-cdwtech-cloudflare@SEU_SERVIDOR:~/htdocs/cdwtech-cloudflare.cdwtech.com.br/
```

Depois, no servidor, os mesmos passos: `.env`, `npm install`, `prisma db push`, `build`, `pm2`.

---

## Opção C — Git

Se subir o projeto para GitHub/GitLab:

```bash
cd ~/htdocs/cdwtech-cloudflare.cdwtech.com.br
git clone SEU_REPOSITORIO .
cp .env.example .env
# editar .env
npm install && npx prisma db push && npm run build
pm2 start ecosystem.config.cjs && pm2 save
```

---

## Checklist rápido

| Passo | Comando / ação |
|-------|----------------|
| Arquivos no servidor | `ls` mostra `package.json` |
| Banco MariaDB | Criado no CloudPanel |
| `.env` | `DATABASE_URL` + `ENCRYPTION_KEY` |
| Dependências | `npm install` |
| Tabelas | `npx prisma db push` |
| Build | `npm run build` |
| Processo | `pm2 start ecosystem.config.cjs` |
| Nginx | Porta da app = **3015** |

---

## MariaDB no CloudPanel

1. Databases → criar banco (ex: `cdwtech_cloudflare`)
2. Usuário com acesso ao banco
3. No `.env`:

```
DATABASE_URL="mysql://USUARIO:SENHA@127.0.0.1:3306/cdwtech_cloudflare"
ENCRYPTION_KEY="uma-chave-longa-aleatoria-minimo-16-caracteres"
PORT=3015
NODE_ENV=production
```

---

## Se ainda falhar

```bash
pwd
ls -la
cat package.json | head -5
```

Se `package.json` não existir, os arquivos ainda não foram enviados ou foram extraídos na pasta errada.
