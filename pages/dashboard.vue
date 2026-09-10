<script setup lang="ts">
import type { FamilyAuditCase, FamilyRoute } from '../domain/family-route'
import type { RecurringExpense } from '../domain/types'

const requestFetch = useRequestFetch()
const setup = await requestFetch<{ onboardingNeeded: boolean }>('/api/setup')
if (setup.onboardingNeeded) await navigateTo('/welcome')
const store = useSavingsStore()
await callOnce(() => store.refresh(requestFetch))

const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value)) : 'sem atualização registada'
const dashboard = computed<FamilyRoute | null>(() => store.dashboard)
const actionView = computed(() => {
  const route = dashboard.value
  if (!route) return null
  const action = route.nextAction
  if (action.kind === 'insurance_renewal') {
    const item = route.cases.find((item: FamilyAuditCase) => item.expense.id === action.expenseId)?.expense
      || store.expenses.find((expense: RecurringExpense) => expense.id === action.expenseId)
    return { label: 'Prazo civil', title: `Rever a renovação de ${item?.productName || 'seguro'}`, body: `Faltam ${action.daysUntil} dias. Confirma coberturas, prémio e condições com documentação atual.`, href: `/expenses/${action.expenseId}` }
  }
  if (action.kind === 'estimated_finding' || action.kind === 'factual_finding') {
    const item = route.cases.find((item: FamilyAuditCase) => item.finding.id === action.findingId)
    return { label: action.kind === 'estimated_finding' ? 'Estimativa · por confirmar' : 'Evidência · revisão factual', title: item?.finding.title || 'Rever caso', body: item?.finding.action || 'Confirma os dados antes de decidir.', href: `/findings?open=${action.findingId}` }
  }
  if (action.kind === 'spending_limit_experiment') return { label: 'Plano condicional · escolhido por ti', title: 'Testar o teu limite durante um mês', body: `${money(action.conditionalAnnualCents)} por ano é apenas a equivalência do limite declarado, não uma redução confirmada.`, href: '/spending' }
  if (action.kind === 'build_own_history') return { label: 'Histórico próprio', title: 'Registar mais um mês comparável', body: `Faltam ${action.missingMonths} ${action.missingMonths === 1 ? 'mês' : 'meses'} para formar uma base própria de três meses.`, href: '/spending' }
  if (action.kind === 'empty') return { label: 'Começar', title: 'Registar a primeira despesa familiar', body: 'Os dados são introduzidos e atualizados manualmente. Só mostramos o que pode ser sustentado.', href: '/spending' }
  return { label: 'Sem urgências', title: 'Dados revistos, sem ação prioritária', body: 'Atualiza uma despesa ou regista o mês seguinte quando tiveres dados novos.', href: '/expenses' }
})
</script>

<template>
  <div class="today-page">
    <header class="today-header">
      <div>
        <div class="section-kicker">
          Auditoria de despesas familiares
        </div>
        <h1>Hoje</h1>
        <p>Uma decisão de cada vez, com atualização manual e prova visível.</p>
      </div>
      <v-btn
        color="primary"
        to="/spending"
      >
        Registar
      </v-btn>
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
        class="family-route"
        aria-labelledby="family-route-title"
      >
        <div class="ledger-caption">
          Rota Familiar · uma próxima ação
        </div>
        <span class="evidence-label">{{ actionView.label }}</span>
        <h2 id="family-route-title">
          {{ actionView.title }}
        </h2>
        <p>{{ actionView.body }}</p>
        <NuxtLink
          class="route-action"
          :to="actionView.href"
        >
          Abrir e decidir →
        </NuxtLink>
      </section>

      <section
        class="family-ledger"
        aria-labelledby="ledger-title"
      >
        <div class="ledger-heading">
          <div>
            <div class="ledger-caption">
              Valores separados por grau de certeza
            </div>
            <h2 id="ledger-title">
              Extrato familiar
            </h2>
          </div>
          <small>Atualizado: {{ date(dashboard.lastUpdatedAt) }}</small>
        </div>
        <dl class="ledger-values">
          <div>
            <dt>Recorrente mensal · Confirmado</dt>
            <dd>{{ money(dashboard.monthlyRecurringConfirmedCents) }}</dd>
          </div>
          <div>
            <dt>Redução anual confirmada</dt>
            <dd>{{ money(dashboard.confirmedAnnualCents) }}</dd>
          </div>
          <div>
            <dt>Objetivo</dt>
            <dd>{{ dashboard.goal ? money(dashboard.goal.targetAnnualCents) : 'Por definir' }}</dd>
            <small v-if="dashboard.goal">{{ dashboard.goal.name }} · {{ dashboard.goal.percentage }}% com ações confirmadas</small>
          </div>
        </dl>
        <p
          v-if="dashboard.identifiedMonthlyRangeCents.maxCents > 0"
          class="ledger-note"
        >
          <strong>Estimativa identificada, não confirmada:</strong> {{ money(dashboard.identifiedMonthlyRangeCents.minCents) }}–{{ money(dashboard.identifiedMonthlyRangeCents.maxCents) }}/mês. Um único caso por despesa evita sobreposição.
        </p>
        <p
          v-if="dashboard.conditionalAnnualPlanCents > 0"
          class="ledger-note"
        >
          <strong>Plano condicional anual:</strong> {{ money(dashboard.conditionalAnnualPlanCents) }} segundo limites escolhidos por ti; habitação fica fora deste plano.
        </p>
      </section>

      <section aria-labelledby="cases-title">
        <div class="section-heading">
          <div>
            <h2 id="cases-title">
              Casos de auditoria
            </h2>
            <p>Um caso representativo por contrato, com Estimativa ou Evidência factual.</p>
          </div>
          <NuxtLink
            class="text-link"
            to="/findings"
          >
            Ver arquivo
          </NuxtLink>
        </div>
        <ol
          v-if="dashboard.cases.length"
          class="audit-cases"
        >
          <li
            v-for="item in dashboard.cases"
            :key="item.expense.id"
          >
            <NuxtLink :to="`/findings?open=${item.finding.id}`">
              <span>
                <small>{{ item.expense.provider }} · {{ item.expense.productName }}</small>
                <strong>{{ item.finding.title }}</strong>
                <span>{{ item.finding.evidence[0] || item.finding.description }}</span>
              </span>
              <b v-if="item.evidenceKind === 'estimate'">Estimativa<br>{{ money(item.monthlySavingMinCents) }}–{{ money(item.monthlySavingMaxCents) }}</b>
              <b v-else>Evidência<br>Sem valor estimado</b>
            </NuxtLink>
          </li>
        </ol>
        <div
          v-else
          class="ledger-empty"
        >
          Sem casos abertos. Isto não significa uma perda de 0 €; significa apenas que não há evidência para apresentar.
        </div>
      </section>

      <section aria-labelledby="decisions-title">
        <div class="section-heading">
          <div>
            <h2 id="decisions-title">
              Decisões confirmadas
            </h2>
            <p>Só entram no objetivo depois de confirmares o novo custo.</p>
          </div>
        </div>
        <ul
          v-if="dashboard.decisions.length"
          class="decision-ledger"
        >
          <li
            v-for="decision in dashboard.decisions"
            :key="decision.id"
          >
            <span>{{ new Intl.DateTimeFormat('pt-PT').format(new Date(`${decision.actionDate}T12:00:00Z`)) }}</span>
            <strong>{{ money(decision.annualSavingCents) }}/ano · Confirmado</strong>
          </li>
        </ul>
        <p
          v-else
          class="ledger-empty"
        >
          Ainda sem reduções confirmadas.
        </p>
      </section>

      <aside class="ai-method-note">
        <strong>Critérios verificáveis:</strong> a rota aplica prioridades explícitas aos dados que atualizas. Não inventa preços, perdas ou provas.
      </aside>
    </template>
  </div>
</template>
