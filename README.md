# Poupanças

Auditor local de despesas recorrentes que identifica desperdício e recomenda ações explicáveis.

## Arranque rápido (modo demo sem persistência)

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000/dashboard`. Este modo é explicitamente em memória e reinicia com o processo.

## PostgreSQL

```bash
cp .env.example .env
# alterar as credenciais locais
set -a && . ./.env && set +a
npm run db:migrate
npm run db:seed
npm run dev
```

Ou `docker compose up --build` quando Compose estiver instalado. O Compose constrói internamente a ligação usando o hostname `db`; `DATABASE_URL` em `.env` destina-se à execução direta no host. Consultar `docs/architecture.md`.

## Qualidade

```bash
npm test
npm run lint
npm run typecheck
npm run build
DATABASE_URL='postgresql://...' npm run db:generate
```

O MVP não inclui OCR, Open Banking, scraping ou microserviços. `DocumentParser` e `MarketDataProvider` são ports, com provider de fixtures apenas para ofertas.
