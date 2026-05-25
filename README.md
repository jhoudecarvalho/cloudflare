# Cloudflare DNS Manager (Next.js + MariaDB)

Gerenciador DNS da Cloudflare com a mesma interface do app legado (`legacy/`), agora em **Next.js 15** com sessões e auditoria em **MariaDB**.

## Funcionalidades

- Login com **Account ID** + **API Token** Cloudflare
- Listagem de domínios (zonas) com busca
- Visualização de registros DNS
- Alteração de IP em massa (A / AAAA opcional)
- Sessão persistente (cookie httpOnly, token criptografado no banco)
- Log de auditoria das alterações em massa

## Requisitos

- Node.js 20+
- MariaDB 10.6+
- CloudPanel com site Node.js (proxy nginx → porta **3015**)

## Instalação no CloudPanel

### 1. Banco MariaDB

No CloudPanel, crie o banco e usuário. Exemplo:

```sql
CREATE DATABASE cdwtech_cloudflare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cf_dns'@'localhost' IDENTIFIED BY 'SUA_SENHA_FORTE';
GRANT ALL ON cdwtech_cloudflare.* TO 'cf_dns'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Variáveis de ambiente

Copie `.env.example` para `.env` na raiz do projeto:

```bash
cp .env.example .env
```

Edite `DATABASE_URL`, `ENCRYPTION_KEY` e confirme `PORT=3015`.

### 3. Build e banco

```bash
npm install
npx prisma db push
npm run build
```

### 4. PM2 (porta 3015 — igual ao vhost nginx)

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

No site Node.js do CloudPanel, defina **Application Port** = `3015` (substitui `{{app_port}}` no vhost).

O nginx já faz proxy para `127.0.0.1:3015` com SSL e WebSocket.

### 5. Domínio

- `server_name cdwtech-cloudflare.cdwtech.com.br`
- HTTPS forçado (já configurado no vhost)

## Desenvolvimento local

```bash
npm install
cp .env.example .env
# configure MariaDB local
npx prisma db push
npm run dev
```

Acesse: http://localhost:3015

## Estrutura

```
src/
  app/           # App Router + API routes
  components/    # UI (DnsManager)
  lib/           # DB, sessão, proxy Cloudflare
prisma/          # Schema MariaDB
legacy/          # app.js + index.html originais
```

## API

| Rota | Descrição |
|------|-----------|
| `POST /api/auth/login` | Valida token CF e cria sessão |
| `POST /api/auth/logout` | Encerra sessão |
| `GET /api/auth/session` | Verifica sessão ativa |
| `GET/POST/PATCH /api/*` | Proxy → `api.cloudflare.com/client/v4/*` |
| `POST /api/audit` | Registra alteração em massa |

## Segurança

- Token Cloudflare **nunca** fica no frontend após login
- Armazenado criptografado (AES-256-GCM) na tabela `sessions`
- Cookie `cf_session` httpOnly

## App legado

Os arquivos originais estão em `legacy/` (`app.js`, `index.html`). O Node na porta 3015 foi substituído por `next start -p 3015`.
