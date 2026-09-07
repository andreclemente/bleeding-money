<script setup lang="ts">
import type { ExpenseCategory, RecurringExpense, SavingsFinding } from '../domain/types'

const store = useSavingsStore()
await callOnce(() => store.refresh())

const money = (cents: number, decimals = 0) => new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: decimals
}).format(cents / 100)
const categories: Record<ExpenseCategory, string> = {
  electricity: 'Eletricidade',
  telecom: 'Telecomunicações',
  bank: 'Banca',
  subscription: 'Subscrição',
  gym: 'Ginásio',
  insurance: 'Seguro'
}
const priorityFindings = computed<SavingsFinding[]>(() => store.dashboard?.priorityFindings || [])
const expenses = computed<RecurringExpense[]>(() => store.dashboard?.expenses || [])
const openFindingCount = (expenseId: string) => store.findings.filter((item: SavingsFinding) => item.expenseId === expenseId && item.status === 'open').length
const categoryLabel = (category: ExpenseCategory) => categories[category]
</script>

<template>
  <div>
    <header class="page-header">
      <div class="page-header-copy">
        <div class="section-kicker">
          Visão geral
        </div>
        <h1>O custo real das tuas despesas fixas.</h1>
        <p class="page-subtitle">
          Vê o que pagas, onde podes agir e quanto já conseguiste recuperar — sem misturar estimativas com resultados.
        </p>
      </div>
      <v-btn
        color="primary"
        size="large"
        to="/expenses/new"
      >
        + Adicionar despesa
      </v-btn>
    </header>

    <div
      v-if="store.loading && !store.dashboard"
      class="loading-grid"
      aria-label="A carregar resumo"
      aria-busy="true"
    >
      <div
        v-for="item in 3"
        :key="item"
        class="loading-card"
      />
    </div>

    <template v-else-if="store.dashboard">
      <section
        class="metric-grid"
        aria-label="Indicadores financeiros"
      >
        <article class="metric-card metric-card--spend">
          <span
            class="metric-icon"
            aria-hidden="true"
          >€</span>
          <strong class="metric-value">{{ money(store.dashboard.monthlyExpensesCents) }}</strong>
          <span class="metric-label">Despesa recorrente mensal</span>
          <p class="metric-context">
            O total confirmado que sai todos os meses.
          </p>
        </article>
        <article class="metric-card metric-card--potential">
          <span
            class="metric-icon"
            aria-hidden="true"
          >↘</span>
          <strong class="metric-value">{{ money(store.dashboard.potentialMonthlyMinCents) }}–{{ money(store.dashboard.potentialMonthlyMaxCents) }}</strong>
          <span class="metric-label">Poupança mensal potencial</span>
          <p class="metric-context">
            Uma estimativa baseada nas recomendações abertas.
          </p>
        </article>
        <article class="metric-card metric-card--realized">
          <span
            class="metric-icon"
            aria-hidden="true"
          >✓</span>
          <strong class="metric-value">{{ money(store.dashboard.realizedAnnualCents) }}</strong>
          <span class="metric-label">Poupança anual realizada</span>
          <p class="metric-context">
            Valor já confirmado em ações concluídas.
          </p>
        </article>
      </section>

      <section aria-labelledby="recommended-heading">
        <div class="section-heading">
          <div>
            <h2 id="recommended-heading">
              Prioridades para rever
            </h2>
            <p>Ordenadas pelo impacto, urgência e confiança da análise.</p>
          </div>
          <v-btn
            to="/findings"
            variant="text"
            color="primary"
          >
            Ver todas →
          </v-btn>
        </div>

        <div
          v-if="priorityFindings.length"
          class="panel recommendation-list"
        >
          <NuxtLink
            v-for="finding in priorityFindings"
            :key="finding.id"
            class="recommendation-row"
            :to="`/findings?open=${finding.id}`"
          >
            <div>
              <div class="badge-row">
                <span class="badge badge--warning">Prioridade {{ finding.priority }}</span>
                <span class="badge badge--neutral">{{ Math.round(finding.confidence * 100) }}% confiança</span>
              </div>
              <div class="recommendation-title">
                {{ finding.title }}
              </div>
              <p class="recommendation-description">
                {{ finding.evidence[0] || finding.description }}
              </p>
            </div>
            <div class="recommendation-value">
              {{ money(finding.estimatedMonthlySavingMinCents) }}–{{ money(finding.estimatedMonthlySavingMaxCents) }}
              <small>potencial / mês · Rever →</small>
            </div>
          </NuxtLink>
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
            <h2>Nada urgente para rever</h2>
            <p>Quando a auditoria encontrar uma oportunidade clara, ela aparece aqui com a respetiva evidência.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="expenses-heading">
        <div class="section-heading">
          <div>
            <h2 id="expenses-heading">
              Despesas acompanhadas
            </h2>
            <p>{{ expenses.length }} contratos sob análise contínua.</p>
          </div>
          <v-btn
            to="/expenses"
            variant="text"
            color="primary"
          >
            Gerir despesas →
          </v-btn>
        </div>

        <div
          v-if="expenses.length"
          class="panel"
        >
          <table class="expense-table">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Categoria</th>
                <th>Estado</th>
                <th class="money-cell">
                  Custo mensal
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="expense in expenses"
                :key="expense.id"
              >
                <td>
                  <NuxtLink
                    class="expense-link"
                    :to="`/expenses/${expense.id}`"
                  >
                    {{ expense.productName }}
                  </NuxtLink>
                  <div class="expense-provider">
                    {{ expense.provider }}
                  </div>
                </td>
                <td class="category-cell">
                  {{ categoryLabel(expense.category) }}
                </td>
                <td>
                  <span
                    v-if="openFindingCount(expense.id)"
                    class="badge badge--warning"
                  >{{ openFindingCount(expense.id) }} {{ openFindingCount(expense.id) === 1 ? 'alerta' : 'alertas' }}</span>
                  <span
                    v-else
                    class="badge badge--success"
                  >Saudável</span>
                </td>
                <td class="money-cell">
                  {{ money(expense.monthlyCostCents, 2) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-else
          class="panel empty-state"
        >
          <div>
            <span
              class="empty-state-icon"
              aria-hidden="true"
            >＋</span>
            <h2>Começa pela primeira despesa</h2>
            <p>Adiciona um serviço recorrente para iniciar a auditoria.</p>
            <v-btn
              color="primary"
              to="/expenses/new"
            >
              Adicionar despesa
            </v-btn>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
