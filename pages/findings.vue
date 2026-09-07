<script setup lang="ts">
import type { RecurringExpense, SavingsFinding } from '../domain/types'

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
const potentialTotal = computed(() => openFindings.value.reduce((total: number, item: SavingsFinding) => total + item.estimatedMonthlySavingMaxCents, 0))

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
const resolve = async (newCostCents: number) => {
  if (!current.value) return
  busy.value = true
  resolutionError.value = ''
  try {
    await store.resolve(current.value.id, newCostCents)
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
          <strong>{{ openFindings.length }} {{ openFindings.length === 1 ? 'decisão pendente' : 'decisões pendentes' }}</strong>
          <p>Abre uma recomendação para consultar toda a análise antes de decidir.</p>
        </div>
        <div class="recommendation-value">
          até {{ money(potentialTotal) }}
          <small>poupança potencial / mês</small>
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
            {{ money(finding.estimatedMonthlySavingMinCents) }}–{{ money(finding.estimatedMonthlySavingMaxCents) }}
            <small>estimativa / mês · Ver análise →</small>
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
