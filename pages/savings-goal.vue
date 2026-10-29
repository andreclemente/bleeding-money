<script setup lang="ts">
import type { FamilyRoute } from '../domain/family-route'
import type { SavingsGoalProgress } from '../domain/savings-goal'

const requestFetch = useRequestFetch()
const [goalResponse, route] = await Promise.all([
  requestFetch<{ goal: SavingsGoalProgress | null }>('/api/savings-goal'),
  requestFetch<FamilyRoute>('/api/dashboard')
])
const goal = ref(goalResponse.goal)
const editing = ref(!goal.value)
const saving = ref(false)
const error = ref('')
const name = ref(goal.value?.name || '')
const targetEuros = ref(goal.value ? (goal.value.targetAnnualCents / 100).toFixed(2) : '')
const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const civilDate = (value: string) => new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00Z`))
const percentage = (value: number, target: number) => target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0
const scenario = computed(() => {
  if (!goal.value || !route.identifiedMonthlyRangeCents.maxCents) return null
  const minAnnual = route.identifiedMonthlyRangeCents.minCents * 12
  const maxAnnual = route.identifiedMonthlyRangeCents.maxCents * 12
  return {
    minAnnual,
    maxAnnual,
    minPercentage: percentage(goal.value.confirmedAnnualCents + minAnnual, goal.value.targetAnnualCents),
    maxPercentage: percentage(goal.value.confirmedAnnualCents + maxAnnual, goal.value.targetAnnualCents)
  }
})

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
    <header class="page-header goal-header">
      <div class="page-header-copy">
        <div class="section-kicker">
          Destino das decisões
        </div>
        <h1>Objetivo</h1>
        <p class="page-subtitle">
          Só contam reduções que confirmaste como concluídas.
        </p>
      </div>
      <button
        v-if="goal && !editing"
        class="header-action header-action--light"
        type="button"
        @click="editing = true"
      >
        Ajustar objetivo
      </button>
    </header>

    <template v-if="goal && !editing">
      <section
        class="goal-command"
        aria-labelledby="goal-title"
      >
        <div class="goal-command__main">
          <span class="data-label">Poupança anual confirmada</span>
          <h2 id="goal-title">
            {{ goal.name }}
          </h2>
          <strong>{{ goal.percentage }}%</strong>
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
          <p>{{ money(goal.confirmedAnnualCents) }} de {{ money(goal.targetAnnualCents) }} em reduções anuais confirmadas.</p>
        </div>
        <div class="goal-command__remaining">
          <span>Falta confirmar</span>
          <strong>{{ money(goal.remainingAnnualCents) }}</strong>
          <small>por confirmar até à meta</small>
        </div>
      </section>

      <section
        class="goal-bridge"
        aria-labelledby="bridge-title"
      >
        <div>
          <span class="data-label">Ponte entre decisões e objetivo</span>
          <h2 id="bridge-title">
            O que pode mudar a seguir
          </h2>
        </div>
        <template v-if="scenario">
          <div class="goal-scenario-value">
            <strong>{{ scenario.minPercentage }}–{{ scenario.maxPercentage }}%</strong><span>se os casos abertos forem confirmados dentro do intervalo</span>
          </div>
          <p><strong>{{ money(scenario.minAnnual) }}–{{ money(scenario.maxAnnual) }}/ano</strong> continuam a ser uma estimativa. Não alteram a barra acima até existir um novo custo real.</p>
        </template>
        <div
          v-else
          class="decision-empty"
        >
          <strong>Sem cenário por confirmar</strong><p>A próxima melhoria aparecerá aqui quando existir um caso com intervalo estimado.</p>
        </div>
      </section>

      <section
        class="goal-evidence"
        aria-labelledby="goal-evidence-title"
      >
        <div class="section-heading compact-heading">
          <div>
            <span class="data-label">Extrato auditável</span>
            <h2 id="goal-evidence-title">
              Provas que contam para o objetivo
            </h2>
          </div>
          <small>Cada linha nasce de uma cobrança real confirmada.</small>
        </div>
        <ol
          v-if="route.decisions.length"
          class="goal-evidence-list"
        >
          <li
            v-for="decision in route.decisions.slice(0, 5)"
            :key="decision.id"
          >
            <NuxtLink
              v-if="decision.expenseId"
              class="goal-evidence-entry"
              :to="`/expenses/${decision.expenseId}`"
            >
              <span class="goal-evidence-date"><small>Contrato confirmado</small><strong>{{ decision.provider }} · {{ decision.productName }}</strong><em>Cobrança confirmada · {{ civilDate(decision.actionDate) }}</em></span>
              <span class="goal-evidence-change"><small>Custo mensal observado</small><strong>{{ money(decision.previousCostCents) }} → {{ money(decision.newCostCents) }}</strong></span>
              <span class="goal-evidence-saving"><small>Redução anual real</small><strong>{{ money(decision.annualSavingCents) }}</strong><em>Abrir Linha de Vida →</em></span>
            </NuxtLink>
            <div
              v-else
              class="goal-evidence-entry goal-evidence-entry--orphan"
            >
              <span class="goal-evidence-date"><small>Cobrança confirmada</small><strong>Contrato já indisponível</strong><em>{{ civilDate(decision.actionDate) }}</em></span>
              <span class="goal-evidence-change"><small>Custo mensal observado</small><strong>{{ money(decision.previousCostCents) }} → {{ money(decision.newCostCents) }}</strong></span>
              <span class="goal-evidence-saving"><small>Redução anual real</small><strong>{{ money(decision.annualSavingCents) }}</strong><em>Prova histórica preservada</em></span>
            </div>
          </li>
        </ol>
        <div
          v-else
          class="decision-empty goal-evidence-empty"
        >
          <strong>Ainda não existe prova para este objetivo</strong><p>Uma estimativa ou proposta só aparece aqui depois de confirmares uma cobrança inferior numa fatura, recibo ou extrato.</p>
        </div>
      </section>

      <section
        class="goal-proof"
        aria-label="Como é calculado o progresso"
      >
        <div><span>01</span><strong>Identificar</strong><small>Um caso pode ter um intervalo, nunca um resultado presumido.</small></div>
        <div><span>02</span><strong>Confirmar</strong><small>Registas o novo custo depois de agir.</small></div>
        <div><span>03</span><strong>Direcionar</strong><small>A redução anual passa a contar para esta meta.</small></div>
      </section>
    </template>

    <form
      v-else
      class="goal-form goal-form--focused"
      @submit.prevent="save"
    >
      <div><span class="data-label">Um destino concreto</span><h2>{{ goal ? 'Ajustar objetivo' : 'Criar objetivo' }}</h2><p>Exemplos: reserva familiar, fundo de emergência ou margem anual.</p></div>
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
