<script setup lang="ts">
import type { ExpenseSnapshot, RecurringExpense, SavingsFinding } from '../../domain/types'
const route = useRoute()
const { data } = await useFetch<{ expense: RecurringExpense, snapshots: ExpenseSnapshot[], findings: SavingsFinding[] }>(`/api/expenses/${route.params.id}`)
const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
</script>
<template>
  <div v-if="data">
    <v-btn
      variant="text"
      to="/expenses"
      class="mb-4"
    >
      ← Todas as despesas
    </v-btn><h1>{{ data.expense.productName }}</h1><p class="text-h6 text-medium-emphasis mb-6">
      {{ data.expense.provider }} · {{ money(data.expense.monthlyCostCents) }}/mês
    </p><v-row>
      <v-col
        cols="12"
        md="7"
      >
        <v-card>
          <v-card-title>Histórico</v-card-title><v-table>
            <thead>
              <tr>
                <th>Data</th><th>Plano</th><th class="text-right">
                  Preço
                </th>
              </tr>
            </thead><tbody>
              <tr
                v-for="row in data.snapshots"
                :key="row.id"
              >
                <td>{{ row.observedAt }}</td><td>{{ row.plan || '—' }}</td><td class="text-right">
                  {{ money(row.priceCents) }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col><v-col
        cols="12"
        md="5"
      >
        <v-card>
          <v-card-title>Diagnóstico</v-card-title><v-card-text>
            <div class="metric text-primary">
              {{ data.findings.filter(f => f.status === 'open').length ? 'Atenção' : 'Saudável' }}
            </div><p class="mt-3">
              {{ data.findings.filter(f => f.status === 'open').length }} recomendações abertas
            </p><v-btn
              to="/findings"
              color="primary"
              variant="tonal"
            >
              Ver recomendações
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
