<script setup lang="ts">
import { buildContractRadar, getNextDeclaredContractDate } from '../../domain/contract-agenda'
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
const today = new Date()
const currentCivilDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const radarItems = computed(() => buildContractRadar(expenses.value, currentCivilDate, 45))
const contractListDate = (item: RecurringExpense) => getNextDeclaredContractDate(item, currentCivilDate)
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
          O que sai todos os meses, o que precisa de atenção e os prazos declarados que se aproximam.
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
        <span class="data-label">Radar de decisões</span><h2 id="radar-title">
          Decidir antes do prazo
        </h2>
        <p>Fidelização, renovação e fim de contrato continuam separados.</p>
      </div>
      <ol>
        <li
          v-for="entry in radarItems"
          :key="`${entry.expenseId}-${entry.kind}-${entry.date}`"
        >
          <NuxtLink :to="`/expenses/${entry.expenseId}`">
            <span><strong>{{ entry.productName }}</strong><small>{{ entry.provider }} · {{ entry.label }} · {{ civilDate(entry.date) }}</small><em>{{ entry.action }}</em></span>
            <b>{{ entry.daysUntil === 0 ? 'Hoje' : entry.daysUntil === 1 ? 'Amanhã' : `${entry.daysUntil} dias` }}</b>
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
            v-if="contractListDate(item)"
            class="contract-date"
          ><small>Próximo prazo</small>{{ contractListDate(item)!.label }} · {{ civilDate(contractListDate(item)!.date) }}</span>
          <span
            v-else
            class="contract-date"
          ><small>Próximo prazo</small>Sem prazo futuro</span>
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
