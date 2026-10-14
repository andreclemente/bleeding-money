<script setup lang="ts">
import { buildExpenseLifecycle } from '../../domain/expense-lifecycle'
import type { ExpenseCategory, ExpenseSnapshot, InsuranceCoverageCode, RecurringExpense, SavingsFinding } from '../../domain/types'

const route = useRoute()
const { data, pending, error } = await useFetch<{
  expense: RecurringExpense
  snapshots: ExpenseSnapshot[]
  findings: SavingsFinding[]
}>(`/api/expenses/${route.params.id}`)

const money = (cents: number) => new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR'
}).format(cents / 100)
const date = (value: string) => new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
}).format(new Date(value))
const categories: Record<ExpenseCategory, string> = {
  electricity: 'Eletricidade',
  telecom: 'Telecomunicações',
  bank: 'Banca',
  subscription: 'Subscrição',
  gym: 'Ginásio',
  insurance: 'Seguro'
}
const openFindings = computed(() => data.value?.findings.filter(item => item.status === 'open') || [])
type InsuranceDetails = Extract<RecurringExpense['details'], { kind: 'insurance' }>
const insuranceDetails = computed<InsuranceDetails | null>(() => data.value?.expense.details.kind === 'insurance' ? data.value.expense.details : null)
const policyTypes = { car: 'Automóvel', home: 'Casa', health: 'Saúde', life: 'Vida', other: 'Outro' } as const
const coverageLabels: Record<InsuranceCoverageCode, string> = { civil_liability: 'Responsabilidade civil', own_damage: 'Danos próprios', building: 'Edifício', contents: 'Conteúdo/recheio', hospitalization: 'Hospitalização', outpatient: 'Ambulatório', death: 'Morte', disability: 'Invalidez', travel_assistance: 'Assistência em viagem' }
const policyLabel = (details: InsuranceDetails) => policyTypes[details.policyType]
const coverageText = (details: InsuranceDetails) => details.coverageCodes.length ? details.coverageCodes.map(code => coverageLabels[code]).join(', ') : 'Não declaradas'
const lifecycle = computed(() => data.value ? buildExpenseLifecycle(data.value.expense, data.value.snapshots) : null)
const percentage = (basisPoints: number) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(basisPoints) / 100)
const changeLabel = (change: { cents: number, basisPoints: number } | null) => {
  if (!change) return 'Primeiro valor registado'
  if (change.cents === 0) return 'Sem alteração face ao registo anterior'
  return `${change.cents > 0 ? 'Aumento' : 'Redução'} de ${money(Math.abs(change.cents))} (${percentage(change.basisPoints)}%)`
}
</script>

<template>
  <div>
    <NuxtLink
      class="back-link"
      to="/expenses"
    >
      ← Todas as despesas
    </NuxtLink>

    <div
      v-if="pending"
      class="loading-grid"
      aria-label="A carregar detalhe da despesa"
      aria-busy="true"
    >
      <div
        v-for="item in 2"
        :key="item"
        class="loading-card"
      />
    </div>

    <div
      v-else-if="error"
      class="panel empty-state"
      role="alert"
    >
      <div>
        <span
          class="empty-state-icon"
          aria-hidden="true"
        >!</span>
        <h1>Não foi possível abrir esta despesa</h1>
        <p>O registo pode já não existir ou ocorreu um problema temporário.</p>
        <v-btn to="/expenses">
          Voltar às despesas
        </v-btn>
      </div>
    </div>

    <template v-else-if="data">
      <header class="panel detail-hero">
        <div>
          <div class="section-kicker">
            {{ categories[data.expense.category] }}
          </div>
          <h1>{{ data.expense.productName }}</h1>
          <p class="page-subtitle">
            {{ data.expense.provider }} · acompanhado desde {{ date(data.expense.createdAt) }}
          </p>
        </div>
        <div class="detail-price">
          <strong>{{ money(data.expense.monthlyCostCents) }}</strong>
          <span>Custo recorrente / mês</span>
          <div class="detail-annual">
            <b>{{ money(lifecycle!.annualEquivalentCents) }}</b>
            <span>Equivalente anual · não é uma cobrança adicional</span>
          </div>
        </div>
      </header>

      <section
        v-if="insuranceDetails"
        class="panel insurance-contract"
        aria-labelledby="insurance-heading"
      >
        <div class="panel-header">
          <div>
            <div class="section-kicker">
              Seguro auditável
            </div>
            <h2 id="insurance-heading">
              Ficha do contrato
            </h2>
          </div>
        </div>
        <dl class="wizard-summary">
          <div><dt>Tipo</dt><dd>{{ policyLabel(insuranceDetails) }}</dd></div>
          <div><dt>Próxima renovação</dt><dd>{{ insuranceDetails.renewalDate ? date(insuranceDetails.renewalDate) : 'Não declarada' }}</dd></div>
          <div><dt>Coberturas declaradas</dt><dd>{{ coverageText(insuranceDetails) }}</dd></div>
        </dl>
        <p class="page-subtitle">
          Compara sempre capitais, pessoas ou bens cobertos, exclusões e franquias. Uma cobertura com o mesmo nome noutro contrato é apenas um sinal para rever, não uma poupança calculada.
        </p>
      </section>

      <div class="detail-grid">
        <section
          class="panel lifecycle-panel"
          aria-labelledby="lifecycle-heading"
        >
          <div class="panel-header">
            <div>
              <div class="section-kicker">
                Evidência registada
              </div>
              <h2 id="lifecycle-heading">
                Linha de vida da despesa
              </h2>
            </div>
            <span class="evidence-rule">Variação confirmada apenas entre valores observados</span>
          </div>
          <ol
            v-if="lifecycle!.observations.length"
            class="expense-lifecycle"
          >
            <li
              v-for="observation in lifecycle!.observations"
              :key="observation.snapshot.id"
            >
              <span
                class="lifecycle-marker"
                aria-hidden="true"
              />
              <div class="lifecycle-entry">
                <div>
                  <time :datetime="observation.snapshot.observedAt">{{ date(observation.snapshot.observedAt) }}</time>
                  <strong>{{ money(observation.snapshot.priceCents) }}</strong>
                </div>
                <p>{{ observation.snapshot.plan || 'Sem plano indicado' }} · valor observado</p>
                <span
                  class="change-note"
                  :class="{ 'change-note--increase': observation.change && observation.change.cents > 0, 'change-note--reduction': observation.change && observation.change.cents < 0 }"
                >{{ changeLabel(observation.change) }}</span>
              </div>
            </li>
          </ol>
          <div
            v-else
            class="lifecycle-empty"
          >
            <strong>Ainda sem valores anteriores</strong>
            <p>O custo atual está registado, mas ainda não existe outro valor observado para confirmar uma variação.</p>
          </div>
        </section>

        <div class="detail-sidebar">
          <aside
            class="panel decision-dates"
            aria-labelledby="decision-dates-heading"
          >
            <div class="section-kicker">
              Agenda contratual
            </div>
            <h2 id="decision-dates-heading">
              Datas para decidir
            </h2>
            <p>Renovação, fidelização e fim de contrato são eventos diferentes.</p>
            <dl v-if="lifecycle!.decisionDates.length">
              <div
                v-for="event in lifecycle!.decisionDates"
                :key="`${event.kind}-${event.date}`"
              >
                <dt>{{ event.label }}</dt>
                <dd>{{ date(event.date) }}</dd>
              </div>
            </dl>
            <div
              v-else
              class="missing-decision-date"
            >
              Sem prazo declarado. Não assumimos uma data.
            </div>
          </aside>

          <aside
            class="panel diagnosis"
            aria-labelledby="diagnosis-heading"
          >
            <div class="section-kicker">
              Diagnóstico
            </div>
            <div
              id="diagnosis-heading"
              class="health-indicator"
              :class="{ 'health-indicator--attention': openFindings.length }"
            >
              <span
                class="status-dot"
                aria-hidden="true"
              />
              {{ openFindings.length ? 'Atenção necessária' : 'Despesa saudável' }}
            </div>
            <p v-if="openFindings.length">
              Encontrámos {{ openFindings.length }} {{ openFindings.length === 1 ? 'oportunidade que merece' : 'oportunidades que merecem' }} a tua decisão.
            </p>
            <p v-else>
              Não existem recomendações abertas para esta despesa neste momento.
            </p>
            <v-btn
              v-if="openFindings.length"
              :to="`/findings?open=${openFindings[0].id}`"
              color="primary"
              block
            >
              Rever {{ openFindings.length === 1 ? 'recomendação' : 'recomendações' }}
            </v-btn>
            <v-btn
              v-else
              to="/findings"
              variant="outlined"
              block
            >
              Ver recomendações
            </v-btn>
          </aside>
        </div>
      </div>
    </template>
  </div>
</template>
