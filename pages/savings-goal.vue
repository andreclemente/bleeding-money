<script setup lang="ts">
import type { SavingsGoalProgress } from '../domain/savings-goal'

const requestFetch = useRequestFetch()
const response = await requestFetch<{ goal: SavingsGoalProgress | null }>('/api/savings-goal')
const goal = ref(response.goal)
const editing = ref(!goal.value)
const saving = ref(false)
const error = ref('')
const name = ref(goal.value?.name || '')
const targetEuros = ref(goal.value ? (goal.value.targetAnnualCents / 100).toFixed(2) : '')
const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)

const save = async () => {
  error.value = ''
  const normalized = targetEuros.value.trim().replace(',', '.')
  const euros = Number(normalized)
  if (!name.value.trim() || !/^\d+(?:[.,]\d{1,2})?$/.test(targetEuros.value.trim()) || !Number.isFinite(euros) || euros <= 0) {
    error.value = 'Indica um nome e um montante anual válido.'
    return
  }
  saving.value = true
  try {
    const response = await requestFetch<{ goal: SavingsGoalProgress }>('/api/savings-goal', { method: 'PUT', body: { name: name.value, targetAnnualCents: Math.round(euros * 100) } })
    goal.value = response.goal
    name.value = response.goal.name
    targetEuros.value = (response.goal.targetAnnualCents / 100).toFixed(2)
    editing.value = false
  } catch {
    error.value = 'Não foi possível guardar. Tenta novamente.'
  } finally { saving.value = false }
}
</script>

<template>
  <div class="goal-page">
    <header class="page-header">
      <div class="page-header-copy">
        <div class="section-kicker">
          Progresso confirmado
        </div>
        <h1>Objetivo familiar</h1>
        <p class="page-subtitle">
          Liga um objetivo concreto às reduções anuais que já concluíste. Só contam reduções que confirmaste como concluídas — recomendações e limites planeados não avançam a barra.
        </p>
      </div>
      <button
        v-if="goal && !editing"
        class="secondary-action"
        type="button"
        @click="editing = true"
      >
        Ajustar objetivo
      </button>
    </header>

    <section
      v-if="goal && !editing"
      class="panel goal-progress"
      aria-labelledby="goal-title"
    >
      <div class="goal-progress__heading">
        <div>
          <span class="data-label">Objetivo anual</span><h2 id="goal-title">
            {{ goal.name }}
          </h2>
        </div>
        <strong>{{ goal.percentage }}%</strong>
      </div>
      <div
        class="goal-track"
        role="progressbar"
        :aria-label="`Progresso de ${goal.name}`"
        :aria-valuenow="goal.percentage"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${goal.percentage}%` }" />
      </div>
      <dl class="goal-numbers">
        <div><dt>Poupança anual confirmada</dt><dd>{{ money(goal.confirmedAnnualCents) }}</dd></div>
        <div><dt>Falta confirmar</dt><dd>{{ money(goal.remainingAnnualCents) }}</dd></div>
        <div><dt>Meta anual</dt><dd>{{ money(goal.targetAnnualCents) }}</dd></div>
      </dl>
      <p class="goal-method">
        O progresso soma apenas a redução anual registada quando concluis uma recomendação com um novo custo real. Não representa dinheiro já depositado numa conta.
      </p>
    </section>

    <form
      v-else
      class="panel goal-form"
      @submit.prevent="save"
    >
      <div><span class="data-label">Um destino concreto</span><h2>{{ goal ? 'Ajustar objetivo' : 'Criar objetivo' }}</h2><p>Exemplos: reserva familiar, fundo de emergência ou margem anual. Define quanto queres reduzir por ano.</p></div>
      <label>Nome do objetivo<input
        v-model="name"
        maxlength="80"
        autocomplete="off"
        required
      ></label>
      <label>Meta de redução anual (€)<input
        v-model="targetEuros"
        inputmode="decimal"
        placeholder="1200,00"
        required
      ></label>
      <p
        v-if="error"
        class="form-error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="form-actions">
        <button
          v-if="goal"
          class="secondary-action"
          type="button"
          @click="editing = false"
        >
          Cancelar
        </button>
        <v-btn
          color="primary"
          type="submit"
          :loading="saving"
        >
          Guardar objetivo
        </v-btn>
      </div>
    </form>
  </div>
</template>
