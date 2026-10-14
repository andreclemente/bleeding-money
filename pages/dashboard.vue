<script setup lang="ts">
import type { FamilyAuditCase, FamilyRoute } from '../domain/family-route'
import type { RecurringExpense } from '../domain/types'

const requestFetch = useRequestFetch()
const setup = await requestFetch<{ onboardingNeeded: boolean }>('/api/setup')
if (setup.onboardingNeeded) await navigateTo('/welcome')
const store = useSavingsStore()
await callOnce(() => store.refresh(requestFetch))

const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value)) : 'sem atualização'
const percentage = (value: number, target: number) => target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0
const dashboard = computed<FamilyRoute | null>(() => store.dashboard)

const actionView = computed(() => {
  const route = dashboard.value
  if (!route) return null
  const action = route.nextAction
  if (action.kind === 'insurance_renewal') {
    const item = route.cases.find((item: FamilyAuditCase) => item.expense.id === action.expenseId)?.expense
      || store.expenses.find((expense: RecurringExpense) => expense.id === action.expenseId)
    return { signal: 'Prazo', title: `Rever ${item?.productName || 'seguro'}`, body: `Faltam ${action.daysUntil} dias para a renovação. Confirma coberturas, prémio e condições.`, why: 'Os prazos até 15 dias passam à frente das restantes oportunidades.', href: `/expenses/${action.expenseId}`, cta: 'Abrir contrato' }
  }
  if (action.kind === 'estimated_finding' || action.kind === 'factual_finding') {
    const item = route.cases.find((item: FamilyAuditCase) => item.finding.id === action.findingId)
    return { signal: action.kind === 'estimated_finding' ? 'Estimativa' : 'Facto', title: item?.finding.title || 'Rever caso', body: item?.finding.action || 'Confirma os dados antes de decidir.', why: action.kind === 'estimated_finding' ? 'É o caso aberto com maior prioridade e impacto identificável.' : 'Não há uma estimativa segura, mas existe um facto que merece revisão.', href: `/findings?open=${action.findingId}`, cta: 'Analisar caso' }
  }
  if (action.kind === 'spending_limit_experiment') return { signal: 'Experiência', title: 'Testar o teu limite durante um mês', body: `${money(action.conditionalAnnualCents)} por ano é a equivalência do limite que escolheste — não uma redução confirmada.`, why: 'Não há contratos urgentes; esta é a próxima hipótese que podes validar com dados reais.', href: '/spending', cta: 'Abrir registo mensal' }
  if (action.kind === 'define_goal') return { signal: 'Destino', title: 'Dar um destino às reduções confirmadas', body: `Já confirmaste ${money(action.confirmedAnnualCents)} por ano. Não representa dinheiro já depositado.`, why: 'Existe uma redução real, mas ainda não está ligada a um objetivo.', href: '/savings-goal', cta: 'Definir objetivo' }
  if (action.kind === 'build_own_history') return { signal: 'Base própria', title: 'Registar mais um mês comparável', body: `Faltam ${action.missingMonths} ${action.missingMonths === 1 ? 'mês' : 'meses'} para comparar a família consigo própria.`, why: 'O teu histórico é mais útil do que uma média externa e tem prioridade quando ainda está incompleto.', href: '/spending', cta: 'Registar mês' }
  if (action.kind === 'empty') return { signal: 'Primeiro dado', title: 'Registar uma despesa real', body: 'Começa por um total mensal ou por um contrato. Não é necessário reconstruir todo o orçamento.', why: 'Sem um valor real, o produto não inventa uma recomendação.', href: '/spending', cta: 'Começar pelo mês' }
  return { signal: 'Em dia', title: 'Sem ação urgente', body: 'Atualiza apenas quando tiveres um novo valor, fatura ou renovação.', why: 'Os dados atuais não sustentam uma intervenção prioritária.', href: '/expenses', cta: 'Rever contratos' }
})

const activeCase = computed(() => {
  const route = dashboard.value
  if (!route) return null
  const action = route.nextAction
  if (action.kind !== 'estimated_finding' && action.kind !== 'factual_finding') return null
  return route.cases.find((item: FamilyAuditCase) => item.finding.id === action.findingId) || null
})

const goalImpact = computed(() => {
  const route = dashboard.value
  const goal = route?.goal
  const item = activeCase.value
  if (!route || !goal || !item || item.evidenceKind !== 'estimate') return null
  const current = route.confirmedAnnualCents
  const minAnnual = item.monthlySavingMinCents * 12
  const maxAnnual = item.monthlySavingMaxCents * 12
  return {
    currentPercentage: percentage(current, goal.targetAnnualCents),
    minPercentage: percentage(current + minAnnual, goal.targetAnnualCents),
    maxPercentage: percentage(current + maxAnnual, goal.targetAnnualCents),
    minAnnual,
    maxAnnual
  }
})

const shieldChecks = computed(() => {
  const route = dashboard.value
  if (!route) return []
  return [
    { label: 'Mapa iniciado', detail: `${store.expenses.length} ${store.expenses.length === 1 ? 'despesa' : 'despesas'}`, done: store.expenses.length > 0 },
    { label: 'Casos resolvidos', detail: route.cases.length ? `${route.cases.length} por rever` : 'nenhum pendente', done: route.cases.length === 0 },
    { label: 'Resultado comprovado', detail: route.decisions.length ? `${route.decisions.length} confirmado` : 'ainda sem prova', done: route.decisions.length > 0 },
    { label: 'Destino definido', detail: route.goal?.name || 'sem objetivo', done: Boolean(route.goal) }
  ]
})
const shieldScore = computed(() => shieldChecks.value.filter((item: { done: boolean }) => item.done).length * 25)
const shieldLabel = computed(() => shieldScore.value >= 75 ? 'Boa preparação' : shieldScore.value >= 50 ? 'Em construção' : 'Primeiros passos')
</script>

<template>
  <div class="today-page">
    <header class="today-header">
      <div>
        <div class="section-kicker">
          Centro de decisão familiar
        </div>
        <h1>Uma coisa útil hoje.</h1>
        <p>Sem orçamento completo. Sem culpa. Uma decisão de cada vez.</p>
        <NuxtLink
          class="quick-register"
          to="/spending"
        >
          Registar novo valor +
        </NuxtLink>
      </div>
      <details class="family-shield">
        <summary>
          <span
            class="shield-ring"
            :style="{ '--shield-score': `${shieldScore}%` }"
          ><b>{{ shieldScore }}</b></span>
          <span><strong>Escudo Familiar</strong><small>{{ shieldLabel }}</small></span>
        </summary>
        <div class="shield-breakdown">
          <div
            v-for="check in shieldChecks"
            :key="check.label"
            :class="{ done: check.done }"
          >
            <span>{{ check.done ? '✓' : '·' }}</span><strong>{{ check.label }}</strong><small>{{ check.detail }}</small>
          </div>
          <p>4 critérios com o mesmo peso. Mede preparação, não riqueza.</p>
        </div>
      </details>
    </header>

    <div
      v-if="store.loading && !dashboard"
      class="monitor-loading"
      aria-busy="true"
    >
      A preparar a rota…
    </div>

    <template v-else-if="dashboard && actionView">
      <section
        class="decision-workbench"
        aria-labelledby="family-route-title"
      >
        <div class="route-console">
          <div class="route-console__meta">
            <span>Missão familiar</span>
            <span>Prioridade 01</span>
          </div>
          <div class="route-console__signal">
            {{ actionView.signal }}
          </div>
          <h2 id="family-route-title">
            {{ actionView.title }}
          </h2>
          <p>{{ actionView.body }}</p>
          <NuxtLink
            class="route-action"
            :to="actionView.href"
          >
            {{ actionView.cta }} <span aria-hidden="true">→</span>
          </NuxtLink>
          <details class="route-reason">
            <summary>Porque aparece primeiro?</summary>
            <p>{{ actionView.why }}</p>
          </details>
        </div>

        <aside
          class="impact-console"
          aria-labelledby="impact-title"
        >
          <div class="data-label">
            Objetivo · ações confirmadas
          </div>
          <template v-if="goalImpact && dashboard.goal">
            <h2 id="impact-title">
              Se confirmares este caso
            </h2>
            <strong class="impact-range">{{ goalImpact.minPercentage }}–{{ goalImpact.maxPercentage }}%</strong>
            <p>O objetivo passaria de {{ goalImpact.currentPercentage }}% para este intervalo.</p>
            <div
              class="impact-track"
              aria-hidden="true"
            >
              <span :style="{ width: `${goalImpact.currentPercentage}%` }" /><i :style="{ left: `${goalImpact.minPercentage}%`, width: `${goalImpact.maxPercentage - goalImpact.minPercentage}%` }" />
            </div>
            <small>Cenário: {{ money(goalImpact.minAnnual) }}–{{ money(goalImpact.maxAnnual) }}/ano. Só avança depois de confirmares o novo custo.</small>
          </template>
          <template v-else-if="dashboard.goal">
            <h2 id="impact-title">
              {{ dashboard.goal.name }}
            </h2>
            <strong class="impact-range">{{ dashboard.goal.percentage }}%</strong>
            <p>{{ money(dashboard.goal.remainingAnnualCents) }} por confirmar até à meta anual.</p>
            <NuxtLink to="/savings-goal">
              Ver objetivo →
            </NuxtLink>
          </template>
          <template v-else>
            <h2 id="impact-title">
              Dar um destino às reduções confirmadas
            </h2>
            <p>Quando houver uma redução confirmada, liga-a a uma meta familiar concreta.</p>
            <NuxtLink to="/savings-goal">
              Preparar objetivo →
            </NuxtLink>
          </template>
        </aside>
      </section>

      <section class="bleeding-map">
        <div class="map-heading">
          <div><span>Mapa BleedingMoney</span><h2>Onde estamos</h2></div>
          <small>Valores separados por grau de certeza</small>
        </div>
        <div
          class="certainty-ledger"
          aria-label="Extrato familiar por grau de certeza"
        >
          <div><span>Comprometido</span><strong>{{ money(dashboard.monthlyRecurringConfirmedCents) }}/mês</strong><small>custos conhecidos</small></div>
          <div class="ledger-attention">
            <span>Em análise</span><strong>{{ dashboard.identifiedMonthlyRangeCents.maxCents ? `${money(dashboard.identifiedMonthlyRangeCents.minCents)}–${money(dashboard.identifiedMonthlyRangeCents.maxCents)}` : '—' }}</strong><small>estimativa mensal</small>
          </div>
          <div><span>Plano escolhido</span><strong>{{ dashboard.conditionalAnnualPlanCents ? money(dashboard.conditionalAnnualPlanCents) : '—' }}</strong><small>condicional / ano</small></div>
          <div class="ledger-recovered">
            <span>Recuperado</span><strong>{{ money(dashboard.confirmedAnnualCents) }}/ano</strong><small>Redução anual confirmada · Evidência manual</small>
          </div>
        </div>
      </section>

      <div class="operational-grid">
        <section aria-labelledby="cases-title">
          <div class="section-heading compact-heading">
            <div>
              <div class="data-label">
                Fila de trabalho
              </div><h2 id="cases-title">
                Casos seguintes
              </h2>
            </div>
            <NuxtLink
              class="text-link"
              to="/findings"
            >
              Abrir arquivo
            </NuxtLink>
          </div>
          <ol
            v-if="dashboard.cases.length"
            class="audit-cases"
          >
            <li
              v-for="(item, index) in dashboard.cases.slice(0, 4)"
              :key="item.expense.id"
            >
              <NuxtLink :to="`/findings?open=${item.finding.id}`">
                <span class="case-index">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="case-copy"><small>{{ item.expense.provider }} · {{ item.expense.productName }}</small><strong>{{ item.finding.title }}</strong></span>
                <b v-if="item.evidenceKind === 'estimate'">{{ money(item.monthlySavingMinCents) }}–{{ money(item.monthlySavingMaxCents) }}<small>/mês · estimativa</small></b>
                <b v-else>Rever facto<small>sem valor estimado</small></b>
              </NuxtLink>
            </li>
          </ol>
          <div
            v-else
            class="ledger-empty"
          >
            Sem casos abertos. Não assumimos que isso equivale a uma perda de 0 €.
          </div>
        </section>

        <section aria-labelledby="decisions-title">
          <div class="section-heading compact-heading">
            <div>
              <div class="data-label">
                Evidência de resultado
              </div><h2 id="decisions-title">
                Últimas confirmações
              </h2>
            </div>
          </div>
          <ul
            v-if="dashboard.decisions.length"
            class="decision-ledger"
          >
            <li
              v-for="decision in dashboard.decisions.slice(0, 4)"
              :key="decision.id"
            >
              <span>{{ new Intl.DateTimeFormat('pt-PT').format(new Date(`${decision.actionDate}T12:00:00Z`)) }}</span><strong>{{ money(decision.annualSavingCents) }}/ano</strong>
            </li>
          </ul>
          <div
            v-else
            class="decision-empty"
          >
            <strong>Ainda sem reduções confirmadas</strong><p>Uma estimativa só entra aqui depois de registares o novo custo real.</p>
          </div>
        </section>
      </div>

      <footer class="audit-footer">
        <span>Atualização: {{ date(dashboard.lastUpdatedAt) }}</span><NuxtLink to="/how-it-works">
          Consultar critérios verificáveis →
        </NuxtLink>
      </footer>
    </template>
  </div>
</template>
