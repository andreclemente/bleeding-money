<script setup lang="ts">
import { calculateMoneyAtRisk, type HouseholdProfile, type HousingCategory, type MonthlySpendAmount, type MonthlySpendPeriod, type SpendCategory, type SpendScope } from '../domain/spending'

useHead({ title: 'Gastos mensais — Poupanças' })

interface Overview {
  profile: HouseholdProfile | null
  periods: MonthlySpendPeriod[]
  moneyAtRisk: { monthlyCents: number, annualCents: number, currency: 'EUR', isEstimate: true, basis: 'user_declared_targets' }
  comparisons: Array<{ category: SpendCategory, ownHistory: { kind: string, reason: string, evidence: { missingMonths?: number } } | null, anonymousCohort: { kind: string, reason: string } | null }>
  charts: {
    timeline: { state: 'empty' | 'insufficient_for_trend' | 'comparable_baseline', missingComparableMonths: number, comparableMedianCents: number | null, points: Array<{ month: string, supermarketCents: number, otherCents: number, housingCents: number, highlighted: boolean }> }
    breakdown: { month: string | null, totalCents: number, bars: Array<{ key: string, amountCents: number }> }
  }
}
interface CategoryForm { category: Exclude<SpendCategory, 'supermarket_total' | HousingCategory>, label: string, example: string, selected: boolean, amount: string, reduce: boolean, target: string, scope: SpendScope, fixedScope?: boolean }
interface HousingForm { category: HousingCategory, label: string, selected: boolean, amount: string }

const requestFetch = useRequestFetch()
const overview = ref<Overview>(await requestFetch<Overview>('/api/spending'))
const saving = ref(false)
const error = ref('')
const success = ref('')
const detailsOpen = ref(false)
const householdOpen = ref(false)
const analysisOpen = ref(false)
const periodHousehold = reactive({ adults: overview.value.profile?.adults || 2, dependents: overview.value.profile?.dependents || 0 })
const now = new Date()
const civilMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const month = ref(civilMonth(previousDate))
const maximumMonth = civilMonth(now)
const supermarket = reactive({ amount: '', reduce: false, target: '' })
const coverage = ref<'food_only' | 'includes_cleaning_hygiene' | 'unknown'>('unknown')
const amountBasis = ref<'statement_or_receipts' | 'calculated_estimate' | 'memory_estimate'>('memory_estimate')
const status = ref<'estimated' | 'complete'>('estimated')
const categories = reactive([
  { category: 'fast_food_takeaway', label: 'Fast food e comida para levar', example: 'Ex.: entregas, drive-through, refeições para levar', selected: false, amount: '', reduce: false, target: '', scope: 'outside_supermarket', fixedScope: true },
  { category: 'alcohol', label: 'Bebidas alcoólicas', example: 'Ex.: compras no supermercado ou fora dele', selected: false, amount: '', reduce: false, target: '', scope: 'supermarket' },
  { category: 'tobacco_nicotine', label: 'Tabaco e nicotina', example: 'Ex.: cigarros, tabaco aquecido ou vaping', selected: false, amount: '', reduce: false, target: '', scope: 'outside_supermarket' },
  { category: 'sweets_snacks_soft_drinks', label: 'Doces, snacks e refrigerantes', example: 'Ex.: bolachas, batatas fritas, chocolates e bebidas', selected: false, amount: '', reduce: false, target: '', scope: 'supermarket' },
  { category: 'other_discretionary', label: 'Outros gastos que escolheste rever', example: 'Ex.: pequenas compras não essenciais que não cabem acima', selected: false, amount: '', reduce: false, target: '', scope: 'outside_supermarket' }
]) as CategoryForm[]
const housingCosts = reactive([
  { category: 'rent', label: 'Renda', selected: false, amount: '' },
  { category: 'mortgage_payment', label: 'Prestação da casa', selected: false, amount: '' },
  { category: 'condominium_fee', label: 'Condomínio', selected: false, amount: '' }
]) as HousingForm[]

const cents = (value: string) => {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Usa montantes em EUR com, no máximo, duas casas decimais.')
  return Math.round(Number(normalized) * 100)
}
const eur = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', currencyDisplay: 'code' }).format(value / 100)
const isCivilMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
const monthLabel = (value: string) => isCivilMonth(value)
  ? new Intl.DateTimeFormat('pt-PT', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
  : 'mês por escolher'
const amountDraft = computed(() => {
  const amounts: Array<Omit<MonthlySpendAmount, 'id' | 'periodId'>> = []
  if (supermarket.amount) amounts.push({ category: 'supermarket_total', scope: 'supermarket', amountCents: cents(supermarket.amount), trackingIntent: supermarket.reduce ? 'reduce' : 'track_only', ...(supermarket.reduce && supermarket.target ? { userTargetCents: cents(supermarket.target) } : {}) })
  for (const item of categories.filter(item => item.selected && item.amount)) amounts.push({ category: item.category, scope: item.scope, amountCents: cents(item.amount), trackingIntent: item.reduce ? 'reduce' : 'track_only', ...(item.reduce && item.target ? { userTargetCents: cents(item.target) } : {}) })
  for (const item of housingCosts.filter(item => item.selected && item.amount)) amounts.push({ category: item.category, scope: 'housing', amountCents: cents(item.amount), trackingIntent: 'track_only' })
  return amounts
})
const riskPreview = computed(() => {
  try {
    return calculateMoneyAtRisk(amountDraft.value)
  } catch {
    return { monthlyCents: 0, annualCents: 0, components: [], isEstimate: true as const, basis: 'user_declared_targets' as const }
  }
})
const existingPeriod = computed(() => overview.value.periods.find((item: MonthlySpendPeriod) => item.month.slice(0, 7) === month.value))
const timelineMaximum = computed(() => Math.max(1, ...overview.value.charts.timeline.points.map((item: Overview['charts']['timeline']['points'][number]) => item.supermarketCents + item.otherCents + item.housingCents)))
const breakdownMaximum = computed(() => Math.max(1, ...overview.value.charts.breakdown.bars.map((item: { amountCents: number }) => item.amountCents)))
const visibleComparisons = computed(() => overview.value.comparisons.filter((comparison: Overview['comparisons'][number]) => comparison.category === 'supermarket_total' || overview.value.periods[0]?.amounts.some((amount: MonthlySpendAmount) => amount.category === comparison.category)))
const categoryLabels: Record<string, string> = {
  supermarket_total: 'Total de supermercado',
  supermarket_remainder: 'Restante supermercado',
  fast_food_takeaway: 'Fast food e comida para levar',
  alcohol: 'Bebidas alcoólicas',
  tobacco_nicotine: 'Tabaco e nicotina',
  sweets_snacks_soft_drinks: 'Doces, snacks e refrigerantes',
  other_discretionary: 'Outros gastos revistos',
  rent: 'Renda',
  mortgage_payment: 'Prestação da casa',
  condominium_fee: 'Condomínio'
}

const resetForm = () => {
  periodHousehold.adults = overview.value.profile?.adults || 2
  periodHousehold.dependents = overview.value.profile?.dependents || 0
  supermarket.amount = ''
  supermarket.reduce = false
  supermarket.target = ''
  coverage.value = 'unknown'
  amountBasis.value = 'memory_estimate'
  status.value = 'estimated'
  for (const item of categories) Object.assign(item, { selected: false, amount: '', reduce: false, target: '' })
  for (const item of housingCosts) Object.assign(item, { selected: false, amount: '' })
}
const loadMonth = (value: string, shouldScroll = true) => {
  month.value = value.slice(0, 7)
  resetForm()
  detailsOpen.value = false
  householdOpen.value = false
  const period = overview.value.periods.find((item: MonthlySpendPeriod) => item.month.slice(0, 7) === month.value)
  if (!period) return
  periodHousehold.adults = period.adults
  periodHousehold.dependents = period.dependents
  coverage.value = period.supermarketCoverage
  amountBasis.value = period.amountBasis
  status.value = period.status
  for (const amount of period.amounts) {
    const form = amount.category === 'supermarket_total' ? supermarket : categories.find(item => item.category === amount.category) || housingCosts.find(item => item.category === amount.category)
    if (!form) continue
    if ('scope' in form) {
      form.selected = true
      form.scope = amount.scope
    }
    if ('selected' in form) form.selected = true
    form.amount = String(amount.amountCents / 100).replace('.', ',')
    if ('reduce' in form) {
      form.reduce = amount.trackingIntent === 'reduce'
      form.target = amount.userTargetCents === undefined ? '' : String(amount.userTargetCents / 100).replace('.', ',')
    }
  }
  if (shouldScroll && import.meta.client) document.getElementById('monthly-entry')?.scrollIntoView({ behavior: 'smooth' })
}
loadMonth(month.value, false)
const addPreviousMonth = () => {
  const oldest = overview.value.periods.at(-1)?.month
  const base = oldest ? new Date(`${oldest}T00:00:00Z`) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  base.setUTCMonth(base.getUTCMonth() - 1)
  loadMonth(base.toISOString().slice(0, 7))
}
const supermarketFor = (period: MonthlySpendPeriod) => period.amounts.find(item => item.category === 'supermarket_total')?.amountCents || 0
const save = async () => {
  error.value = ''
  success.value = ''
  saving.value = true
  const updating = Boolean(existingPeriod.value)
  try {
    if (!supermarket.amount) throw new Error('Indica quanto gastaste no supermercado.')
    await requestFetch('/api/spending/periods', {
      method: 'POST',
      body: { month: month.value, adults: periodHousehold.adults, dependents: periodHousehold.dependents, status: status.value, supermarketCoverage: coverage.value, amountBasis: amountBasis.value, amounts: amountDraft.value }
    })
    overview.value = await requestFetch<Overview>('/api/spending')
    success.value = updating ? 'Mês atualizado sem criar duplicados.' : 'Mês guardado no teu histórico.'
  } catch (caught) {
    error.value = (caught as { data?: { statusMessage?: string }, message?: string }).data?.statusMessage || (caught as Error).message
  } finally { saving.value = false }
}
</script>

<template>
  <div class="spending-page">
    <header class="spending-hero">
      <div>
        <div class="section-kicker">
          Radiografia mensal
        </div>
        <h1>Para onde foi o dinheiro este mês?</h1>
        <p><strong>Só precisas de um número:</strong> o total que saiu no supermercado. O resto é opcional e aparece apenas quando quiseres aprofundar.</p>
      </div>
      <button
        class="secondary-action"
        type="button"
        @click="addPreviousMonth"
      >
        Adicionar o mês anterior
      </button>
    </header>

    <section
      id="monthly-entry"
      class="spending-entry panel"
      aria-labelledby="entry-title"
    >
      <div class="entry-heading">
        <div>
          <span class="step-number">01</span>
          <h2 id="entry-title">
            Quanto gastaste no supermercado?
          </h2>
          <p>Consulta o total no extrato da conta ou faz uma estimativa. Não precisas de recordar o que compraste.</p>
        </div>
        <label class="month-control">Mês civil
          <input
            v-model="month"
            type="month"
            :max="maximumMonth"
            @change="loadMonth(month)"
          >
        </label>
      </div>
      <button
        class="text-action household-toggle"
        type="button"
        :aria-expanded="householdOpen"
        aria-controls="household-fields"
        @click="householdOpen = !householdOpen"
      >
        {{ householdOpen ? 'Ocultar agregado' : `Agregado: ${periodHousehold.adults} adulto(s), ${periodHousehold.dependents} dependente(s) · alterar` }}
      </button>
      <div
        v-if="householdOpen"
        id="household-fields"
        class="household-row"
      >
        <label for="period-adults">Adultos neste mês<input
          id="period-adults"
          v-model.number="periodHousehold.adults"
          type="number"
          min="1"
          max="20"
          :aria-invalid="Boolean(error)"
          aria-describedby="household-help form-error"
        ></label>
        <label for="period-dependents">Dependentes neste mês<input
          id="period-dependents"
          v-model.number="periodHousehold.dependents"
          type="number"
          min="0"
          max="20"
          :aria-invalid="Boolean(error)"
          aria-describedby="household-help form-error"
        ></label>
        <p id="household-help">
          Só precisas de alterar isto quando a composição da família era diferente no mês escolhido.
        </p>
      </div>
      <div class="question-card question-card--primary">
        <label for="supermarket-amount">Total de supermercado em EUR</label>
        <div class="money-input">
          <input
            id="supermarket-amount"
            v-model="supermarket.amount"
            inputmode="decimal"
            placeholder="Ex.: 480,00"
            :aria-invalid="Boolean(error)"
            aria-describedby="supermarket-help form-error"
          ><span>EUR</span>
        </div>
        <p id="supermarket-help">
          Inclui tudo pago no supermercado. É suficiente para começar a encontrar aumentos ao longo dos meses.
        </p>
      </div>
      <p
        v-if="error"
        id="form-error"
        class="form-error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-if="success"
        class="form-success"
        role="status"
      >
        {{ success }}
      </p>
      <div class="entry-actions quick-entry-actions">
        <span>{{ existingPeriod ? `A editar ${monthLabel(month)}` : `Novo registo para ${monthLabel(month)}` }}</span><v-btn
          color="primary"
          size="large"
          :loading="saving"
          @click="save"
        >
          {{ existingPeriod ? 'Atualizar este mês' : 'Guardar este mês' }}
        </v-btn>
      </div>
      <button
        class="details-toggle"
        type="button"
        :aria-expanded="detailsOpen"
        aria-controls="optional-spending-details"
        @click="detailsOpen = !detailsOpen"
      >
        <span><strong>{{ detailsOpen ? 'Ocultar perguntas opcionais' : 'Quero perceber melhor este mês' }}</strong><small>Opcional · abre categorias e limites apenas se te forem úteis</small></span><b aria-hidden="true">{{ detailsOpen ? '−' : '+' }}</b>
      </button>
      <div
        v-if="detailsOpen"
        id="optional-spending-details"
        class="spending-details"
      >
        <div class="question-card">
          <h3>Queres testar um limite para o supermercado?</h3>
          <p>Não tens de saber qual é o valor “certo”. Este é apenas um cenário escolhido por ti.</p>
          <label class="reduce-choice"><input
            v-model="supermarket.reduce"
            type="checkbox"
          > Sim, quero experimentar um limite mensal</label>
          <div
            v-if="supermarket.reduce"
            class="target-field"
          >
            <label for="supermarket-target">Limite a testar</label>
            <div class="money-input">
              <input
                id="supermarket-target"
                v-model="supermarket.target"
                inputmode="decimal"
                placeholder="Ex.: 440,00"
              ><span>EUR</span>
            </div>
          </div>
        </div>

        <div class="entry-heading entry-heading--categories">
          <div><span class="step-number">02</span><h2>Que parcelas queres perceber melhor?</h2><p>Seleciona apenas as que consegues estimar. Podes deixar as restantes de fora.</p></div>
        </div>
        <div class="category-questions">
          <article
            v-for="item in categories"
            :key="item.category"
            class="category-question"
            :class="{ 'category-question--active': item.selected }"
          >
            <label class="category-select"><input
              v-model="item.selected"
              type="checkbox"
            ><span><strong>{{ item.label }}</strong><small>{{ item.example }}</small></span></label>
            <template v-if="item.selected">
              <div class="category-fields">
                <label>Montante em EUR<div class="money-input"><input
                  v-model="item.amount"
                  inputmode="decimal"
                  placeholder="0,00"
                ><span>EUR</span></div></label>
                <label v-if="!item.fixedScope">Onde ocorreu?<select v-model="item.scope"><option value="supermarket">Dentro do supermercado</option><option value="outside_supermarket">Fora do supermercado</option></select></label>
              </div>
              <label class="reduce-choice"><input
                v-model="item.reduce"
                type="checkbox"
              > Quero tentar reduzir esta parcela</label>
              <label
                v-if="item.reduce"
                class="target-field"
              >Limite escolhido por ti<div class="money-input"><input
                v-model="item.target"
                inputmode="decimal"
                placeholder="0,00"
              ><span>EUR</span></div></label>
            </template>
          </article>
        </div>

        <div class="entry-heading entry-heading--categories">
          <div><span class="step-number">Contexto</span><h2>Custos de habitação</h2><p>Renda, prestação e condomínio servem de contexto para o custo real do agregado. Não são tratados como desperdício, comparados com outras famílias nem usados para estimar poupança.</p></div>
        </div>
        <div class="category-questions housing-questions">
          <article
            v-for="item in housingCosts"
            :key="item.category"
            class="category-question"
            :class="{ 'category-question--active': item.selected }"
          >
            <label class="category-select"><input
              v-model="item.selected"
              type="checkbox"
            ><span><strong>{{ item.label }}</strong><small>Opcional · contexto factual deste mês</small></span></label>
            <label
              v-if="item.selected"
              class="target-field"
            >Montante mensal em EUR<div class="money-input"><input
              v-model="item.amount"
              inputmode="decimal"
              placeholder="0,00"
            ><span>EUR</span></div></label>
          </article>
        </div>

        <div class="evidence-options">
          <label>O total vem de<select v-model="amountBasis"><option value="statement_or_receipts">Extrato ou talões</option><option value="calculated_estimate">Estimativa calculada</option><option value="memory_estimate">Estimativa de memória</option></select></label>
          <label>O supermercado inclui<select v-model="coverage"><option value="food_only">Só alimentação</option><option value="includes_cleaning_hygiene">Alimentação, limpeza e higiene</option><option value="unknown">Não tenho a certeza</option></select></label>
          <label>Estado do mês<select v-model="status"><option value="estimated">Estimado</option><option value="complete">Completo</option></select></label>
        </div>

        <aside
          v-if="riskPreview.monthlyCents > 0"
          class="risk-preview"
          aria-live="polite"
        >
          <span>Cenário opcional</span>
          <strong>{{ eur(riskPreview.monthlyCents) }}</strong>
          <p>Baseado apenas nos limites que escolheste. Não é uma previsão nem uma garantia de poupança.</p>
          <small>{{ eur(riskPreview.monthlyCents) }} × 12 = {{ eur(riskPreview.annualCents) }} por ano, se cumprires todos os limites.</small>
        </aside>
        <div class="entry-actions">
          <span>Guarda novamente para incluir estas respostas opcionais.</span><v-btn
            color="primary"
            :loading="saving"
            @click="save"
          >
            Guardar detalhes
          </v-btn>
        </div>
      </div>
    </section>

    <template v-if="overview.periods.length">
      <section
        class="spending-insights panel"
        aria-labelledby="insights-title"
      >
        <div class="chart-heading">
          <div>
            <span class="step-number">03</span><h2 id="insights-title">
              O que mostram os dados guardados?
            </h2>
          </div>
        </div>
        <button
          class="details-toggle"
          type="button"
          :aria-expanded="analysisOpen"
          aria-controls="full-spending-analysis"
          @click="analysisOpen = !analysisOpen"
        >
          <span><strong>{{ analysisOpen ? 'Ocultar análise detalhada' : 'Ver o que a análise encontrou' }}</strong><small>Histórico próprio e, quando existir evidência, agregados semelhantes</small></span><b aria-hidden="true">{{ analysisOpen ? '−' : '+' }}</b>
        </button>
        <div
          v-if="analysisOpen"
          id="full-spending-analysis"
          class="spending-analysis-detail"
        >
          <div class="saved-total">
            <span>Total do mês mais recente</span>
            <strong>{{ eur(overview.charts.breakdown.totalCents) }}</strong>
            <p>Se este valor se repetisse durante 12 meses, seriam {{ eur(overview.charts.breakdown.totalCents * 12) }}. Isto descreve a dimensão do gasto; não assume que é desperdício.</p>
          </div>
          <aside
            v-if="overview.moneyAtRisk.monthlyCents > 0"
            class="risk-preview risk-preview--persisted"
          >
            <span>Cenário guardado — dinheiro em risco</span>
            <strong>{{ eur(overview.moneyAtRisk.monthlyCents) }} por mês</strong>
            <p>{{ eur(overview.moneyAtRisk.annualCents) }} por ano apenas se cumprires todos os limites que declaraste. Não é uma previsão nem uma garantia de poupança.</p>
          </aside>
          <div class="comparison-list">
            <article
              v-for="comparison in visibleComparisons"
              :key="comparison.category"
              class="comparison-card"
            >
              <h3>{{ categoryLabels[comparison.category] || comparison.category }}</h3>
              <strong>Histórico próprio</strong>
              <p>{{ comparison.ownHistory?.reason || 'Os meses comparáveis não mostram um aumento acima dos limiares definidos.' }}</p>
              <strong>Agregados semelhantes</strong>
              <p v-if="comparison.ownHistory?.kind !== 'CHECK_UNAVAILABLE'">
                Não consultado: o histórico próprio tinha dados suficientes.
              </p>
              <p v-else>
                {{ comparison.anonymousCohort?.reason || 'A comparação anónima exata disponível não assinalou um valor acima do limiar definido.' }}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        v-if="analysisOpen"
        class="spending-chart panel"
        aria-labelledby="evolution-title"
      >
        <div class="chart-heading">
          <div>
            <span class="step-number">04</span><h2 id="evolution-title">
              Como evoluíram os teus gastos?
            </h2>
          </div><button
            v-if="overview.charts.timeline.missingComparableMonths"
            class="text-action"
            type="button"
            @click="addPreviousMonth"
          >
            Adicionar o mês anterior
          </button>
        </div>
        <p
          v-if="overview.charts.timeline.state !== 'comparable_baseline'"
          class="chart-state"
        >
          Há {{ overview.charts.timeline.points.length }} {{ overview.charts.timeline.points.length === 1 ? 'mês registado' : 'meses registados' }}. Faltam {{ overview.charts.timeline.missingComparableMonths }} meses comparáveis; ainda não apresentamos uma tendência.
        </p>
        <p
          v-else
          class="chart-state"
        >
          Base comparável: mediana de supermercado dos meses anteriores, {{ eur(overview.charts.timeline.comparableMedianCents || 0) }}.
        </p>
        <div
          class="timeline-chart"
          role="img"
          :aria-label="`Evolução cronológica de ${overview.charts.timeline.points.length} meses. Os valores completos estão listados abaixo.`"
        >
          <div
            v-for="point in overview.charts.timeline.points"
            :key="point.month"
            class="timeline-column"
          >
            <div
              v-if="point.supermarketCents + point.otherCents + point.housingCents > 0"
              class="column-stack"
              :style="{ height: `${(point.supermarketCents + point.otherCents + point.housingCents) / timelineMaximum * 100}%` }"
            >
              <span
                class="column-housing"
                :style="{ flexGrow: point.housingCents }"
              />
              <span
                class="column-other"
                :style="{ flexGrow: point.otherCents }"
              /><span
                class="column-market"
                :style="{ flexGrow: point.supermarketCents }"
              />
            </div>
            <strong>{{ monthLabel(point.month) }}</strong><small>{{ eur(point.supermarketCents + point.otherCents + point.housingCents) }}<span v-if="point.highlighted"> · mais recente</span></small>
          </div>
        </div>
        <ul class="accessible-values">
          <li
            v-for="point in overview.charts.timeline.points"
            :key="`value-${point.month}`"
          >
            <strong>{{ monthLabel(point.month) }}</strong>: supermercado {{ eur(point.supermarketCents) }}; outros gastos {{ eur(point.otherCents) }}; habitação {{ eur(point.housingCents) }}<span v-if="point.highlighted">; mês mais recente</span>.
          </li>
        </ul>
      </section>

      <section
        v-if="analysisOpen"
        class="spending-chart panel"
        aria-labelledby="breakdown-title"
      >
        <div class="chart-heading">
          <div>
            <span class="step-number">05</span><h2 id="breakdown-title">
              Onde se concentrou o gasto em {{ monthLabel(overview.charts.breakdown.month || month) }}?
            </h2>
          </div><button
            class="text-action"
            type="button"
            @click="loadMonth(overview.charts.breakdown.month || month)"
          >
            Rever categorias
          </button>
        </div>
        <p class="chart-state">
          Total sem dupla contagem: {{ eur(overview.charts.breakdown.totalCents) }}. As barras mostram montantes, não juízos sobre o que é excessivo.
        </p>
        <ol class="breakdown-bars">
          <li
            v-for="bar in overview.charts.breakdown.bars"
            :key="bar.key"
          >
            <div class="bar-label">
              <strong>{{ categoryLabels[bar.key] || bar.key }}</strong><span>{{ eur(bar.amountCents) }}</span>
            </div><div
              class="bar-track"
              aria-hidden="true"
            >
              <span :style="{ width: `${bar.amountCents / breakdownMaximum * 100}%` }" />
            </div>
          </li>
        </ol>
      </section>

      <section
        class="history-section"
        aria-labelledby="history-title"
      >
        <div class="chart-heading">
          <div>
            <span class="step-number">06</span><h2 id="history-title">
              Histórico mensal
            </h2><p>Mais recente primeiro. Podes corrigir qualquer mês sem criar um duplicado.</p>
          </div>
        </div>
        <div class="history-list panel">
          <button
            v-for="period in overview.periods"
            :key="period.id"
            type="button"
            @click="loadMonth(period.month)"
          >
            <span><strong>{{ monthLabel(period.month) }}</strong><small>{{ period.status === 'complete' ? 'Completo' : 'Estimativa' }} · {{ period.amountBasis === 'statement_or_receipts' ? 'extrato ou talões' : 'valor estimado' }}</small></span><span>{{ eur(supermarketFor(period)) }} supermercado</span>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
