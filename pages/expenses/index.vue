<script setup lang="ts">
import type { ExpenseCategory, RecurringExpense, SavingsFinding } from '../../domain/types'

const store = useSavingsStore()
await callOnce(() => store.refresh())

const money = (cents: number) => new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR'
}).format(cents / 100)
const expenses = computed<RecurringExpense[]>(() => store.expenses)
const categoryMeta: Record<ExpenseCategory, { label: string, icon: string }> = {
  electricity: { label: 'Eletricidade', icon: 'ϟ' },
  telecom: { label: 'Telecomunicações', icon: '⌁' },
  bank: { label: 'Banca', icon: '€' },
  subscription: { label: 'Subscrição', icon: '◇' },
  gym: { label: 'Ginásio', icon: '＋' },
  insurance: { label: 'Seguro', icon: '⌂' }
}
const openFindingCount = (expenseId: string) => store.findings.filter((item: SavingsFinding) => item.expenseId === expenseId && item.status === 'open').length
const categoryLabel = (category: ExpenseCategory) => categoryMeta[category].label
const categoryIcon = (category: ExpenseCategory) => categoryMeta[category].icon
</script>

<template>
  <div>
    <header class="page-header">
      <div class="page-header-copy">
        <div class="section-kicker">
          Inventário recorrente
        </div>
        <h1>Despesas</h1>
        <p class="page-subtitle">
          Uma visão simples de todos os serviços, contratos e subscrições que pesam no teu mês.
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
      v-if="store.loading && !expenses.length"
      class="loading-grid"
      aria-label="A carregar despesas"
      aria-busy="true"
    >
      <div
        v-for="item in 3"
        :key="item"
        class="loading-card"
      />
    </div>

    <div
      v-else-if="expenses.length"
      class="expense-grid"
    >
      <NuxtLink
        v-for="item in expenses"
        :key="item.id"
        class="panel expense-card"
        :to="`/expenses/${item.id}`"
      >
        <div class="expense-card-top">
          <span
            class="category-icon"
            aria-hidden="true"
          >{{ categoryIcon(item.category) }}</span>
          <span
            v-if="openFindingCount(item.id)"
            class="badge badge--warning"
          >{{ openFindingCount(item.id) }} {{ openFindingCount(item.id) === 1 ? 'ponto a rever' : 'pontos a rever' }}</span>
          <span
            v-else
            class="badge badge--success"
          >Sem alertas</span>
        </div>
        <h2>{{ item.productName }}</h2>
        <p>{{ item.provider }} · {{ categoryLabel(item.category) }}</p>
        <div class="expense-card-footer">
          <div class="expense-amount">
            {{ money(item.monthlyCostCents) }} <small>/ mês</small>
          </div>
          <span aria-hidden="true">→</span>
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
        >＋</span>
        <h2>Ainda não acompanhas nenhuma despesa</h2>
        <p>Adiciona o primeiro contrato ou subscrição. A análise começa assim que guardares.</p>
        <v-btn
          color="primary"
          to="/expenses/new"
        >
          Adicionar primeira despesa
        </v-btn>
      </div>
    </div>
  </div>
</template>
