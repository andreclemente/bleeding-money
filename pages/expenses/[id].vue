<script setup lang="ts">
import { buildContractAgendaPatch } from '../../domain/contract-agenda'
import { buildContractCallGuide, buildContractDecisionDossier, buildContractDecisionSignal, buildExpenseLifecycle, compareContractProposal } from '../../domain/expense-lifecycle'
import type { ExpenseCategory, ExpenseSnapshot, InsuranceCoverageCode, RecurringExpense, SavingsFinding } from '../../domain/types'

const route = useRoute()
const { data, pending, error: loadError, refresh } = await useFetch<{
  expense: RecurringExpense
  snapshots: ExpenseSnapshot[]
  findings: SavingsFinding[]
}>(`/api/expenses/${route.params.id}`)

const money = (cents: number) => new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR'
}).format(cents / 100)
const date = (value: string) => new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
}).format(new Date(value))
const categories: Record<ExpenseCategory, string> = {
  electricity: 'Eletricidade',
  telecom: 'Telecomunicações',
  bank: 'Banca',
  subscription: 'Subscrição',
  gym: 'Ginásio',
  insurance: 'Seguro'
}
const openFindings = computed(() => data.value?.findings.filter(item => item.status === 'open') || [])
type InsuranceDetails = Extract<RecurringExpense['details'], { kind: 'insurance' }>
const insuranceDetails = computed<InsuranceDetails | null>(() => data.value?.expense.details.kind === 'insurance' ? data.value.expense.details : null)
const policyTypes = { car: 'Automóvel', home: 'Casa', health: 'Saúde', life: 'Vida', other: 'Outro' } as const
const coverageLabels: Record<InsuranceCoverageCode, string> = { civil_liability: 'Responsabilidade civil', own_damage: 'Danos próprios', building: 'Edifício', contents: 'Conteúdo/recheio', hospitalization: 'Hospitalização', outpatient: 'Ambulatório', death: 'Morte', disability: 'Invalidez', travel_assistance: 'Assistência em viagem' }
const policyLabel = (details: InsuranceDetails) => policyTypes[details.policyType]
const coverageText = (details: InsuranceDetails) => details.coverageCodes.length ? details.coverageCodes.map(code => coverageLabels[code]).join(', ') : 'Não declaradas'
const lifecycle = computed(() => data.value ? buildExpenseLifecycle(data.value.expense, data.value.snapshots) : null)
const today = new Date()
const currentCivilDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const decisionSignal = computed(() => lifecycle.value ? buildContractDecisionSignal(lifecycle.value.decisionDates, currentCivilDate) : null)
const decisionDossier = computed(() => data.value ? buildContractDecisionDossier(data.value.expense) : null)
const callGuide = computed(() => data.value && lifecycle.value ? buildContractCallGuide(data.value.expense, lifecycle.value.decisionDates) : null)
const callGuideStatus = ref('')
const copyCallGuide = async () => {
  if (!data.value || !callGuide.value) return
  const guide = callGuide.value
  const lines = [
    `Contrato: ${data.value.expense.productName} · ${data.value.expense.provider}`,
    `Custo atual declarado: ${money(guide.currentMonthlyCents)} / mês`,
    `Equivalente anual: ${money(guide.annualEquivalentCents)}`,
    guide.nextDeclaredDate ? `${guide.nextDeclaredDate.label}: ${date(guide.nextDeclaredDate.date)}` : 'Prazo contratual: não declarado',
    '',
    'Perguntas a confirmar:',
    ...guide.questions.map((question: string, index: number) => `${index + 1}. ${question}`),
    '',
    guide.rule
  ]
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    callGuideStatus.value = 'Guião copiado.'
  } catch {
    callGuideStatus.value = 'Não foi possível copiar o guião.'
  }
}
const percentage = (basisPoints: number) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(basisPoints) / 100)
const changeLabel = (change: { cents: number, basisPoints: number } | null) => {
  if (!change) return 'Primeiro valor registado'
  if (change.cents === 0) return 'Sem alteração face ao registo anterior'
  return `${change.cents > 0 ? 'Aumento' : 'Redução'} de ${money(Math.abs(change.cents))} (${percentage(change.basisPoints)}%)`
}
const valueEditorOpen = ref(false)
const newMonthlyCost = ref('')
const savingValue = ref(false)
const valueError = ref('')
const valueSuccess = ref('')
const parseEuros = (value: string) => {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Usa um valor em EUR com, no máximo, duas casas decimais.')
  const [euros, decimals = ''] = normalized.split('.')
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > 2_147_483_647) throw new Error('O valor indicado é demasiado elevado.')
  return cents
}
const proposalMonthlyCost = ref('')
const proposalOneOffCost = ref('0')
const proposalCommitmentMonths = ref('12')
const proposalHasLaterPrice = ref(false)
const proposalIntroductoryMonths = ref('')
const proposalLaterMonthlyCost = ref('')
const proposalError = ref('')
const proposalComparison = ref<ReturnType<typeof compareContractProposal> | null>(null)
const compareProposal = () => {
  if (!data.value) return
  proposalError.value = ''
  proposalComparison.value = null
  try {
    if (!/^\d+$/.test(proposalCommitmentMonths.value.trim())) throw new Error('Indica a duração em meses inteiros.')
    if (proposalHasLaterPrice.value && !/^\d+$/.test(proposalIntroductoryMonths.value.trim())) throw new Error('Indica os meses ao preço inicial.')
    proposalComparison.value = compareContractProposal({
      currentMonthlyCents: data.value.expense.monthlyCostCents,
      proposedMonthlyCents: parseEuros(proposalMonthlyCost.value),
      oneOffCents: parseEuros(proposalOneOffCost.value),
      commitmentMonths: Number(proposalCommitmentMonths.value),
      ...(proposalHasLaterPrice.value ? {
        introductoryMonths: Number(proposalIntroductoryMonths.value),
        laterMonthlyCents: parseEuros(proposalLaterMonthlyCost.value)
      } : {})
    })
  } catch (caught) {
    proposalError.value = (caught as Error).message
  }
}
const proposalOutcome = computed(() => {
  const comparison = proposalComparison.value
  if (!comparison) return ''
  if (comparison.outcome === 'lower') return `A proposta custa menos ${money(comparison.periodDifferenceCents)} no período indicado.`
  if (comparison.outcome === 'higher') return `A proposta custa mais ${money(Math.abs(comparison.periodDifferenceCents))} no período indicado.`
  return 'A proposta tem o mesmo custo total no período indicado.'
})
const proposalBreakEven = computed(() => {
  const comparison = proposalComparison.value
  if (!comparison) return ''
  if (comparison.breakEvenMonth === null) return `Não é atingido dentro dos ${comparison.commitmentMonths} meses comparados.`
  if (comparison.breakEvenMonth === 0) return 'Sem custos únicos por recuperar; a diferença mensal começa no 1.º mês.'
  return `Custos únicos recuperados no ${comparison.breakEvenMonth}.º mês, se os valores não mudarem.`
})
const proposalPriceLimit = computed(() => {
  const comparison = proposalComparison.value
  if (!comparison) return ''
  if (comparison.maximumMonthlyCentsForNoIncrease === null) {
    return 'Os custos únicos são tão altos que nem uma mensalidade de 0 € evita pagar mais no período indicado.'
  }
  const label = comparison.introductoryMonths === undefined ? 'mensalidade máxima' : 'mensalidade posterior máxima'
  return `${label}: ${money(comparison.maximumMonthlyCentsForNoIncrease)}. Acima deste valor, a proposta passa a custar mais no período indicado.`
})
const proposalLaterPriceSignal = computed(() => {
  const difference = proposalComparison.value?.laterRecurringDifferenceCents
  if (difference === undefined) return null
  if (difference < 0) return {
    tone: 'warning',
    text: `Depois da promoção, a mensalidade fica ${money(Math.abs(difference))} acima do custo atual declarado. A vantagem acumulada começa a diminuir.`
  }
  if (difference > 0) return {
    tone: 'positive',
    text: `Depois da promoção, a mensalidade continua ${money(difference)} abaixo do custo atual declarado.`
  }
  return { tone: 'neutral', text: 'Depois da promoção, a mensalidade fica igual ao custo atual declarado.' }
})
const proposalLaterAnnualDifference = computed(() => {
  const difference = proposalComparison.value?.laterAnnualDifferenceCents
  if (difference === undefined) return ''
  if (difference > 0) return `${money(difference)} menos por ano face ao custo atual declarado.`
  if (difference < 0) return `${money(Math.abs(difference))} mais por ano face ao custo atual declarado.`
  return 'O mesmo custo anual face ao custo atual declarado.'
})
const proposalFirstPeriodDifference = computed(() => {
  const difference = proposalComparison.value?.firstPeriodDifferenceCents
  if (difference === undefined) return ''
  if (difference > 0) return `${money(difference)} menos face ao custo atual no mesmo período.`
  if (difference < 0) return `${money(Math.abs(difference))} mais face ao custo atual no mesmo período.`
  return 'O mesmo custo face ao custo atual no mesmo período.'
})
const proposalFirstMonthSignal = computed(() => {
  const difference = proposalComparison.value?.firstMonthDifferenceCents
  if (difference === undefined) return null
  if (difference < 0) return {
    tone: 'warning',
    text: `Esforço inicial: ${money(Math.abs(difference))} mais do que o custo atual no primeiro mês.`
  }
  if (difference > 0) return {
    tone: 'positive',
    text: `Esforço inicial: ${money(difference)} menos do que o custo atual no primeiro mês.`
  }
  return { tone: 'neutral', text: 'Esforço inicial igual ao custo atual no primeiro mês.' }
})
const openValueEditor = () => {
  newMonthlyCost.value = data.value ? String(data.value.expense.monthlyCostCents / 100).replace('.', ',') : ''
  valueError.value = ''
  valueSuccess.value = ''
  valueEditorOpen.value = true
}
const saveObservedValue = async () => {
  if (!data.value) return
  valueError.value = ''
  valueSuccess.value = ''
  savingValue.value = true
  try {
    const monthlyCostCents = parseEuros(newMonthlyCost.value)
    if (monthlyCostCents === data.value.expense.monthlyCostCents) throw new Error('Indica um valor diferente do custo atual.')
    await $fetch(`/api/expenses/${data.value.expense.id}`, { method: 'PATCH', body: { monthlyCostCents } })
    await refresh()
    valueSuccess.value = 'Novo valor guardado na linha de vida.'
    valueEditorOpen.value = false
  } catch (caught) {
    valueError.value = (caught as { data?: { statusMessage?: string }, message?: string }).data?.statusMessage || (caught as Error).message
  } finally {
    savingValue.value = false
  }
}
const agendaEditorOpen = ref(false)
const commitmentEndDate = ref('')
const contractEndDate = ref('')
const renewalDate = ref('')
const savingAgenda = ref(false)
const agendaError = ref('')
const agendaSuccess = ref('')
const openAgendaEditor = () => {
  if (!data.value) return
  commitmentEndDate.value = data.value.expense.commitmentEndDate || ''
  contractEndDate.value = data.value.expense.contractEndDate || ''
  renewalDate.value = data.value.expense.details.kind === 'insurance' ? data.value.expense.details.renewalDate || '' : ''
  agendaError.value = ''
  agendaSuccess.value = ''
  agendaEditorOpen.value = true
}
const saveAgenda = async () => {
  if (!data.value) return
  agendaError.value = ''
  agendaSuccess.value = ''
  savingAgenda.value = true
  try {
    const body = buildContractAgendaPatch(data.value.expense, {
      commitmentEndDate: commitmentEndDate.value,
      contractEndDate: contractEndDate.value,
      renewalDate: insuranceDetails.value ? renewalDate.value : undefined
    })
    await $fetch(`/api/expenses/${data.value.expense.id}`, { method: 'PATCH', body })
    await refresh()
    agendaSuccess.value = 'Datas guardadas como factos declarados.'
    agendaEditorOpen.value = false
  } catch (caught) {
    agendaError.value = (caught as { data?: { statusMessage?: string }, message?: string }).data?.statusMessage || (caught as Error).message
  } finally {
    savingAgenda.value = false
  }
}
</script>

<template>
  <div>
    <NuxtLink
      class="back-link"
      to="/expenses"
    >
      ← Todas as despesas
    </NuxtLink>

    <div
      v-if="pending"
      class="loading-grid"
      aria-label="A carregar detalhe da despesa"
      aria-busy="true"
    >
      <div
        v-for="item in 2"
        :key="item"
        class="loading-card"
      />
    </div>

    <div
      v-else-if="loadError"
      class="panel empty-state"
      role="alert"
    >
      <div>
        <span
          class="empty-state-icon"
          aria-hidden="true"
        >!</span>
        <h1>Não foi possível abrir esta despesa</h1>
        <p>O registo pode já não existir ou ocorreu um problema temporário.</p>
        <v-btn to="/expenses">
          Voltar às despesas
        </v-btn>
      </div>
    </div>

    <template v-else-if="data">
      <header class="panel detail-hero">
        <div>
          <div class="section-kicker">
            {{ categories[data.expense.category] }}
          </div>
          <h1>{{ data.expense.productName }}</h1>
          <p class="page-subtitle">
            {{ data.expense.provider }} · acompanhado desde {{ date(data.expense.createdAt) }}
          </p>
        </div>
        <div class="detail-price">
          <strong>{{ money(data.expense.monthlyCostCents) }}</strong>
          <span>Custo recorrente / mês</span>
          <div class="detail-annual">
            <b>{{ money(lifecycle!.annualEquivalentCents) }}</b>
            <span>Equivalente anual · não é uma cobrança adicional</span>
          </div>
        </div>
      </header>

      <section
        v-if="insuranceDetails"
        class="panel insurance-contract"
        aria-labelledby="insurance-heading"
      >
        <div class="panel-header">
          <div>
            <div class="section-kicker">
              Seguro auditável
            </div>
            <h2 id="insurance-heading">
              Ficha do contrato
            </h2>
          </div>
        </div>
        <dl class="wizard-summary">
          <div><dt>Tipo</dt><dd>{{ policyLabel(insuranceDetails) }}</dd></div>
          <div><dt>Próxima renovação</dt><dd>{{ insuranceDetails.renewalDate ? date(insuranceDetails.renewalDate) : 'Não declarada' }}</dd></div>
          <div><dt>Coberturas declaradas</dt><dd>{{ coverageText(insuranceDetails) }}</dd></div>
        </dl>
        <p class="page-subtitle">
          Compara sempre capitais, pessoas ou bens cobertos, exclusões e franquias. Uma cobertura com o mesmo nome noutro contrato é apenas um sinal para rever, não uma poupança calculada.
        </p>
      </section>

      <div class="detail-grid">
        <section
          class="panel lifecycle-panel"
          aria-labelledby="lifecycle-heading"
        >
          <div class="panel-header">
            <div>
              <div class="section-kicker">
                Evidência registada
              </div>
              <h2 id="lifecycle-heading">
                Linha de vida da despesa
              </h2>
            </div>
            <span class="evidence-rule">Variação confirmada apenas entre valores observados</span>
          </div>
          <ol
            v-if="lifecycle!.observations.length"
            class="expense-lifecycle"
          >
            <li
              v-for="observation in lifecycle!.observations"
              :key="observation.snapshot.id"
            >
              <span
                class="lifecycle-marker"
                aria-hidden="true"
              />
              <div class="lifecycle-entry">
                <div>
                  <time :datetime="observation.snapshot.observedAt">{{ date(observation.snapshot.observedAt) }}</time>
                  <strong>{{ money(observation.snapshot.priceCents) }}</strong>
                </div>
                <p>{{ observation.snapshot.plan || 'Sem plano indicado' }} · valor observado</p>
                <span
                  class="change-note"
                  :class="{ 'change-note--increase': observation.change && observation.change.cents > 0, 'change-note--reduction': observation.change && observation.change.cents < 0 }"
                >{{ changeLabel(observation.change) }}</span>
              </div>
            </li>
          </ol>
          <div
            v-else
            class="lifecycle-empty"
          >
            <strong>Ainda sem valores anteriores</strong>
            <p>O custo atual está registado, mas ainda não existe outro valor observado para confirmar uma variação.</p>
          </div>
        </section>

        <div class="detail-sidebar">
          <aside
            class="panel observed-value"
            aria-labelledby="observed-value-heading"
          >
            <div class="section-kicker">
              Evidência manual
            </div>
            <h2 id="observed-value-heading">
              Registar novo valor observado
            </h2>
            <p>Quando uma fatura ou extrato mostrar outro custo mensal, guarda-o aqui. O valor anterior fica na linha de vida.</p>
            <p class="observed-value__rule">
              Esta atualização regista um facto; não confirma uma poupança. Uma redução só entra no objetivo ao concluir um caso aberto com o novo custo real.
            </p>
            <button
              v-if="!valueEditorOpen"
              class="secondary-action observed-value__open"
              type="button"
              @click="openValueEditor"
            >
              Atualizar custo mensal
            </button>
            <form
              v-else
              class="observed-value__form"
              @submit.prevent="saveObservedValue"
            >
              <label for="new-monthly-cost">Novo valor em EUR</label>
              <div class="money-input">
                <input
                  id="new-monthly-cost"
                  v-model="newMonthlyCost"
                  inputmode="decimal"
                  autocomplete="off"
                  :aria-invalid="Boolean(valueError)"
                  aria-describedby="observed-value-help observed-value-error"
                ><span>EUR</span>
              </div>
              <small id="observed-value-help">Usa o equivalente mensal que aparece na fatura ou no extrato.</small>
              <div class="observed-value__actions">
                <button
                  type="button"
                  class="text-action"
                  @click="valueEditorOpen = false"
                >
                  Cancelar
                </button>
                <v-btn
                  type="submit"
                  color="primary"
                  :loading="savingValue"
                >
                  Guardar valor
                </v-btn>
              </div>
            </form>
            <p
              v-if="valueError"
              id="observed-value-error"
              class="form-error"
              role="alert"
            >
              {{ valueError }}
            </p>
            <p
              v-if="valueSuccess"
              class="form-success"
              role="status"
            >
              {{ valueSuccess }}
            </p>
          </aside>

          <aside
            class="panel decision-dates"
            aria-labelledby="decision-dates-heading"
          >
            <div class="section-kicker">
              Agenda contratual
            </div>
            <h2 id="decision-dates-heading">
              Datas para decidir
            </h2>
            <p>Renovação, fidelização e fim de contrato são eventos diferentes. São factos declarados; não alteram custos nem confirmam poupanças.</p>
            <template v-if="!agendaEditorOpen">
              <div
                v-if="decisionSignal"
                class="decision-signal"
                :class="`decision-signal--${decisionSignal.timing}`"
              >
                <span>Próximo prazo declarado</span>
                <strong>{{ decisionSignal.event.label }} · {{ date(decisionSignal.event.date) }}</strong>
                <b>{{ decisionSignal.timingLabel }}</b>
                <p>{{ decisionSignal.action }}</p>
                <small>Não altera custos nem confirma poupanças.</small>
              </div>
              <div
                v-if="decisionDossier"
                class="decision-dossier"
              >
                <span>Preparar a decisão</span>
                <strong>{{ decisionDossier.title }}</strong>
                <ul>
                  <li
                    v-for="item in decisionDossier.evidence"
                    :key="item"
                  >
                    {{ item }}
                  </li>
                </ul>
                <small>{{ decisionDossier.rule }}</small>
              </div>
              <div
                v-if="callGuide"
                class="call-guide"
              >
                <span>Guião para falar com o fornecedor</span>
                <dl>
                  <div><dt>Custo atual declarado</dt><dd>{{ money(callGuide.currentMonthlyCents) }} / mês</dd></div>
                  <div><dt>Equivalente anual</dt><dd>{{ money(callGuide.annualEquivalentCents) }}</dd></div>
                  <div><dt>Prazo a confirmar</dt><dd>{{ callGuide.nextDeclaredDate ? `${callGuide.nextDeclaredDate.label} · ${date(callGuide.nextDeclaredDate.date)}` : 'Não declarado' }}</dd></div>
                </dl>
                <strong>Perguntas a confirmar</strong>
                <ol>
                  <li
                    v-for="question in callGuide.questions"
                    :key="question"
                  >
                    {{ question }}
                  </li>
                </ol>
                <small>{{ callGuide.rule }}</small>
                <button
                  class="secondary-action call-guide__copy"
                  type="button"
                  @click="copyCallGuide"
                >
                  Copiar guião
                </button>
                <p
                  v-if="callGuideStatus"
                  class="call-guide__status"
                  role="status"
                >
                  {{ callGuideStatus }}
                </p>
              </div>
              <form
                class="proposal-comparison"
                @submit.prevent="compareProposal"
              >
                <span>Comparar proposta recebida</span>
                <p>Compara a proposta declarada com o cenário em que o custo atual não muda. A proposta fica em análise: não é aceite, não altera o contrato e não é uma poupança confirmada.</p>
                <label for="proposal-monthly-cost">Mensalidade proposta</label>
                <div class="money-input">
                  <input
                    id="proposal-monthly-cost"
                    v-model="proposalMonthlyCost"
                    inputmode="decimal"
                    autocomplete="off"
                    placeholder="0,00"
                    :aria-invalid="Boolean(proposalError)"
                  ><span>EUR</span>
                </div>
                <label class="proposal-comparison__toggle">
                  <input
                    v-model="proposalHasLaterPrice"
                    type="checkbox"
                  >
                  <span>O preço aumenta durante a fidelização</span>
                </label>
                <template v-if="proposalHasLaterPrice">
                  <label for="proposal-introductory-months">Meses ao preço inicial</label>
                  <div class="proposal-comparison__months">
                    <input
                      id="proposal-introductory-months"
                      v-model="proposalIntroductoryMonths"
                      inputmode="numeric"
                      autocomplete="off"
                    ><span>meses</span>
                  </div>
                  <label for="proposal-later-monthly-cost">Mensalidade posterior</label>
                  <div class="money-input">
                    <input
                      id="proposal-later-monthly-cost"
                      v-model="proposalLaterMonthlyCost"
                      inputmode="decimal"
                      autocomplete="off"
                      placeholder="0,00"
                    ><span>EUR</span>
                  </div>
                </template>
                <label for="proposal-one-off-cost">Custo único</label>
                <div class="money-input">
                  <input
                    id="proposal-one-off-cost"
                    v-model="proposalOneOffCost"
                    inputmode="decimal"
                    autocomplete="off"
                  ><span>EUR</span>
                </div>
                <label for="proposal-commitment-months">Período comparado</label>
                <div class="proposal-comparison__months">
                  <input
                    id="proposal-commitment-months"
                    v-model="proposalCommitmentMonths"
                    inputmode="numeric"
                    autocomplete="off"
                  ><span>meses</span>
                </div>
                <button
                  class="secondary-action"
                  type="submit"
                >
                  Comparar custo total
                </button>
                <p
                  v-if="proposalError"
                  class="form-error"
                  role="alert"
                >
                  {{ proposalError }}
                </p>
                <div
                  v-if="proposalComparison"
                  class="proposal-comparison__result"
                  :class="`proposal-comparison__result--${proposalComparison.outcome}`"
                  role="status"
                >
                  <strong>Proposta em análise</strong>
                  <dl>
                    <div><dt>Atual, se não mudar</dt><dd>{{ money(proposalComparison.currentPeriodCents) }}</dd></div>
                    <div><dt>Custo no 1.º mês</dt><dd>{{ money(proposalComparison.firstMonthCents) }} · inclui o custo único</dd></div>
                    <div v-if="proposalComparison.introductoryMonths">
                      <dt>Preço inicial</dt><dd>{{ money(proposalComparison.proposedMonthlyCents) }} × {{ proposalComparison.introductoryMonths }} meses</dd>
                    </div>
                    <div v-if="proposalComparison.laterMonthlyCents !== undefined">
                      <dt>Preço posterior</dt><dd>{{ money(proposalComparison.laterMonthlyCents) }} × {{ proposalComparison.laterPeriodMonths }} meses</dd>
                    </div>
                    <div v-if="proposalComparison.laterAnnualCents !== undefined">
                      <dt>Custo anual depois da promoção</dt><dd>{{ money(proposalComparison.laterAnnualCents) }} · {{ proposalLaterAnnualDifference }}</dd>
                    </div>
                    <div>
                      <dt>Custo nos primeiros {{ proposalComparison.firstPeriodMonths }} meses</dt><dd>{{ money(proposalComparison.firstPeriodCents) }} · inclui o custo único · {{ proposalFirstPeriodDifference }}</dd>
                    </div>
                    <div><dt>Total no período</dt><dd>{{ money(proposalComparison.proposedPeriodCents) }}</dd></div>
                    <div><dt>Equivalente mensal da proposta</dt><dd>{{ money(proposalComparison.proposedMonthlyEquivalentCents) }}</dd></div>
                    <div v-if="proposalComparison.introductoryMonths === undefined">
                      <dt>Diferença recorrente mensal</dt><dd>{{ money(proposalComparison.recurringDifferenceCents) }}</dd>
                    </div>
                  </dl>
                  <p
                    v-if="proposalFirstMonthSignal"
                    class="proposal-comparison__later-signal"
                    :class="`proposal-comparison__later-signal--${proposalFirstMonthSignal.tone}`"
                  >
                    {{ proposalFirstMonthSignal.text }}
                  </p>
                  <p
                    v-if="proposalLaterPriceSignal"
                    class="proposal-comparison__later-signal"
                    :class="`proposal-comparison__later-signal--${proposalLaterPriceSignal.tone}`"
                  >
                    {{ proposalLaterPriceSignal.text }}
                  </p>
                  <b>{{ proposalOutcome }}</b>
                  <p><strong>Ponto de equilíbrio</strong> · {{ proposalBreakEven }}</p>
                  <p><strong>Limite para não pagar mais</strong> · {{ proposalPriceLimit }}</p>
                  <small>{{ proposalComparison.rule }}</small>
                </div>
              </form>
              <dl v-if="lifecycle!.decisionDates.length">
                <div
                  v-for="event in lifecycle!.decisionDates"
                  :key="`${event.kind}-${event.date}`"
                >
                  <dt>{{ event.label }}</dt>
                  <dd>{{ date(event.date) }}</dd>
                </div>
              </dl>
              <div
                v-else
                class="missing-decision-date"
              >
                Sem prazo declarado. Não assumimos uma data.
              </div>
              <button
                class="secondary-action agenda-edit"
                type="button"
                @click="openAgendaEditor"
              >
                Editar datas
              </button>
            </template>
            <form
              v-else
              class="agenda-form"
              @submit.prevent="saveAgenda"
            >
              <label for="commitment-end-date">Fim da fidelização</label>
              <input
                id="commitment-end-date"
                v-model="commitmentEndDate"
                type="date"
              >
              <label for="contract-end-date">Fim do contrato</label>
              <input
                id="contract-end-date"
                v-model="contractEndDate"
                type="date"
              >
              <template v-if="insuranceDetails">
                <label for="renewal-date">Próxima renovação</label>
                <input
                  id="renewal-date"
                  v-model="renewalDate"
                  type="date"
                >
              </template>
              <small>Deixa um campo vazio para manter o valor atual. As datas ficam no histórico como uma atualização manual.</small>
              <div class="observed-value__actions">
                <button
                  type="button"
                  class="text-action"
                  @click="agendaEditorOpen = false"
                >
                  Cancelar
                </button>
                <v-btn
                  type="submit"
                  color="primary"
                  :loading="savingAgenda"
                >
                  Guardar datas
                </v-btn>
              </div>
            </form>
            <p
              v-if="agendaError"
              class="form-error"
              role="alert"
            >
              {{ agendaError }}
            </p>
            <p
              v-if="agendaSuccess"
              class="form-success"
              role="status"
            >
              {{ agendaSuccess }}
            </p>
          </aside>

          <aside
            class="panel diagnosis"
            aria-labelledby="diagnosis-heading"
          >
            <div class="section-kicker">
              Diagnóstico
            </div>
            <div
              id="diagnosis-heading"
              class="health-indicator"
              :class="{ 'health-indicator--attention': openFindings.length }"
            >
              <span
                class="status-dot"
                aria-hidden="true"
              />
              {{ openFindings.length ? 'Atenção necessária' : 'Despesa saudável' }}
            </div>
            <p v-if="openFindings.length">
              Encontrámos {{ openFindings.length }} {{ openFindings.length === 1 ? 'oportunidade que merece' : 'oportunidades que merecem' }} a tua decisão.
            </p>
            <p v-else>
              Não existem recomendações abertas para esta despesa neste momento.
            </p>
            <v-btn
              v-if="openFindings.length"
              :to="`/findings?open=${openFindings[0].id}`"
              color="primary"
              block
            >
              Rever {{ openFindings.length === 1 ? 'recomendação' : 'recomendações' }}
            </v-btn>
            <v-btn
              v-else
              to="/findings"
              variant="outlined"
              block
            >
              Ver recomendações
            </v-btn>
          </aside>
        </div>
      </div>
    </template>
  </div>
</template>
