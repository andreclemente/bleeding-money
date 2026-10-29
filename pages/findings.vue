<script setup lang="ts">
import type { RecurringExpense, SavingAction, SavingsFinding } from '../domain/types'

const store = useSavingsStore()
await callOnce(() => store.refresh())

const route = useRoute()
const router = useRouter()
const selected = ref<string | null>((route.query.open as string) || null)
const busy = ref(false)
const resolutionError = ref('')
const money = (cents: number) => new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(cents / 100)
const current = computed(() => store.findings.find((item: SavingsFinding) => item.id === selected.value))
const currentExpense = computed(() => store.expenses.find((item: RecurringExpense) => item.id === current.value?.expenseId))
const openFindings = computed<SavingsFinding[]>(() => store.findings.filter((item: SavingsFinding) => item.status === 'open'))
const closedFindings = computed<SavingsFinding[]>(() => store.findings
  .filter((item: SavingsFinding) => item.status !== 'open')
  .sort((left: SavingsFinding, right: SavingsFinding) => {
    const leftDate = left.resolvedAt || left.dismissedAt || left.createdAt
    const rightDate = right.resolvedAt || right.dismissedAt || right.createdAt
    return rightDate.localeCompare(leftDate) || left.id.localeCompare(right.id)
  }))
const potentialTotal = computed(() => openFindings.value.reduce((total: number, item: SavingsFinding) => total + item.estimatedMonthlySavingMaxCents, 0))
const hasEstimatedSaving = (finding: SavingsFinding) => finding.estimatedMonthlySavingMinCents > 0 || finding.estimatedMonthlySavingMaxCents > 0
const expenseFor = (finding: SavingsFinding) => store.expenses.find((item: RecurringExpense) => item.id === finding.expenseId)
const decisionFor = (finding: SavingsFinding) => store.dashboard?.decisions.find((decision: SavingAction) => decision.findingId === finding.id)
const closedAt = (finding: SavingsFinding) => finding.resolvedAt || finding.dismissedAt || finding.createdAt
const shortDate = (value: string) => new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value))

watch(() => route.query.open, (value: unknown) => {
  selected.value = typeof value === 'string' ? value : null
})

const close = () => {
  selected.value = null
  resolutionError.value = ''
  const query = { ...route.query }
  delete query.open
  void router.replace({ query })
}
const resolve = async (newCostCents: number, actionDate: string) => {
  if (!current.value) return
  busy.value = true
  resolutionError.value = ''
  try {
    await store.resolve(current.value.id, newCostCents, actionDate)
    close()
  } catch {
    resolutionError.value = 'Não foi possível marcar a recomendação como resolvida. Tenta novamente.'
  } finally {
    busy.value = false
  }
}
const dismiss = async () => {
  if (!current.value) return
  busy.value = true
  try {
    await store.dismiss(current.value.id)
    close()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <header class="page-header">
      <div class="page-header-copy">
        <div class="section-kicker">
          Centro de decisões
        </div>
        <h1>Recomendações</h1>
        <p class="page-subtitle">
          Cada oportunidade mostra a evidência, o grau de confiança e uma ação concreta. Tu decides quando avançar.
        </p>
      </div>
    </header>

    <div
      v-if="store.loading && !store.findings.length"
      class="loading-grid"
      aria-label="A carregar recomendações"
      aria-busy="true"
    >
      <div
        v-for="item in 3"
        :key="item"
        class="loading-card"
      />
    </div>

    <template v-else>
      <div class="findings-summary">
        <div>
          <strong>{{ openFindings.length ? `${openFindings.length} ${openFindings.length === 1 ? 'decisão pendente' : 'decisões pendentes'}` : 'Sem decisões pendentes' }}</strong>
          <p>Abre uma recomendação para consultar toda a análise antes de decidir.</p>
        </div>
        <div class="recommendation-value">
          <template v-if="potentialTotal > 0">
            até {{ money(potentialTotal) }}
            <small>poupança potencial / mês</small>
          </template>
          <template v-else-if="openFindings.length">
            Sem poupanças potenciais estimadas
            <small>avisos factuais por rever</small>
          </template>
          <template v-else>
            Sem estimativa aplicável
            <small>nenhuma decisão aberta</small>
          </template>
        </div>
      </div>

      <section
        class="section-heading"
        aria-labelledby="open-findings-heading"
      >
        <div>
          <h2 id="open-findings-heading">
            Por decidir
          </h2>
          <p>Não alteramos nada até confirmares uma ação.</p>
        </div>
      </section>

      <div
        v-if="openFindings.length"
        class="panel recommendation-list"
      >
        <button
          v-for="finding in openFindings"
          :key="finding.id"
          class="recommendation-row"
          type="button"
          :aria-label="`Abrir recomendação: ${finding.title}`"
          @click="selected = finding.id"
        >
          <div>
            <div class="badge-row">
              <span class="badge badge--warning">Prioridade {{ finding.priority }}</span>
              <span class="badge badge--neutral">{{ Math.round(finding.confidence * 100) }}% confiança</span>
              <span class="badge badge--neutral">Esforço {{ finding.effort === 'very_low' ? 'muito baixo' : finding.effort === 'low' ? 'baixo' : finding.effort === 'medium' ? 'médio' : 'alto' }}</span>
            </div>
            <div class="recommendation-title">
              {{ finding.title }}
            </div>
            <p class="recommendation-description">
              {{ finding.description }}
            </p>
            <p class="recommendation-description">
              <strong>Próxima ação:</strong> {{ finding.action }}
            </p>
          </div>
          <div class="recommendation-value">
            <template v-if="hasEstimatedSaving(finding)">
              {{ money(finding.estimatedMonthlySavingMinCents) }}–{{ money(finding.estimatedMonthlySavingMaxCents) }}
              <small>estimativa / mês · Ver análise →</small>
            </template>
            <template v-else>
              Poupança não estimada
              <small>revisão factual · Ver análise →</small>
            </template>
          </div>
        </button>
      </div>

      <div
        v-else
        class="panel empty-state"
      >
        <div>
          <span
            class="empty-state-icon"
            aria-hidden="true"
          >✓</span>
          <h2>Está tudo revisto</h2>
          <p>Não existem recomendações abertas. Continuaremos a acompanhar alterações de preço e oportunidades.</p>
          <v-btn
            color="primary"
            to="/expenses"
          >
            Ver despesas
          </v-btn>
        </div>
      </div>

      <section
        v-if="closedFindings.length"
        class="decision-archive"
        aria-labelledby="decision-archive-heading"
      >
        <div class="section-heading">
          <div>
            <div class="data-label">
              Rasto de decisões
            </div>
            <h2 id="decision-archive-heading">
              Arquivo auditável
            </h2>
            <p>Separa reduções comprovadas de casos encerrados sem alteração.</p>
          </div>
        </div>
        <ol class="decision-archive__list">
          <li
            v-for="finding in closedFindings"
            :key="finding.id"
            class="decision-archive__item"
            :class="{ 'decision-archive__item--confirmed': finding.status === 'resolved' }"
          >
            <div>
              <span>{{ finding.status === 'resolved' ? 'Redução confirmada' : 'Encerrado sem alteração' }}</span>
              <strong>{{ finding.title }}</strong>
              <small>{{ expenseFor(finding)?.productName || 'Contrato' }} · {{ expenseFor(finding)?.provider || 'Fornecedor não disponível' }} · {{ shortDate(closedAt(finding)) }}</small>
            </div>
            <div class="decision-archive__result">
              <template v-if="decisionFor(finding)">
                <strong>{{ money(decisionFor(finding)!.annualSavingCents) }}/ano</strong>
                <small>{{ money(decisionFor(finding)!.previousCostCents) }} → {{ money(decisionFor(finding)!.newCostCents) }}/mês</small>
              </template>
              <template v-else>
                <strong>Sem redução registada</strong>
                <small>não entra no objetivo</small>
              </template>
            </div>
          </li>
        </ol>
      </section>
    </template>

    <RecommendationDetailDialog
      :model-value="!!current && !!currentExpense"
      :finding="current"
      :current-expense-cost-cents="currentExpense?.monthlyCostCents ?? 0"
      :busy="busy"
      :error="resolutionError"
      @close="close"
      @dismiss="dismiss"
      @resolve="resolve"
    />
  </div>
</template>
