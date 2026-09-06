Quero que desenvolvas uma aplicação web chamada provisoriamente **Poupanças**, focada em identificar dinheiro que uma pessoa ou agregado familiar está a gastar desnecessariamente em **despesas recorrentes**.

O conceito NÃO é criar mais uma aplicação de budgeting nem mais um comparador de preços.

A ideia central é:

> **Um auditor contínuo das despesas recorrentes que identifica desperdício, planos sobredimensionados, preços acima do normal, aumentos, contratos esquecidos e oportunidades concretas de poupança.**

A aplicação deve responder principalmente à pergunta:

> **“Onde estou a perder dinheiro sem me aperceber?”**

---

# 1. PRINCÍPIO DO PRODUTO

Não queremos que o utilizador tenha de categorizar cada compra, supermercado, restaurante, combustível, etc.

Não queremos competir com YNAB, Wallet, Spendee ou aplicações tradicionais de gestão financeira.

Queremos acompanhar apenas despesas recorrentes ou previsíveis, por exemplo:

* eletricidade;
* gás;
* água;
* internet;
* televisão;
* telemóveis;
* seguros;
* contas bancárias;
* cartões;
* subscrições digitais;
* cloud storage;
* SaaS;
* ginásios;
* memberships;
* créditos;
* eventualmente outras despesas regulares.

Cada despesa deve ser vista como um **contrato/serviço que pode ou não estar saudável**.

A aplicação deve conseguir determinar situações como:

* plano sobredimensionado;
* utilização muito inferior ao contratado;
* aumento progressivo do preço;
* fim de fidelização;
* desconto promocional terminado;
* serviço duplicado;
* serviço aparentemente não utilizado;
* comissão evitável;
* preço acima do mercado;
* preço acima do que outros utilizadores pagam;
* oportunidade de renegociação;
* existência de alternativa significativamente mais barata;
* contrato antigo que nunca foi revisto.

---

# 2. POSICIONAMENTO

Não apresentar o produto como:

> “Compare preços e encontre o fornecedor mais barato.”

Apresentá-lo como:

> **“Nós analisamos continuamente as tuas despesas fixas e avisamos quando estás a pagar mais do que precisas.”**

A comparação de mercado é apenas uma ferramenta dentro do produto.

O produto deve ser útil mesmo quando NÃO existe nenhuma alternativa de fornecedor.

Por exemplo:

* potência elétrica demasiado alta;
* subscrição não utilizada;
* comissão bancária;
* serviço duplicado;
* preço que aumentou;
* contrato que terminou;
* plano de dados muito acima da utilização real.

---

# 3. STACK PREFERENCIAL

Usar preferencialmente:

Frontend:

* Nuxt 3;
* Vue 3;
* Composition API;
* TypeScript;
* Pinia;
* Vuetify 3.

Backend:

* inicialmente pode ser integrado no próprio Nuxt através de server routes/Nitro;
* estruturar, no entanto, o domínio de forma a ser possível separar o backend posteriormente sem reescrever a lógica de negócio.

Database:

* PostgreSQL.

ORM:

* escolher uma solução madura e adequada a TypeScript/PostgreSQL, preferencialmente Drizzle ou Prisma;
* justificar brevemente a escolha antes de implementar.

Autenticação:

* arquitetura preparada para autenticação;
* para o primeiro protótipo pode existir apenas um utilizador de desenvolvimento;
* não gastar demasiado tempo inicialmente em OAuth/social login.

Infraestrutura:

* Docker;
* docker-compose para desenvolvimento local;
* configuração através de environment variables.

Código:

* TypeScript sempre que possível;
* modular;
* evitar lógica de negócio dentro de componentes Vue;
* domínio e analyzers devem ser testáveis isoladamente.

Estilo de código:

* sem semicolons;
* single quotes;
* sem trailing commas quando não forem necessários.

---

# 4. MVP

O MVP deve suportar inicialmente quatro áreas:

1. Eletricidade
2. Telecomunicações
3. Bancos
4. Subscrições

Não implementar já:

* seguros complexos;
* créditos;
* Open Banking;
* troca automática de fornecedor;
* integrações comerciais;
* aplicações mobile nativas.

Devemos conseguir demonstrar claramente o conceito apenas com estas quatro categorias.

---

# 5. EXPERIÊNCIA INICIAL DO UTILIZADOR

O onboarding deve ser extremamente simples.

Primeiro acesso:

> “Vamos descobrir quanto dinheiro estás a perder todos os meses.”

CTA:

> “Adicionar primeira despesa”

Métodos:

1. introduzir manualmente;
2. posteriormente enviar fatura/PDF/fotografia.

Para o primeiro MVP, IMPLEMENTAR primeiro a introdução manual.

Deixar uma interface/abstração preparada para futuramente existir:

```ts
DocumentParser
PdfInvoiceParser
ImageInvoiceParser
```

mas não implementar OCR neste momento.

---

# 6. MODELO DE DADOS PRINCIPAL

Não modelar tudo como simples transactions.

Criar uma entidade central semelhante a:

```ts
RecurringExpense
```

Campos base possíveis:

```ts
id
userId

category
provider
productName

monthlyCost
billingFrequency
currency

contractStartDate
contractEndDate
commitmentEndDate

createdAt
updatedAt
```

Mas diferentes categorias precisam de propriedades específicas.

Evitar criar uma tabela com 50 colunas nullable.

Criar uma arquitetura apropriada para dados específicos por categoria.

Exemplos:

Eletricidade:

```ts
electricityDetails: {
  contractedPowerKva
  tariffType
  pricePerKwh
  powerPricePerDay
  annualConsumptionKwh
  maxHistoricalPowerKva
}
```

Telecom:

```ts
telecomDetails: {
  connectionType
  downloadSpeedMbps
  uploadSpeedMbps
  mobileDataGb
  mobileLines
  tvIncluded
}
```

Banco:

```ts
bankDetails: {
  accountMaintenanceFee
  cardAnnualFee
  transferFees
}
```

Subscrição:

```ts
subscriptionDetails: {
  plan
  lastUsedAt
  usageFrequency
}
```

Escolher uma estrutura de dados coerente e extensível.

---

# 7. HISTÓRICO

Isto é MUITO importante.

Não queremos apenas guardar o estado atual de uma despesa.

Queremos conseguir saber:

```text
Vodafone

Jan 2025    34.90 €
Jul 2025    36.90 €
Jan 2026    39.90 €
Ago 2026    44.90 €
```

Criar uma entidade semelhante a:

```ts
ExpenseObservation
```

ou:

```ts
ExpenseSnapshot
```

com:

```ts
expenseId
observedAt
price
plan
properties
source
```

A aplicação deve conseguir detectar alterações históricas.

---

# 8. MARKET OBSERVATIONS

Os dados introduzidos pelos utilizadores devem também poder alimentar, de forma anonimizada/agregável, uma base de conhecimento do mercado.

Criar conceito:

```ts
MarketObservation
```

Exemplo:

```ts
{
  category: 'telecom',
  provider: 'Vodafone',
  productType: 'fiber',
  attributes: {
    speedMbps: 500
  },
  monthlyPrice: 34.90,
  negotiated: true,
  observedAt: '2026-08-15',
  source: 'user_contract',
  confidence: 0.95
}
```

IMPORTANTE:

Nunca depender diretamente dos dados pessoais do utilizador para benchmarks.

Separar claramente:

```text
USER DATA

dados pessoais
contratos
documentos
despesas

        ↓ normalização

MARKET OBSERVATIONS

sem nome
sem email
sem morada exata
sem documentos
sem identificadores pessoais
```

Preparar esta separação desde o início.

---

# 9. MARKET CATALOG

Criar também uma camada independente chamada, por exemplo:

```ts
MarketOffer
```

Esta representa ofertas públicas disponíveis no mercado.

Exemplo:

```ts
{
  provider: 'Goldenergy',
  category: 'electricity',
  productName: 'XPTO',
  validFrom: ...,
  validUntil: ...,
  attributes: {...},
  pricing: {...},
  source: 'ERSE'
}
```

No futuro estes dados virão de:

* ERSE;
* ANACOM;
* Banco de Portugal;
* APIs;
* imports CSV/Excel;
* eventualmente scrapers ou integrações.

No MVP não é necessário criar todas estas integrações.

Criar uma estrutura de **MarketDataProvider** extensível:

```ts
interface MarketDataProvider {
  sync(): Promise<MarketOffer[]>
}
```

Podemos criar inicialmente dados fake/fixtures para testar o sistema.

---

# 10. SAVINGS ENGINE

Este é o coração da aplicação.

Não implementar condições diretamente no frontend.

Criar um sistema de analyzers/rules independente.

Exemplo:

```ts
interface SavingsAnalyzer {
  supports(expense: RecurringExpense): boolean

  analyze(
    expense: RecurringExpense,
    context: SavingsContext
  ): Promise<SavingsFinding[]>
}
```

Cada analyzer deve ter uma responsabilidade específica.

Exemplos:

```text
ElectricityContractedPowerAnalyzer
ElectricityMarketPriceAnalyzer

TelecomMarketPriceAnalyzer
TelecomContractExpirationAnalyzer
TelecomPriceIncreaseAnalyzer

BankMaintenanceFeeAnalyzer
BankCardFeeAnalyzer

SubscriptionUnusedAnalyzer
SubscriptionPriceIncreaseAnalyzer

DuplicateServiceAnalyzer
```

---

# 11. SAVINGS FINDINGS

Cada analyzer deve devolver resultados normalizados.

Criar entidade/tipo semelhante a:

```ts
SavingsFinding
```

Campos:

```ts
id
expenseId

type

title
description

estimatedMonthlySavingMin
estimatedMonthlySavingMax

estimatedAnnualSavingMin
estimatedAnnualSavingMax

confidence

severity
priority

action

evidence

createdAt
resolvedAt
dismissedAt
```

Tipos iniciais:

```ts
enum FindingType {
  UNDERUTILIZATION
  PRICE_INCREASE
  MARKET_OVERPRICED
  CONTRACT_EXPIRING
  CONTRACT_EXPIRED
  DUPLICATE_SERVICE
  UNUSED_SERVICE
  WRONG_PLAN
  AVOIDABLE_FEE
  NEGOTIATION_OPPORTUNITY
}
```

Confidence:

```text
0.0 - 1.0
```

Severity:

```text
info
low
medium
high
```

Não mostrar recomendações como certezas quando não forem certezas.

Exemplo:

> “Poupança estimada: 120–180 €/ano”

é preferível a:

> “Vais poupar 154,72 €.”

quando existe incerteza.

---

# 12. EXEMPLO: ELETRICIDADE

Despesa:

```text
Fornecedor: EDP
Mensalidade média: 82 €
Potência contratada: 6.9 kVA
Máximo histórico: 3.8 kVA
```

Analyzer:

```ts
ElectricityContractedPowerAnalyzer
```

Resultado:

```text
Potência contratada possivelmente excessiva

Nunca ultrapassaste 3.8 kVA nos últimos 12 meses.
Tens atualmente 6.9 kVA contratados.

Pode ser possível reduzir para 4.6 kVA.

Poupança estimada:
4–6 €/mês
48–72 €/ano

Confiança:
94%
```

---

# 13. EXEMPLO: TELECOM

Dados:

```text
Vodafone
500 Mbps
48.90 €/mês

Preço inicial:
36.90 €

Fidelização:
terminou há 5 meses
```

Market observations:

```text
500 Mbps Vodafone

median: 36.90 €
p25: 32.90 €
p75: 41.90 €
```

Resultado:

```text
Estás a pagar acima do normal

O teu preço aumentou 32% desde o início do contrato.

Contratos semelhantes registados recentemente:
32.90 € – 41.90 €/mês

Estás a pagar:
48.90 €/mês

Poupança potencial:
7–16 €/mês

Recomendação:
Renegociar primeiro com o fornecedor atual.
```

---

# 14. BENCHMARKS DA COMUNIDADE

Criar uma camada para calcular benchmarks a partir de MarketObservation.

Precisamos eventualmente de:

```text
count
min
max
average
median
p25
p75
```

Mas não apresentar benchmarks se existir uma amostra ridiculamente pequena.

Criar configuração como:

```ts
MIN_BENCHMARK_SAMPLE_SIZE = 10
```

Abaixo disso:

> “Ainda não existem dados suficientes para comparar.”

Preparar também filtragem por atributos relevantes.

Por exemplo:

```text
Vodafone
fibra
500 Mbps
Portugal
últimos 12 meses
```

NÃO comparar simplesmente todos os contratos Vodafone.

---

# 15. SAVINGS REALIZED

Outra funcionalidade central.

O utilizador deve conseguir marcar uma recomendação como:

```text
Resolvida
```

e indicar o resultado.

Por exemplo:

```text
Preço anterior:
48.90 €

Novo preço:
34.90 €
```

Criar:

```ts
SavingAction
```

ou equivalente:

```ts
{
  findingId
  previousCost
  newCost
  actionDate
  annualSaving
}
```

Isto permite mostrar:

> **Já estás a poupar 642 €/ano.**

Separar claramente:

```text
Potential savings
```

de:

```text
Realized savings
```

---

# 16. DASHBOARD

O dashboard principal deve ser extremamente simples.

No topo:

```text
1 487 €
DESPESAS RECORRENTES / MÊS

84 €
DESPERDÍCIO DETETADO / MÊS

642 €
POUPANÇA CONSEGUIDA / ANO
```

Depois:

```text
AÇÕES RECOMENDADAS

1. Renegociar Vodafone
   120–190 €/ano

2. Reduzir potência elétrica
   48–72 €/ano

3. Cancelar subscrição Adobe
   295 €/ano
```

Depois lista das despesas:

```text
Casa

✓ Eletricidade       71.40 €
⚠ Internet           48.90 €
✓ Água               23.50 €

Pessoal

✕ Conta bancária      7.90 €
⚠ Telemóvel          19.90 €
✓ Spotify            11.99 €
```

---

# 17. HEALTH SCORE

Cada despesa deve futuramente ter um score de saúde entre 0 e 100.

Não tornar isto demasiado complexo inicialmente.

Podemos começar com algo simples calculado a partir dos findings:

```text
90–100    excelente
70–89     saudável
50–69     atenção
0–49      provavelmente existe desperdício
```

Exemplo:

```text
Vodafone

43 / 100

⚠ preço acima do benchmark
⚠ aumento de 32%
⚠ fidelização terminada
```

Manter cálculo do score isolado numa função/serviço para podermos alterar posteriormente.

---

# 18. PRIORIDADE DAS RECOMENDAÇÕES

Não ordenar findings apenas pelo valor absoluto.

Considerar:

```text
saving
confidence
effort
urgency
```

Exemplo:

Cancelar subscrição:

```text
saving: 120 €
confidence: 100%
effort: very low
```

deve provavelmente aparecer antes de:

```text
mudar fornecedor de eletricidade
saving: 140 €
confidence: 70%
effort: medium
```

Criar arquitetura preparada para um:

```ts
FindingPriorityCalculator
```

---

# 19. UX

A aplicação deve transmitir confiança.

Evitar linguagem como:

> “Poupa 500 € AGORA!!!”

Preferir:

> “Encontrámos 3 oportunidades que podem reduzir as tuas despesas em aproximadamente 42–61 €/mês.”

Mostrar sempre:

**Porquê estamos a recomendar isto?**

Exemplo:

```text
Porque estamos a recomendar isto?

✓ Nunca ultrapassaste 3.8 kVA
✓ Tens 6.9 kVA contratados
✓ Analisámos 12 meses de dados
```

Evidence deve ser parte integrante de cada Finding.

---

# 20. PRIVACIDADE

Embora o MVP ainda seja local/development, estruturar o sistema tendo em mente GDPR.

Nunca colocar dados pessoais em:

```text
MarketObservation
```

Os documentos originais devem futuramente poder ser eliminados depois da extração, se o utilizador desejar.

Separar:

```text
personal data
```

de:

```text
anonymous market intelligence
```

Não implementar consentimento jurídico completo agora, mas deixar essa separação refletida no domínio.

---

# 21. DADOS DE DEMONSTRAÇÃO

Criar seed com um utilizador de demonstração.

Adicionar aproximadamente 10 despesas:

```text
EDP
Vodafone Internet
Vodafone Mobile
Spotify
Netflix
Adobe
Conta bancária
Google One
Ginásio
Seguro auto
```

Mesmo que seguros ainda não tenham analyzers.

Criar históricos suficientemente interessantes para demonstrar:

* aumento de preço;
* contrato terminado;
* potência excessiva;
* subscrição não utilizada;
* comissão bancária;
* preço acima do benchmark.

Criar também MarketObservations fake suficientes para os benchmarks.

---

# 22. PRIMEIRA VERSÃO A IMPLEMENTAR

Quero que trabalhes incrementalmente.

### Fase 1

Criar:

* estrutura do projeto;
* Docker;
* PostgreSQL;
* ORM;
* schema inicial;
* migrations;
* seed;
* domínio principal.

Entidades mínimas:

```text
User
RecurringExpense
ExpenseSnapshot
MarketObservation
MarketOffer
SavingsFinding
SavingAction
```

### Fase 2

Criar Savings Engine.

Implementar estes analyzers:

```text
SubscriptionUnusedAnalyzer
ExpensePriceIncreaseAnalyzer
TelecomContractExpiredAnalyzer
TelecomMarketBenchmarkAnalyzer
BankMaintenanceFeeAnalyzer
ElectricityContractedPowerAnalyzer
```

Todos devem ter testes unitários.

### Fase 3

API/server routes.

Endpoints aproximados:

```text
GET    /api/expenses
POST   /api/expenses
GET    /api/expenses/:id
PATCH  /api/expenses/:id

GET    /api/findings
GET    /api/findings/:id

POST   /api/findings/:id/resolve
POST   /api/findings/:id/dismiss

GET    /api/dashboard
```

Não é obrigatório seguir estes URLs exatamente se existir uma estrutura REST melhor.

### Fase 4

Interface.

Criar:

```text
/dashboard
/expenses
/expenses/new
/expenses/:id
/findings
```

### Fase 5

Mostrar:

* despesas mensais;
* desperdício potencial;
* poupanças realizadas;
* findings prioritários;
* histórico de cada despesa;
* benchmark quando disponível.

---

# 23. TESTES

Quero testes pelo menos para toda a lógica crítica.

Especialmente:

```text
SavingsAnalyzer
benchmark calculations
annual/monthly saving calculations
health score
finding priority
```

Exemplo de teste:

```ts
it('detects excessive electricity contracted power', ...)
```

Casos limite também devem existir.

Não depender da UI para validar lógica de domínio.

---

# 24. O QUE NÃO FAZER

Não:

* construir microservices;
* adicionar Kafka;
* adicionar Redis sem necessidade;
* implementar Kubernetes;
* implementar AI/LLM no core;
* criar arquitetura desnecessariamente complexa;
* gastar tempo com pixel-perfect design antes do domínio funcionar;
* implementar Open Banking;
* implementar OCR já;
* fazer scraping já;
* integrar pagamentos;
* construir aplicação mobile;
* criar sistema de notificações complexo.

O objetivo inicial é provar:

> **Com dados relativamente simples conseguimos encontrar poupanças reais e explicáveis.**

---

# 25. PREPARAÇÃO PARA O FUTURO

Apesar de não implementar já, a arquitetura deve permitir futuramente:

```text
ERSEDataProvider
ANACOMDataProvider
BankOfPortugalDataProvider
InvoiceParser
OpenBankingProvider
NotificationService
EmailService
```

Também deverá ser possível adicionar novas categorias sem alterar todo o Savings Engine.

Idealmente:

```ts
analyzers.register(new ElectricityAnalyzer())
analyzers.register(new TelecomAnalyzer())
```

ou arquitetura equivalente.

---

# 26. FILOSOFIA DO PRODUTO

O sistema deve preferir dizer:

> “Não encontramos atualmente nenhuma razão para mudares este contrato.”

em vez de inventar uma oportunidade de poupança.

Uma despesa saudável é também um resultado válido.

Cada recomendação deve ser:

```text
explicável
quantificável
acionável
```

Sempre que possível.

---

# 27. PRIMEIRO OBJETIVO DE DEMONSTRAÇÃO

No final desta primeira implementação quero conseguir abrir a aplicação e ver um utilizador fictício onde o sistema automaticamente conclua coisas como:

```text
Encontrámos aproximadamente
57–81 €/mês
em potenciais poupanças.

≈ 684–972 €/ano
```

E conseguir abrir cada finding e perceber imediatamente:

```text
o que está errado;
como foi detetado;
quanto pode poupar;
qual a confiança;
o que deve fazer.
```

Também quero conseguir marcar uma ação como concluída e ver:

```text
Poupança conseguida:
168 €/ano
```

refletida no dashboard.

---

# 28. FORMA DE TRABALHO

Antes de escrever código:

1. analisa estes requisitos;
2. propõe a estrutura do domínio;
3. propõe o schema PostgreSQL;
4. propõe a estrutura de pastas;
5. identifica decisões arquiteturais importantes;
6. identifica ambiguidades que possam ser resolvidas com uma decisão razoável;
7. toma decisões pragmáticas sem bloquear desnecessariamente o desenvolvimento.

Depois começa a implementação.

Não quero apenas um plano teórico.

Depois de definir a arquitetura inicial, **cria efetivamente o projeto, migrations, seed, backend, Savings Engine, testes e primeira interface funcional**.

Trabalha incrementalmente e mantém o projeto executável em cada fase.

Prioriza código funcional e arquitetura sustentável em vez de abstrações prematuras.

O resultado desta primeira fase deve ser um MVP utilizável localmente que demonstre claramente a proposta de valor de **Poupanças**.
