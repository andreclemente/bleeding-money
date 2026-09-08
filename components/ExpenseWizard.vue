<!-- eslint-disable vue/max-attributes-per-line, vue/singleline-html-element-content-newline -->
<script setup lang="ts">
import { buildExpenseRequest, createExpenseWizardState } from '../utils/expense-wizard'

const props = withDefaults(defineProps<{ welcome?: boolean }>(), { welcome: false })
const form = reactive(createExpenseWizardState())
const step = ref(0)
const saving = ref(false)
const error = ref('')
const categories = [
  { value: 'electricity', title: 'Eletricidade', icon: '⚡', copy: 'Fatura, tarifa e potência contratada' },
  { value: 'telecom', title: 'Telecomunicações', icon: '⌁', copy: 'Internet, móvel ou pacote TV' },
  { value: 'bank', title: 'Banca', icon: '€', copy: 'Conta, cartão e comissões' },
  { value: 'subscription', title: 'Subscrição', icon: '◉', copy: 'Streaming, software ou outro serviço' }
] as const
const commitmentApplies = computed(() => ['electricity', 'telecom', 'subscription'].includes(form.category))
const flow = computed(() => [
  ...(props.welcome ? ['intro'] : []),
  'category', 'essential', 'details', ...(commitmentApplies.value ? ['commitment'] : []), 'review'
])
const current = computed(() => flow.value[step.value])
const progress = computed(() => Math.round(((step.value + 1) / flow.value.length) * 100))
const category = computed(() => categories.find(item => item.value === form.category)!)

watch(() => form.category, () => {
  form.hasCommitment = null
  form.contractStartDate = ''
  form.commitmentEndDate = ''
})

const next = () => {
  error.value = ''
  if (current.value === 'essential' && (!form.provider.trim() || !form.productName.trim() || form.monthlyCost < 0)) {
    error.value = 'Preenche o fornecedor, o produto e um custo mensal válido.'
    return
  }
  if (current.value === 'commitment') {
    if (form.hasCommitment === null) {
      error.value = 'Indica se existe um período de fidelização.'
      return
    }
    if (form.hasCommitment && (!form.contractStartDate || !form.commitmentEndDate)) {
      error.value = 'Indica o início do contrato e o fim da fidelização.'
      return
    }
    if (form.hasCommitment && form.commitmentEndDate < form.contractStartDate) {
      error.value = 'O fim da fidelização não pode ser anterior ao início do contrato.'
      return
    }
  }
  step.value = Math.min(step.value + 1, flow.value.length - 1)
}
const back = () => {
  error.value = ''
  step.value = Math.max(0, step.value - 1)
}
const submit = async () => {
  saving.value = true
  error.value = ''
  try {
    const item = await $fetch<{ id: string }>('/api/expenses', { method: 'POST', body: buildExpenseRequest(form) })
    await navigateTo(`/expenses/${item.id}`)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Não foi possível guardar a despesa.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="wizard-shell">
    <div
      class="wizard-progress"
      aria-label="Progresso do assistente"
    >
      <span :style="{ width: `${progress}%` }" />
    </div>
    <div class="wizard-meta">
      <span>Passo {{ step + 1 }} de {{ flow.length }}</span>
      <span>{{ progress }}%</span>
    </div>

    <section class="panel wizard-card">
      <template v-if="current === 'intro'">
        <div
          class="wizard-hero-icon"
          aria-hidden="true"
        >
          ↘
        </div>
        <div class="section-kicker">
          Bem-vindo ao BleedingMoney
        </div>
        <h1>Descobre onde o teu dinheiro está a escapar.</h1>
        <p class="wizard-lead">
          Regista uma despesa recorrente. Nós analisamos o preço, o contrato e a utilização para encontrar oportunidades concretas — os teus dados ficam no teu armazenamento.
        </p>
        <ul class="wizard-promises">
          <li><strong>2 minutos</strong> para a primeira análise</li>
          <li><strong>Sem conta</strong> e sem dados desnecessários</li>
          <li><strong>Resultados claros</strong>, com evidência e próximos passos</li>
        </ul>
      </template>

      <template v-else-if="current === 'category'">
        <div class="section-kicker">
          Primeiro, escolhe uma área
        </div>
        <h1>Que despesa queres analisar?</h1>
        <p class="wizard-lead">
          Começa pela que mais te preocupa. Podes adicionar as restantes depois.
        </p>
        <div class="category-grid">
          <button
            v-for="item in categories"
            :key="item.value"
            type="button"
            class="category-choice"
            :class="{ selected: form.category === item.value }"
            @click="form.category = item.value"
          >
            <span
              class="category-icon"
              aria-hidden="true"
            >{{ item.icon }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.copy }}</small>
          </button>
        </div>
      </template>

      <template v-else-if="current === 'essential'">
        <div class="section-kicker">
          {{ category.title }} · essencial
        </div>
        <h1>Identifica a despesa</h1>
        <p class="wizard-lead">
          Só precisamos do que aparece no extrato ou na fatura.
        </p>
        <div class="wizard-fields">
          <v-text-field
            v-model="form.provider"
            label="Fornecedor"
            placeholder="Ex.: EDP, Vodafone, Netflix"
            variant="outlined"
            autofocus
          />
          <v-text-field
            v-model="form.productName"
            label="Produto ou plano"
            placeholder="Ex.: Fibra 500, Premium"
            variant="outlined"
          />
          <v-text-field
            v-model.number="form.monthlyCost"
            label="Quanto pagas por mês?"
            prefix="€"
            type="number"
            min="0"
            step="0.01"
            variant="outlined"
            hint="Usa uma média se o valor variar."
            persistent-hint
          />
        </div>
      </template>

      <template v-else-if="current === 'details'">
        <div class="section-kicker">
          {{ category.title }} · análise
        </div>
        <h1>Afina a comparação</h1>
        <p class="wizard-lead">
          Se não tiveres estes dados agora, podes saltar e completar mais tarde.
        </p>
        <div class="wizard-fields two-columns">
          <template v-if="form.category === 'electricity'">
            <v-text-field
              v-model.number="form.contractedPowerKva"
              label="Potência contratada (kVA)"
              type="number"
              min="0"
              step="0.01"
              variant="outlined"
            />
            <v-select
              v-model="form.tariffType"
              label="Tarifa"
              :items="['simples', 'bi-horária', 'tri-horária']"
              variant="outlined"
            />
            <v-text-field
              v-model.number="form.annualConsumptionKwh"
              label="Consumo anual (kWh)"
              type="number"
              min="0"
              variant="outlined"
            />
          </template>
          <template v-else-if="form.category === 'telecom'">
            <v-select
              v-model="form.connectionType"
              label="Tipo de serviço"
              :items="[{ title: 'Fibra', value: 'fiber' }, { title: 'Móvel', value: 'mobile' }, { title: 'Cabo', value: 'cable' }]"
              variant="outlined"
            />
            <v-text-field
              v-model.number="form.downloadSpeedMbps"
              label="Velocidade (Mbps)"
              type="number"
              min="0"
              variant="outlined"
            />
            <v-text-field
              v-model.number="form.mobileLines"
              label="N.º de linhas móveis"
              type="number"
              min="0"
              variant="outlined"
            />
            <v-checkbox
              v-model="form.tvIncluded"
              label="Inclui televisão"
              color="primary"
            />
          </template>
          <template v-else-if="form.category === 'bank'">
            <v-text-field
              v-model.number="form.accountMaintenanceFee"
              label="Manutenção mensal (€)"
              type="number"
              min="0"
              step="0.01"
              variant="outlined"
            />
            <v-text-field
              v-model.number="form.cardAnnualFee"
              label="Anuidade do cartão (€)"
              type="number"
              min="0"
              step="0.01"
              variant="outlined"
            />
            <v-text-field
              v-model.number="form.transferFees"
              label="Outras comissões mensais (€)"
              type="number"
              min="0"
              step="0.01"
              variant="outlined"
            />
          </template>
          <template v-else>
            <v-text-field
              v-model="form.plan"
              label="Nome do plano"
              :placeholder="form.productName || 'Ex.: Standard'"
              variant="outlined"
            />
            <v-text-field
              v-model="form.lastUsedAt"
              label="Última utilização"
              type="date"
              variant="outlined"
            />
            <v-select
              v-model="form.usageFrequency"
              label="Com que frequência usas?"
              clearable
              :items="[{ title: 'Todos os dias', value: 'daily' }, { title: 'Todas as semanas', value: 'weekly' }, { title: 'Raramente', value: 'rarely' }, { title: 'Nunca', value: 'never' }]"
              variant="outlined"
            />
          </template>
        </div>
      </template>

      <template v-else-if="current === 'commitment'">
        <div class="section-kicker">
          Contrato
        </div>
        <h1>Período de fidelização</h1>
        <p class="wizard-lead">
          Saber quando podes renegociar ajuda-nos a recomendar a altura certa para agir.
        </p>
        <fieldset class="commitment-choice">
          <legend>Esta despesa tem fidelização?</legend>
          <button
            type="button"
            :class="{ selected: form.hasCommitment === true }"
            @click="form.hasCommitment = true"
          >
            Sim, tem fidelização
          </button>
          <button
            type="button"
            :class="{ selected: form.hasCommitment === false }"
            @click="form.hasCommitment = false"
          >
            Não tem fidelização
          </button>
        </fieldset>
        <div
          v-if="form.hasCommitment"
          class="wizard-fields two-columns commitment-dates"
        >
          <v-text-field
            v-model="form.contractStartDate"
            label="Início do contrato"
            type="date"
            variant="outlined"
          />
          <v-text-field
            v-model="form.commitmentEndDate"
            label="Fim da fidelização"
            type="date"
            variant="outlined"
          />
        </div>
      </template>

      <template v-else>
        <div
          class="wizard-hero-icon wizard-hero-icon--small"
          aria-hidden="true"
        >
          ✓
        </div>
        <div class="section-kicker">
          Pronto para analisar
        </div>
        <h1>Confirma a tua primeira despesa</h1>
        <dl class="wizard-summary">
          <div><dt>Categoria</dt><dd>{{ category.title }}</dd></div>
          <div><dt>Serviço</dt><dd>{{ form.provider }} · {{ form.productName }}</dd></div>
          <div><dt>Custo mensal</dt><dd>{{ new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(form.monthlyCost) }}</dd></div>
          <div v-if="commitmentApplies">
            <dt>Fidelização</dt><dd>{{ form.hasCommitment ? `até ${form.commitmentEndDate}` : 'Sem fidelização' }}</dd>
          </div>
        </dl>
        <p class="wizard-lead">
          Ao guardar, os analisadores verificam imediatamente esta despesa. Se não houver alertas, verás um estado saudável.
        </p>
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
          ← Voltar
        </v-btn>
        <span v-else />
        <div>
          <v-btn
            v-if="current === 'details'"
            variant="text"
            :disabled="saving"
            @click="next"
          >
            Saltar por agora
          </v-btn>
          <v-btn
            v-if="current !== 'review'"
            color="primary"
            size="large"
            @click="next"
          >
            Continuar →
          </v-btn>
          <v-btn
            v-else
            color="primary"
            size="large"
            :loading="saving"
            @click="submit"
          >
            Guardar e analisar
          </v-btn>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wizard-shell { max-width: 780px; margin: 1.5rem auto 4rem; }
.wizard-progress { height: 6px; overflow: hidden; border-radius: 999px; background: #dfe7e2; }
.wizard-progress span { display: block; height: 100%; border-radius: inherit; background: var(--color-primary, #176b4d); transition: width .25s ease; }
.wizard-meta { display: flex; justify-content: space-between; margin: .55rem .2rem 1.2rem; color: #66756d; font-size: .8rem; font-weight: 700; }
.wizard-card { padding: clamp(1.5rem, 5vw, 3.5rem); }
.wizard-card h1 { max-width: 650px; margin: .45rem 0 .75rem; font-size: clamp(1.8rem, 4vw, 2.7rem); line-height: 1.08; }
.wizard-lead { max-width: 650px; color: #5b6b63; font-size: 1.05rem; line-height: 1.65; }
.wizard-hero-icon { display: grid; width: 66px; height: 66px; place-items: center; margin-bottom: 1.25rem; border-radius: 20px; color: white; background: #176b4d; font-size: 2rem; }
.wizard-hero-icon--small { width: 50px; height: 50px; font-size: 1.4rem; }
.wizard-promises { display: grid; gap: .8rem; padding: 0; margin: 1.7rem 0; list-style: none; }
.wizard-promises li { padding-left: 1.7rem; color: #43534b; position: relative; }
.wizard-promises li::before { content: '✓'; position: absolute; left: 0; color: #176b4d; font-weight: 900; }
.category-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .85rem; margin-top: 1.7rem; }
.category-choice { display: grid; grid-template-columns: auto 1fr; gap: .15rem .8rem; padding: 1.15rem; border: 2px solid #dce5df; border-radius: 16px; text-align: left; background: white; cursor: pointer; }
.category-choice:hover, .category-choice.selected { border-color: #176b4d; background: #f1f8f4; }
.category-icon { grid-row: 1 / 3; font-size: 1.6rem; color: #176b4d; }
.category-choice small { color: #6c7972; }
.wizard-fields { display: grid; gap: .65rem; margin-top: 1.7rem; }
.two-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.commitment-choice { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; padding: 0; margin: 1.7rem 0; border: 0; }
.commitment-choice legend { grid-column: 1 / -1; margin-bottom: .4rem; font-weight: 800; }
.commitment-choice button { padding: 1rem; border: 2px solid #dce5df; border-radius: 14px; background: white; font-weight: 750; cursor: pointer; }
.commitment-choice button.selected { border-color: #176b4d; color: #12583f; background: #eff8f3; }
.wizard-summary { margin: 1.5rem 0; border-top: 1px solid #e3e9e5; }
.wizard-summary div { display: flex; justify-content: space-between; gap: 1rem; padding: .9rem 0; border-bottom: 1px solid #e3e9e5; }
.wizard-summary dt { color: #66756d; }
.wizard-summary dd { margin: 0; font-weight: 800; text-align: right; }
.wizard-error { padding: .8rem 1rem; border-radius: 10px; color: #8d261e; background: #fff0ee; }
.wizard-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 2rem; }
.wizard-actions > div { display: flex; gap: .4rem; }
@media (max-width: 620px) { .category-grid, .two-columns, .commitment-choice { grid-template-columns: 1fr; } .wizard-actions, .wizard-actions > div { align-items: stretch; flex-direction: column-reverse; } }
</style>
