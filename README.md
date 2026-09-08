# BleedingMoney

Espaço pessoal privado para vigiar despesas recorrentes e obter recomendações explicáveis.

## Arranque local

```bash
npm install
npm run dev
```

Sem `DATABASE_URL`, o estado fica em `.data/bleedingmoney.json` (ou `LOCAL_DATA_FILE`). O primeiro registo em `/register` torna-se o único proprietário e reivindica, uma única vez, as despesas existentes do utilizador de desenvolvimento. Registos seguintes são recusados. O ficheiro é validado profundamente; uma versão 1 é migrada na primeira gravação e corrupção nunca é substituída silenciosamente.

A sessão usa um cookie `HttpOnly`, `SameSite=Lax`, sem tokens em `localStorage`. `TRUST_PROXY` é `false` por omissão: nesse modo, `X-Forwarded-*` e `CF-Connecting-IP` não alteram origem, cookie ou identidade do throttle. Atrás de um proxy controlado, define `TRUST_PROXY=true` e `PUBLIC_ORIGIN=https://...`; a origem canónica valida CSRF e HTTPS torna o cookie `Secure`. `AUTH_COOKIE_SECURE=true|false|auto` mantém o controlo explícito.

```bash
LOCAL_DATA_FILE=.data/bleedingmoney.json AUTH_COOKIE_SECURE=false npm run dev
```

Fixtures pessoais só são carregadas na criação de um estado local quando existe opt-in:

```bash
BLEEDINGMONEY_DEMO=true LOCAL_DATA_FILE=.data/demo.json npm run dev
```

## O que é analisado

Eletricidade; internet/TV/móvel; contas, cartões e comissões bancárias; streaming, software, cloud e SaaS. Os checks atuais são: subscrição sem utilização, aumento de preço por snapshots, fim de fidelização telecom, benchmark telecom com pelo menos 10 casos comparáveis, comissão bancária e potência elétrica contratada. A análise corre ao adicionar ou atualizar dados — não existem jobs contínuos em segundo plano. `/how-it-works` documenta regras, evidência e incerteza.

## PostgreSQL

```bash
cp .env.example .env
# definir DATABASE_URL e POSTGRES_PASSWORD fora do Git
set -a && . ./.env && set +a
npm run db:migrate
npm run dev
```

A migração `0002` acrescenta credenciais e sessões sem alterar os registos atuais. O registo do primeiro proprietário, a reivindicação das despesas e a sessão decorrem numa transação Drizzle. `market_observations` permanece anónima e não é reivindicada.

Executa `npm run db:seed` apenas antes de registar o proprietário. A seed bloqueia e verifica `users` dentro da transação; se já existir proprietário, recusa sem inserir dados. Uma seed anterior ao registo continua válida e as despesas demo são reivindicadas no primeiro registo.

## Qualidade

```bash
npm test
npm run lint
npm run typecheck
npm run build
DATABASE_URL='postgresql://static:static@localhost:5432/static' npm run db:generate
npm audit --omit=dev
git diff --check
```

`GET /api/setup` é autenticado e devolve apenas `onboardingNeeded` e `storageMode`. Pedidos pessoais sem sessão devolvem 401; mutações com cookie exigem `Origin` igual a `PUBLIC_ORIGIN`, quando definida, ou à origem direta/confiavelmente encaminhada. O throttle de login é pequeno e apenas em memória por processo — não substitui rate limiting distribuído. O aumento de preço só fica disponível depois de uma observação posterior à criação; não existem recolhas automáticas em segundo plano.
