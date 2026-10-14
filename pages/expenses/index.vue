<script setup lang="ts">
import type { ExpenseCategory, RecurringExpense, SavingsFinding } from '../../domain/types'

const store = useSavingsStore()
await callOnce(() => store.refresh())

const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const civilDate = (value: string) => new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
const expenses = computed<RecurringExpense[]>(() => store.expenses)
const categoryMeta: Record<ExpenseCategory, { label: string, code: string }> = {
  electricity: { label: 'Eletricidade', code: 'ELE' },
  telecom: { label: 'Telecomunicações', code: 'TEL' },
  bank: { label: 'Banca', code: 'BAN' },
  subscription: { label: 'Subscrição', code: 'SUB' },
  gym: { label: 'Ginásio', code: 'GIN' },
  insurance: { label: 'Seguro', code: 'SEG' }
}
const openFindings = computed<SavingsFinding[]>(() => store.findings.filter((item: SavingsFinding) => item.status === 'open'))
const openFindingCount = (expenseId: string) => openFindings.value.filter((item: SavingsFinding) => item.expenseId === expenseId).length
const categoryLabel = (category: ExpenseCategory) => categoryMeta[category].label
const categoryCode = (category: ExpenseCategory) => categoryMeta[category].code
const monthlyTotal = computed(() => expenses.value.reduce((sum: number, item: RecurringExpense) => sum + item.monthlyCostCents, 0))
const renewalDate = (item: RecurringExpense) => item.details.kind === 'insurance' ? item.details.renewalDate : undefined
const renewalLabel = (item: RecurringExpense) => {
  const value = renewalDate(item)
  return value ? civilDate(value) : 'Sem prazo'
}
const daysUntil = (value: string) => {
  const today = new Date()
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.ceil((Date.parse(`${value}T00:00:00Z`) - current) / 86_400_000)
}
const radarItems = computed<Array<{ item: RecurringExpense, date: string, days: number }>>(() => expenses.value
  .filter((item: RecurringExpense) => renewalDate(item))
  .map((item: RecurringExpense) => ({ item, date: renewalDate(item)!, days: daysUntil(renewalDate(item)!) }))
  .filter((entry: { days: number }) => entry.days >= 0 && entry.days <= 45)
  .sort((left: { days: number }, right: { days: number }) => left.days - right.days))
</script>

<template>
  <div class="contracts-page">
    <header class="page-header contracts-header">
      <div class="page-header-copy">
        <div class="section-kicker">
          Compromissos familiares
        </div>
        <h1>Contratos</h1>
        <p class="page-subtitle">
          O que sai todos os meses, o que precisa de atenção e o que se aproxima da renovação.
        </p>
      </div>
      <NuxtLink
        class="header-action"
        to="/expenses/new"
      >
        Adicionar contrato <span aria-hidden="true">+</span>
      </NuxtLink>
    </header>

    <section
      class="contract-pulse"
      aria-label="Resumo dos contratos"
    >
      <div><span>Compromisso mensal</span><strong>{{ money(monthlyTotal) }}</strong></div>
      <div><span>Contratos ativos</span><strong>{{ expenses.length }}</strong></div>
      <div><span>Casos para rever</span><strong>{{ openFindings.length }}</strong></div>
      <div :class="{ 'pulse-alert': radarItems.length }">
        <span>Radar 45 dias</span><strong>{{ radarItems.length }}</strong>
      </div>
    </section>

    <section
      v-if="radarItems.length"
      class="renewal-radar"
      aria-labelledby="radar-title"
    >
      <div>
        <span class="data-label">Radar de renovação</span><h2 id="radar-title">
          Decidir antes do prazo
        </h2>
      </div>
      <ol>
        <li
          v-for="entry in radarItems"
          :key="entry.item.id"
        >
          <NuxtLink :to="`/expenses/${entry.item.id}`">
            <span><strong>{{ entry.item.productName }}</strong><small>{{ entry.item.provider }} · renova {{ civilDate(entry.date) }}</small></span>
            <b>{{ entry.days === 0 ? 'Hoje' : `${entry.days} dias` }}</b>
          </NuxtLink>
        </li>
      </ol>
    </section>

    <div
      v-if="store.loading && !expenses.length"
      class="loading-grid"
      aria-label="A carregar contratos"
      aria-busy="true"
    >
      <div
        v-for="item in 3"
        :key="item"
        class="loading-card"
      />
    </div>

    <section
      v-else-if="expenses.length"
      aria-labelledby="inventory-title"
    >
      <div class="section-heading compact-heading">
        <div>
          <div class="data-label">
            Inventário auditável
          </div><h2 id="inventory-title">
            Todos os compromissos
          </h2>
        </div><small>Seleciona um contrato para ver histórico e critérios.</small>
      </div>
      <div
        class="contract-table"
        role="list"
      >
        <NuxtLink
          v-for="item in expenses"
          :key="item.id"
          :to="`/expenses/${item.id}`"
          class="contract-row"
          role="listitem"
        >
          <span class="contract-code">{{ categoryCode(item.category) }}</span>
          <span class="contract-identity"><strong>{{ item.productName }}</strong><small>{{ item.provider }} · {{ categoryLabel(item.category) }}</small></span>
          <span
            v-if="renewalDate(item)"
            class="contract-date"
          ><small>Renovação</small>{{ renewalLabel(item) }}</span>
          <span
            v-else
            class="contract-date"
          ><small>Revisão</small>Sem prazo</span>
          <span
            class="contract-status"
            :class="openFindingCount(item.id) ? 'contract-status--attention' : 'contract-status--clear'"
          >{{ openFindingCount(item.id) ? `${openFindingCount(item.id)} a rever` : 'Revisto' }}</span>
          <span class="contract-cost"><strong>{{ money(item.monthlyCostCents) }}</strong><small>/ mês</small></span>
          <span
            class="contract-arrow"
            aria-hidden="true"
          >→</span>
        </NuxtLink>
      </div>
    </section>

    <div
      v-else
      class="empty-state contract-empty"
    >
      <div>
        <span class="data-label">Inventário vazio</span><h2>Começa pelo contrato mais fácil de confirmar</h2><p>Pode ser eletricidade, telecomunicações, banco, seguro, ginásio ou uma subscrição.</p><NuxtLink
          class="header-action"
          to="/expenses/new"
        >
          Adicionar primeiro contrato →
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
