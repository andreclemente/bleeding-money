<script setup lang="ts">
import type { ExpenseCategory, ExpenseSnapshot, RecurringExpense, SavingsFinding } from '../../domain/types'

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
        </div>
      </header>

      <div class="detail-grid">
        <section
          class="panel"
          aria-labelledby="history-heading"
        >
          <div class="panel-header">
            <h2 id="history-heading">
              Histórico de preço
            </h2>
          </div>
          <div v-if="data.snapshots.length">
            <table class="expense-table">
              <thead>
                <tr>
                  <th>Data observada</th>
                  <th>Plano</th>
                  <th class="money-cell">
                    Preço
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in data.snapshots"
                  :key="row.id"
                >
                  <td>{{ date(row.observedAt) }}</td>
                  <td>{{ row.plan || 'Sem plano indicado' }}</td>
                  <td class="money-cell">
                    {{ money(row.priceCents) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-else
            class="empty-state"
          >
            <div>
              <span
                class="empty-state-icon"
                aria-hidden="true"
              >⌁</span>
              <h2>Ainda sem histórico</h2>
              <p>As alterações de preço aparecerão aqui quando forem detetadas.</p>
            </div>
          </div>
        </section>

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
    </template>
  </div>
</template>
