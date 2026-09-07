# Arquitetura do MVP BleedingMoney

## Domínio

`RecurringExpense` é o agregado central: representa um contrato ou serviço recorrente, não uma transação. Campos comuns ficam no agregado e detalhes de eletricidade, telecomunicações, banco e subscrição são objetos tipados separados. Categorias ainda não analisadas usam detalhes genéricos.

`ExpenseSnapshot` preserva preço, plano e propriedades observados ao longo do tempo. `SavingsEngine` recebe despesas e contexto imutável, executa analyzers registados e devolve `SavingsFinding` normalizados. Benchmark, conversão mensal/anual, score e prioridade são funções puras.

`MarketObservation` pertence à inteligência de mercado anónima e nunca contém `userId`, nome, email, morada, documento ou `expenseId`. `MarketOffer` representa catálogo público. `DocumentParser` e `MarketDataProvider` são apenas interfaces; existe um provider de fixtures de ofertas, sem OCR, scraping ou integrações externas.

## Schema PostgreSQL

- `users`: identidade de desenvolvimento, preparada para autenticação
- `recurring_expenses`: campos comuns e montantes em integer minor units com moeda explícita
- `electricity_details`, `telecom_details`, `bank_details`, `subscription_details`: tabelas 1:1 tipadas, com FK única para a despesa
- `expense_snapshots`: histórico append-only de preço, plano, propriedades e fonte
- `market_observations`: amostras anónimas sem FK para utilizadores ou despesas
- `market_offers`: ofertas públicas, atributos e pricing em `jsonb`
- `savings_findings`: resultados explicáveis, evidência em `jsonb`, estado resolvido/dispensado
- `saving_actions`: custo anterior/novo e poupança anual realizada

Datas civis usam `date`; auditoria usa `timestamp with time zone`. UUIDs são gerados pela aplicação. Índices cobrem utilizador/categoria, histórico, filtros de benchmark e findings ativos.

## Estrutura

- `domain/`: entidades, tipos, funções puras, engine, analyzers e ports
- `server/db/`: schema Drizzle, cliente, repositório e seed
- `server/api/`: adaptadores HTTP Nitro
- `stores/`: estado Pinia e API
- `pages/`, `components/`, `layouts/`, `plugins/`: UI Nuxt/Vuetify
- `tests/domain/`: especificação unitária crítica
- `drizzle/`: migrations SQL

## Decisões

Foi escolhido **Drizzle** em vez de Prisma porque mantém o schema próximo de SQL/PostgreSQL, produz migrations transparentes e tipadas, tem runtime pequeno e não exige cliente binário. O domínio não importa Drizzle.

O MVP usa um utilizador de desenvolvimento substituível por um `DevUserContext`; todos os acessos são filtrados por esse utilizador. Com `DATABASE_URL`, a API usa PostgreSQL; sem configuração usa explicitamente um repositório de fixtures em memória para demonstração local, sem alegar persistência. A seed PostgreSQL contém os mesmos dados canónicos. A resolução usa uma transação que valida a transição `open → resolved`, cria uma `SavingAction` imutável, atualiza o custo atual e acrescenta um snapshot.

Benchmarks exigem 10 observações comparáveis, filtradas por categoria, fornecedor, tipo, atributos relevantes, país e 12 meses. Percentis usam interpolação linear. Findings seed demonstram a análise inicial; novas despesas são analisadas pelo serviço.

## Ambiguidades e defaults

- Frequências mensal, trimestral e anual são normalizadas para custo mensal
- Aumento dispara a partir de 10% e pelo menos 2 €/mês
- Subscrição sem uso há 60 dias; sem `lastUsedAt` não há conclusão
- Fidelização telecom terminada gera finding
- Manutenção bancária positiva é evitável; estimativa 80–100% da comissão
- Potência excessiva exige margem de 1,0 kVA sobre o máximo
- Score começa em 100 e desconta severidade ponderada pela confiança
- Prioridade combina poupança anual (45%), confiança (25%), baixo esforço (15%) e urgência (15%)
- Categorias sem analyzer ficam visíveis e não recebem recomendações inventadas
- Poupança realizada é `max(0, custo anterior - custo novo) × 12`
