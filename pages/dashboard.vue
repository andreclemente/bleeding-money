<script setup lang="ts">
import type { SavingsFinding } from '../domain/types'
const requestFetch = useRequestFetch()
const setup = await requestFetch<{ onboardingNeeded: boolean }>('/api/setup')
if (setup.onboardingNeeded) await navigateTo('/welcome')
const store = useSavingsStore()
await callOnce(() => store.refresh(requestFetch))
const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value)) : 'ainda não realizada'
const priorityFindings = computed<SavingsFinding[]>(() => store.dashboard?.priorityFindings || [])
const hasEstimatedSaving = (finding: SavingsFinding) => finding.estimatedMonthlySavingMinCents > 0 || finding.estimatedMonthlySavingMaxCents > 0
</script>

<template>
  <div>
    <header class="monitor-header">
      <div>
        <div class="section-kicker">
          Monitor
        </div><h1>Despesas sob vigilância</h1>
      </div>
      <v-btn
        color="primary"
        to="/expenses/new"
      >
        Adicionar despesa
      </v-btn>
    </header>
    <div
      v-if="store.loading && !store.dashboard"
      class="monitor-loading"
      aria-busy="true"
    >
      A preparar o monitor…
    </div>
    <template v-else-if="store.dashboard">
      <p class="monitor-context">
        <strong>{{ store.dashboard.expenses.length }} {{ store.dashboard.expenses.length === 1 ? 'despesa vigiada' : 'despesas vigiadas' }}</strong><span>Última análise: {{ date(store.dashboard.lastAnalysisAt) }}</span><span>{{ money(store.dashboard.monthlyExpensesCents) }}/mês confirmados</span>
      </p>
      <NuxtLink
        class="monthly-spending-callout"
        to="/spending"
      >
        <span><small>Nova radiografia mensal</small><strong>Quanto saiu no supermercado e nos gastos do dia a dia?</strong><span>Regista um mês real, escolhe os teus próprios limites e acompanha o histórico sem estimativas inventadas.</span></span><b>Começar →</b>
      </NuxtLink>
      <section
        class="saving-overview"
        aria-labelledby="potential-title"
      >
        <div class="saving-primary">
          <template v-if="store.dashboard.potentialMonthlyMaxCents > 0">
            <span id="potential-title">Poupança mensal potencial</span><strong>{{ money(store.dashboard.potentialMonthlyMinCents) }}–{{ money(store.dashboard.potentialMonthlyMaxCents) }}</strong><p>Intervalo somado das recomendações abertas; não é uma garantia.</p>
          </template>
          <template v-else-if="priorityFindings.length">
            <span id="potential-title">Revisões factuais abertas</span><strong>Sem poupanças potenciais estimadas</strong><p>Os avisos atuais pedem confirmação; não existe ainda uma redução calculável.</p>
          </template>
          <template v-else>
            <span id="potential-title">Monitor sem perdas identificadas</span><strong>Sem poupança potencial identificada</strong><p>Os dados atuais não ultrapassam nenhuma regra; não inventamos uma estimativa.</p>
          </template>
        </div>
        <div class="saving-realized">
          <span>Poupança anual realizada</span><strong>{{ money(store.dashboard.realizedAnnualCents) }}</strong><p>Apenas ações que marcaste como concluídas.</p>
        </div>
      </section>
      <section aria-labelledby="actions-title">
        <div class="section-heading">
          <div>
            <h2 id="actions-title">
              O que fazer a seguir
            </h2><p>Prioridades ordenadas por impacto, urgência e confiança.</p>
          </div><NuxtLink
            class="text-link"
            to="/how-it-works"
          >
            Como funciona a análise?
          </NuxtLink>
        </div>
        <ol
          v-if="priorityFindings.length"
          class="action-list panel"
        >
          <li
            v-for="finding in priorityFindings"
            :key="finding.id"
          >
            <NuxtLink :to="`/findings?open=${finding.id}`">
              <span class="action-copy"><small>Prioridade {{ finding.priority }} · {{ Math.round(finding.confidence * 100) }}% confiança</small><strong>{{ finding.title }}</strong><span>{{ finding.evidence[0] || finding.description }}</span></span><span class="action-saving"><template v-if="hasEstimatedSaving(finding)">{{ money(finding.estimatedMonthlySavingMinCents) }}–{{ money(finding.estimatedMonthlySavingMaxCents) }}<small>/mês</small></template><template v-else>Poupança não estimada<small>revisão factual</small></template></span>
            </NuxtLink>
          </li>
        </ol>
        <div
          v-else
          class="panel healthy-state"
        >
          <strong>Sem ações abertas</strong><p>Os dados atuais não ultrapassam nenhuma regra. Um estado saudável é um resultado válido.</p><NuxtLink
            class="text-link"
            to="/expenses"
          >
            Rever despesas
          </NuxtLink>
        </div>
      </section>
      <footer class="monitor-footer">
        <NuxtLink to="/expenses">
          Gerir {{ store.dashboard.expenses.length }} despesas
        </NuxtLink><NuxtLink to="/findings">
          Ver todas as recomendações
        </NuxtLink>
      </footer>
    </template>
  </div>
</template>
