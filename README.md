# BleedingMoney

Auditor local de despesas recorrentes que identifica desperdício e recomenda ações explicáveis.

## Arranque rápido — modo pessoal local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. Sem `DATABASE_URL`, a aplicação começa vazia, apresenta o assistente `/welcome` e persiste despesas, snapshots, findings e ações atomicamente em `.data/bleedingmoney.json`. Define `LOCAL_DATA_FILE=/caminho/estado.json` para escolher outro ficheiro. A pasta `.data/` está ignorada pelo Git.

Um ficheiro existente inválido ou truncado provoca um erro explícito; a aplicação não o substitui silenciosamente. Guarda uma cópia de segurança antes de o reparar manualmente.

## Demonstração explícita

As fixtures de despesas e findings só são carregadas quando ainda não existe ficheiro local e o opt-in está ativo:

```bash
BLEEDINGMONEY_DEMO=true LOCAL_DATA_FILE=.data/demo.json npm run dev
```

As observações de benchmark são dados de mercado anónimos e continuam disponíveis no modo pessoal. `GET /api/setup` devolve apenas `onboardingNeeded` e `storageMode`, sem detalhes pessoais.

## PostgreSQL

```bash
cp .env.example .env
# configurar e exportar DATABASE_URL
set -a && . ./.env && set +a
npm run db:migrate
npm run db:seed
npm run dev
```

Com `DATABASE_URL`, PostgreSQL continua a ser o caminho de produção. Ou usa `docker compose up --build` quando Compose estiver instalado. O Compose constrói internamente a ligação usando o hostname `db`; `DATABASE_URL` em `.env` destina-se à execução direta no host. Consultar `docs/architecture.md`.

## Qualidade

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
DATABASE_URL='postgresql://...' npm run db:generate
```

O MVP não inclui OCR, Open Banking, scraping ou microserviços. `DocumentParser` e `MarketDataProvider` são ports, com provider de fixtures apenas para ofertas.
