<script setup lang="ts">
import type { RecurringExpense } from '../../domain/types'

const store = useSavingsStore()
await callOnce(() => store.refresh())
const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const expenses = computed<RecurringExpense[]>(() => store.expenses)
</script>
<template>
  <div>
    <div class="d-flex align-center mb-6">
      <div>
        <h1>Despesas recorrentes</h1><p class="text-medium-emphasis">
          Cada serviço é acompanhado como um contrato.
        </p>
      </div><v-spacer /><v-btn
        color="primary"
        to="/expenses/new"
      >
        Adicionar despesa
      </v-btn>
    </div><v-row>
      <v-col
        v-for="item in expenses"
        :key="item.id"
        cols="12"
        md="6"
      >
        <v-card :to="`/expenses/${item.id}`">
          <v-card-item><v-card-title>{{ item.productName }}</v-card-title><v-card-subtitle>{{ item.provider }} · {{ item.category }}</v-card-subtitle></v-card-item><v-card-text class="text-h5">
            {{ money(item.monthlyCostCents) }}/mês
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
