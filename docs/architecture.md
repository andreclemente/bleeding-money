# Arquitetura do BleedingMoney

## Decisão central

O sistema é um **workspace pessoal de proprietário único**, não uma aplicação multiutilizador. A primeira criação de conta ganha a chave singleton `owner`; tentativas concorrentes perdem na fila atómica local ou na constraint única PostgreSQL. Toda a API pessoal deriva `userId` exclusivamente da sessão no evento Nitro.

## Autenticação

- Passwords: `scrypt$v1$N$r$p$salt$hash`, salt aleatório de 128 bits e comparação `timingSafeEqual`; nenhum endpoint devolve hash ou password.
- Sessões: token opaco aleatório de 256 bits entregue apenas em cookie `HttpOnly`, `SameSite=Lax`, `Path=/`; só SHA-256 é persistido. Login/registo rodam sessões, logout revoga e autenticação rejeita expiração/revogação.
- Cookie `Secure`: automático por `X-Forwarded-Proto: https`, ou configurável com `AUTH_COOKIE_SECURE`.
- CSRF: mutações exigem `Origin` exatamente igual a protocolo+host. Login tem throttle em memória, deliberadamente não distribuído, e erro genérico contra enumeração.

## Persistência e migração

O agregado `RecurringExpense` mantém os campos comuns; detalhes de eletricidade, telecom, banca e subscrição são tipados. `ExpenseSnapshot` é histórico append-only. Findings e ações ligam-se à despesa e herdam isolamento pelo proprietário. `MarketObservation` é inteligência de mercado anónima, sem identidade pessoal.

Sem `DATABASE_URL`, `JsonFileRepository` grava estado v2 (`owner`, `sessions`, despesas, snapshots, findings, ações e observações anónimas). Aceita v1 e migra na próxima escrita. Cada operação relê o ficheiro dentro de uma fila partilhada por caminho e grava temporário+rename; toda a estrutura e relações são validadas antes de uso. Conta, primeira sessão e reivindicação legada são uma única mutação, logo um crash não deixa a conta sem dados reclamáveis. Login e autenticação repetem a reivindicação idempotente se o marcador faltar.

Com PostgreSQL, o schema Drizzle acrescenta `password_hash`, `owner_key`, `legacy_claimed_at` e `auth_sessions`. O registo usa uma transação Drizzle: cria o proprietário, atualiza apenas `recurring_expenses.user_id` do UUID legado e cria a sessão. As tabelas ligadas não são reescritas. A constraint única de `owner_key` arbitra concorrência. Observações de mercado não são tocadas.

## Fronteiras HTTP e UI

Middleware Nitro autentica o hash do cookie e coloca apenas o utilizador público em `event.context.auth`. Handlers protegidos chamam `getAuthenticatedUserId`; não leem IDs do corpo. `PUBLIC_ORIGIN` fixa a origem CSRF canónica. Cabeçalhos de proxy só participam no protocolo, host e IP do throttle com `TRUST_PROXY=true`; a predefinição usa exclusivamente ligação, host e IP diretos. Públicos: disponibilidade de registo, sessão, login, registo, logout e página metodológica. `GET /api/setup` autenticado responde apenas `{ onboardingNeeded, storageMode }`.

Middleware de rota envia uma instalação sem proprietário para `/register`, visitantes posteriores para `/login`, e um proprietário sem despesas para `/welcome`. O dashboard segue o arquétipo Monitor: contexto compacto, intervalo potencial principal, realizado secundário e lista de ações. O wizard segue Configure: sete exemplos mapeados para os cinco DTOs reais, perguntas condicionais e divulgação dos checks disponíveis/indisponíveis. `/how-it-works` segue Decide/Learn e documenta as regras auditáveis implementadas. A análise corre ao criar/atualizar dados; avisos temporais de seguros são também reconciliados nas leituras de despesas e recomendações.

## Regras implementadas

- Subscrição: última utilização há 60 dias ou mais.
- Aumento: pelo menos 10% e 2 € desde o primeiro snapshot; na criação existe apenas um snapshot, pelo que a monitorização começa indisponível até uma observação posterior.
- Telecom: fidelização terminada com base apenas na data de fim (início opcional); benchmark acima de p75 com 10 casos PT comparáveis dos últimos 12 meses.
- Banco: comissão de manutenção positiva, estimativa de 80–100%.
- Eletricidade: potência contratada pelo menos 1 kVA acima do máximo e primeiro escalão padrão viável entre 1,15; 2,3; 3,45; 4,6; 5,75; 6,9; 10,35; 13,8; 17,25; 20,7; 27,6; 34,5 e 41,4 kVA. Se nenhum escalão cobrir o máximo histórico, não é criado finding.

Um estado saudável sem finding é válido; falta de dados opcionais é apresentada como check indisponível.
