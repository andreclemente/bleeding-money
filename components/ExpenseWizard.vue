<!-- eslint-disable vue/max-attributes-per-line, vue/singleline-html-element-content-newline -->
<script setup lang="ts">
import { analyzerCapabilities, applyExpenseTemplate, buildExpenseRequest, createExpenseWizardState, expenseTemplates, type ExpenseTemplate } from '../utils/expense-wizard'
const props = withDefaults(defineProps<{ welcome?: boolean }>(), { welcome: false })
const form = reactive(createExpenseWizardState())
const stages = ['type', 'essential', 'details', 'commitment', 'review'] as const
const step = ref(0)
const saving = ref(false)
const error = ref('')
const createdId = ref('')
const current = computed(() => stages[step.value])
const progress = computed(() => Math.round(((step.value + 1) / stages.length) * 100))
const capabilities = computed(() => analyzerCapabilities(form))
const needsCommitment = computed(() => form.category === 'telecom' || form.category === 'electricity' || form.category === 'subscription')
const choose = (template: ExpenseTemplate) => { applyExpenseTemplate(form, template); error.value = '' }
const next = () => {
  error.value = ''
  if (current.value === 'type' && !form.template) return void (error.value = 'Escolhe o tipo de despesa que queres verificar.')
  if (current.value === 'essential' && (!form.provider.trim() || !form.productName.trim() || !Number.isFinite(form.monthlyCost) || form.monthlyCost < 0)) return void (error.value = 'Indica fornecedor, produto e um custo mensal válido.')
  if (current.value === 'commitment' && needsCommitment.value && form.hasCommitment === null) return void (error.value = 'Indica se existe fidelização.')
  if (current.value === 'commitment' && form.hasCommitment && !form.commitmentEndDate) return void (error.value = 'Indica o fim da fidelização.')
  if (current.value === 'commitment' && form.hasCommitment && form.contractStartDate && form.commitmentEndDate && form.commitmentEndDate < form.contractStartDate) return void (error.value = 'O fim da fidelização não pode ser anterior ao início do contrato.')
  step.value = Math.min(step.value + 1, stages.length - 1)
  if (current.value === 'commitment' && !needsCommitment.value) next()
}
const back = () => {
  error.value = ''
  step.value = Math.max(0, step.value - 1)
  if (current.value === 'commitment' && !needsCommitment.value) back()
}
const submit = async () => {
  saving.value = true
  error.value = ''
  try {
    const item = await $fetch<{ id: string }>('/api/expenses', { method: 'POST', body: buildExpenseRequest(form) })
    createdId.value = item.id
  } catch (reason: unknown) {
    const value = reason as { data?: { statusMessage?: string }, message?: string }
    error.value = value.data?.statusMessage || value.message || 'Não foi possível guardar a despesa.'
  } finally { saving.value = false }
}
const addAnother = () => {
  Object.assign(form, createExpenseWizardState())
  step.value = 0
  createdId.value = ''
  error.value = ''
}
</script>

<template>
  <div class="wizard-shell">
    <div
      v-if="createdId"
      class="panel wizard-success"
      role="status"
    >
      <div class="section-kicker">
        Despesa analisada
      </div>
      <h1>Já está no teu monitor.</h1>
      <p>Guardámos os dados e executámos os checks disponíveis. Um resultado sem recomendações também é válido.</p>
      <div class="wizard-success-actions">
        <v-btn
          color="primary"
          :to="`/expenses/${createdId}`"
        >
          Ver resultado
        </v-btn><v-btn
          variant="outlined"
          @click="addAnother"
        >
          Adicionar outra despesa
        </v-btn><v-btn
          variant="text"
          to="/dashboard"
        >
          Voltar ao monitor
        </v-btn>
      </div>
    </div>
    <template v-else>
      <header class="wizard-top">
        <div><span>{{ props.welcome ? 'Primeira despesa' : 'Nova despesa' }}</span><strong>Passo {{ step + 1 }} de {{ stages.length }}</strong></div><div
          class="wizard-progress"
          aria-label="Progresso do assistente"
        >
          <span :style="{ width: `${progress}%` }" />
        </div>
      </header>
      <section class="panel wizard-card">
        <template v-if="current === 'type'">
          <div class="section-kicker">
            Começar pelo caso real
          </div>
          <h1>Que tipo de despesa queres verificar?</h1>
          <p class="wizard-lead">
            Escolhe o exemplo mais próximo. A escolha determina as perguntas e o registo real que será criado.
          </p>
          <div
            class="template-list"
            role="list"
          >
            <button
              v-for="item in expenseTemplates"
              :key="item.value"
              type="button"
              :class="{ selected: form.template === item.value }"
              @click="choose(item.value)"
            >
              <strong>{{ item.title }}</strong><span>{{ item.example }}</span>
            </button>
          </div>
        </template>
        <template v-else-if="current === 'essential'">
          <div class="section-kicker">
            Identificar
          </div><h1>Qual é a despesa?</h1>
          <div class="question-block">
            <v-text-field
              v-model="form.provider"
              label="Quem cobra?"
              placeholder="Ex.: Vodafone"
              variant="outlined"
              autofocus
            /><p><strong>Exemplo:</strong> o nome que aparece na fatura. <strong>Porque perguntamos:</strong> identifica a despesa e, em telecom, filtra comparações.</p>
          </div>
          <div class="question-block">
            <v-text-field
              v-model="form.productName"
              label="Que produto ou plano é?"
              placeholder="Ex.: Fibra 500"
              variant="outlined"
            /><p><strong>Exemplo:</strong> o nome comercial do plano. <strong>Porque perguntamos:</strong> torna a evidência reconhecível.</p>
          </div>
          <div class="question-block">
            <v-text-field
              v-model.number="form.monthlyCost"
              label="Quanto pagas por mês?"
              prefix="€"
              type="number"
              min="0"
              step="0.01"
              variant="outlined"
            /><p><strong>Exemplo:</strong> 39,90 €. <strong>Porque perguntamos:</strong> calcula aumentos e intervalos de poupança.</p>
          </div>
        </template>
        <template v-else-if="current === 'details'">
          <div class="section-kicker">
            Dados para os checks
          </div><h1>Só o que muda a análise</h1><p class="wizard-lead">
            Os campos marcados como opcionais podem ser saltados; nesse caso mostramos o check como indisponível.
          </p>
          <template v-if="form.category === 'electricity'">
            <div class="question-block">
              <v-text-field
                v-model.number="form.contractedPowerKva"
                label="Potência contratada (kVA)"
                type="number"
                min="0"
                step="0.01"
                variant="outlined"
              /><p><strong>Exemplo:</strong> 6,9 kVA. <strong>Porque perguntamos:</strong> comparamos com o máximo histórico.</p>
            </div>
            <div class="question-block">
              <v-text-field
                v-model.number="form.maxHistoricalPowerKva"
                label="Máximo de potência usado (kVA) · opcional"
                type="number"
                min="0"
                step="0.01"
                variant="outlined"
              /><p><strong>Exemplo:</strong> 3,8 kVA no histórico. <strong>Porque perguntamos:</strong> sem este valor não sugerimos reduzir potência.</p>
            </div>
          </template>
          <template v-else-if="form.category === 'telecom'">
            <div class="question-block">
              <v-select
                v-model="form.connectionType"
                label="Tipo de serviço"
                :items="[{ title: 'Fibra', value: 'fiber' }, { title: 'Móvel', value: 'mobile' }, { title: 'Cabo', value: 'cable' }]"
                variant="outlined"
              /><p><strong>Porque perguntamos:</strong> só comparamos contratos do mesmo tipo.</p>
            </div>
            <div class="question-block">
              <v-text-field
                v-model.number="form.downloadSpeedMbps"
                label="Velocidade anunciada (Mbps)"
                type="number"
                min="0"
                variant="outlined"
              /><p><strong>Exemplo:</strong> 500 Mbps. <strong>Porque perguntamos:</strong> filtra casos comparáveis.</p>
            </div>
          </template>
          <template v-else-if="form.category === 'bank'">
            <div class="question-block">
              <v-text-field
                v-model.number="form.accountMaintenanceFee"
                label="Comissão de manutenção mensal (€)"
                type="number"
                min="0"
                step="0.01"
                variant="outlined"
              /><p><strong>Exemplo:</strong> 7,90 €. <strong>Porque perguntamos:</strong> uma comissão positiva ativa o check de custo evitável.</p>
            </div>
          </template>
          <template v-else>
            <div class="question-block">
              <v-text-field
                v-model="form.lastUsedAt"
                label="Quando usaste pela última vez? · opcional"
                type="date"
                variant="outlined"
              /><p><strong>Exemplo:</strong> a última abertura do serviço. <strong>Porque perguntamos:</strong> 60 dias sem utilização podem justificar revisão.</p>
            </div>
          </template>
        </template>
        <template v-else-if="current === 'commitment'">
          <div class="section-kicker">
            Contrato
          </div><h1>Existe período de fidelização?</h1><p class="wizard-lead">
            Porque perguntamos: em telecom, a data permite detetar quando já podes negociar sem penalização.
          </p>
          <fieldset class="commitment-choice">
            <legend>Escolhe uma resposta</legend><button
              type="button"
              :class="{ selected: form.hasCommitment === true }"
              @click="form.hasCommitment = true"
            >
              Sim
            </button><button
              type="button"
              :class="{ selected: form.hasCommitment === false }"
              @click="form.hasCommitment = false"
            >
              Não
            </button>
          </fieldset>
          <div
            v-if="form.hasCommitment"
            class="wizard-fields two-columns"
          >
            <v-text-field
              v-model="form.contractStartDate"
              label="Início do contrato · opcional"
              type="date"
              variant="outlined"
            /><v-text-field
              v-model="form.commitmentEndDate"
              label="Fim da fidelização"
              type="date"
              variant="outlined"
            />
          </div>
        </template>
        <template v-else>
          <div class="section-kicker">
            Rever antes de guardar
          </div><h1>Estes checks vão correr</h1>
          <dl class="wizard-summary">
            <div><dt>Despesa</dt><dd>{{ form.provider }} · {{ form.productName }}</dd></div><div><dt>Custo mensal</dt><dd>{{ new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(form.monthlyCost) }}</dd></div>
          </dl>
          <div class="capability">
            <h2>Disponíveis</h2><ul>
              <li
                v-for="item in capabilities.available"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </div>
          <div
            v-if="capabilities.unavailable.length"
            class="capability capability--muted"
          >
            <h2>Indisponíveis com estes dados</h2><ul>
              <li
                v-for="item in capabilities.unavailable"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </div>
        </template>
        <p
          v-if="error"
          class="wizard-error"
          role="alert"
        >
          {{ error }}
        </p>
        <div class="wizard-actions">
          <v-btn
            v-if="step > 0"
            variant="text"
            :disabled="saving"
            @click="back"
          >
            Voltar
          </v-btn><span v-else /><div>
            <v-btn
              v-if="current === 'details'"
              variant="text"
              @click="next"
            >
              Saltar opcionais
            </v-btn><v-btn
              v-if="current !== 'review'"
              color="primary"
              @click="next"
            >
              Continuar
            </v-btn><v-btn
              v-else
              color="primary"
              :loading="saving"
              @click="submit"
            >
              Guardar e analisar
            </v-btn>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.wizard-shell { max-width: 760px; margin: 0 auto 4rem }.wizard-top { margin-bottom: 1rem }.wizard-top>div:first-child { display:flex;justify-content:space-between;color:var(--bm-muted);font-size:.82rem }.wizard-progress { height:4px;margin-top:.6rem;background:var(--bm-border) }.wizard-progress span { display:block;height:100%;background:var(--bm-primary) }.wizard-card,.wizard-success { padding:clamp(1.4rem,5vw,3rem) }.wizard-card h1,.wizard-success h1 { font-size:clamp(1.75rem,4vw,2.35rem) }.wizard-lead { color:var(--bm-muted);line-height:1.6 }.template-list { display:grid;margin-top:1.5rem;border-top:1px solid var(--bm-border) }.template-list button { min-height:68px;padding:.85rem .25rem;border:0;border-bottom:1px solid var(--bm-border);background:white;text-align:left;cursor:pointer }.template-list button strong,.template-list button span { display:block }.template-list button span { margin-top:.2rem;color:var(--bm-muted);font-size:.82rem }.template-list button.selected { padding-left:1rem;border-left:4px solid var(--bm-primary);background:var(--bm-primary-soft) }.question-block { margin-top:1.4rem }.question-block p { margin:-10px 0 0;color:var(--bm-muted);font-size:.8rem;line-height:1.5 }.commitment-choice { display:grid;grid-template-columns:1fr 1fr;gap:.75rem;padding:0;border:0 }.commitment-choice legend { grid-column:1/-1;margin-bottom:.5rem }.commitment-choice button { min-height:48px;border:1px solid var(--bm-border-strong);background:white }.commitment-choice button.selected { border-color:var(--bm-primary);background:var(--bm-primary-soft) }.wizard-fields,.two-columns { display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem }.wizard-summary { border-top:1px solid var(--bm-border) }.wizard-summary div { display:flex;justify-content:space-between;padding:.8rem 0;border-bottom:1px solid var(--bm-border) }.wizard-summary dd { margin:0;font-weight:700 }.capability { margin-top:1.3rem;padding:1rem;border-left:3px solid var(--bm-primary);background:var(--bm-surface-soft) }.capability h2 { font-size:1rem }.capability ul { margin-bottom:0 }.capability--muted { border-color:var(--bm-muted) }.wizard-error,.form-error { padding:.8rem;color:var(--bm-danger);background:var(--bm-danger-soft) }.wizard-actions,.wizard-actions>div,.wizard-success-actions { display:flex;justify-content:space-between;gap:.5rem;align-items:center }.wizard-actions { margin-top:2rem }.wizard-success-actions { justify-content:flex-start;flex-wrap:wrap }@media(max-width:620px){.wizard-fields,.two-columns,.commitment-choice{grid-template-columns:1fr}.wizard-actions,.wizard-actions>div,.wizard-success-actions{align-items:stretch;flex-direction:column-reverse}.wizard-actions .v-btn,.wizard-success-actions .v-btn{width:100%}}
</style>
