<script setup lang="ts">
import type { RecurringExpense, SavingsFinding } from '../domain/types'

const store = useSavingsStore()
await callOnce(() => store.refresh())
const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100)
const priorityFindings = computed<SavingsFinding[]>(() => store.dashboard?.priorityFindings || [])
const expenses = computed<RecurringExpense[]>(() => store.dashboard?.expenses || [])
</script>
<template>
  <div v-if="store.dashboard">
    <section class="hero mb-8">
      <div class="eyebrow mb-3">
        Auditoria contínua das tuas despesas fixas
      </div><h1 class="text-h4 mb-6">
        Onde estás a perder dinheiro sem te aperceber?
      </h1>
      <v-row>
        <v-col
          cols="12"
          md="4"
        >
          <div class="metric">
            {{ money(store.dashboard.monthlyExpensesCents) }}
          </div><div class="eyebrow mt-2">
            Despesas recorrentes / mês
          </div>
        </v-col><v-col
          cols="12"
          md="4"
        >
          <div class="metric">
            {{ money(store.dashboard.potentialMonthlyMinCents) }}–{{ money(store.dashboard.potentialMonthlyMaxCents) }}
          </div><div class="eyebrow mt-2">
            Poupança potencial / mês
          </div>
        </v-col><v-col
          cols="12"
          md="4"
        >
          <div class="metric">
            {{ money(store.dashboard.realizedAnnualCents) }}
          </div><div class="eyebrow mt-2">
            Poupança conseguida / ano
          </div>
        </v-col>
      </v-row>
    </section>
    <div class="d-flex align-center mb-4">
      <h2>Ações recomendadas</h2><v-spacer /><v-btn
        color="primary"
        to="/expenses/new"
      >
        Adicionar despesa
      </v-btn>
    </div>
    <v-card
      v-for="finding in priorityFindings"
      :key="finding.id"
      class="finding-card mb-3"
      :to="`/findings?open=${finding.id}`"
    >
      <v-card-item><v-card-title>{{ finding.title }}</v-card-title><v-card-subtitle>{{ money(finding.estimatedAnnualSavingMinCents) }}–{{ money(finding.estimatedAnnualSavingMaxCents) }}/ano · confiança {{ Math.round(finding.confidence * 100) }}%</v-card-subtitle></v-card-item>
    </v-card>
    <h2 class="mt-8 mb-4">
      Despesas acompanhadas
    </h2><v-table>
      <tbody>
        <tr
          v-for="expense in expenses"
          :key="expense.id"
        >
          <td>
            <NuxtLink :to="`/expenses/${expense.id}`">
              {{ expense.productName }}
            </NuxtLink><div class="text-medium-emphasis">
              {{ expense.provider }}
            </div>
          </td><td class="text-right font-weight-bold">
            {{ money(expense.monthlyCostCents) }}/mês
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
