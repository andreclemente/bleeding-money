import type { ExpenseSnapshot, RecurringExpense } from './types'

export type ExpenseDecisionDate = {
  kind: 'commitment' | 'renewal' | 'contract'
  label: string
  date: string
}

export type ExpenseLifecycleObservation = {
  snapshot: ExpenseSnapshot
  change: { cents: number, basisPoints: number } | null
}

export type ExpenseLifecycle = {
  annualEquivalentCents: number
  observations: ExpenseLifecycleObservation[]
  observedChange: {
    monthlyCents: number
    annualCents: number
    basisPoints: number
    fromDate: string
    toDate: string
  } | null
  decisionDates: ExpenseDecisionDate[]
}

export type ContractDecisionSignal = {
  event: ExpenseDecisionDate
  timing: 'today' | 'soon' | 'upcoming' | 'passed'
  days: number
  timingLabel: string
  action: string
}

export type ContractDecisionDossier = {
  title: string
  evidence: string[]
  rule: string
}

export type ContractCallGuide = {
  currentMonthlyCents: number
  annualEquivalentCents: number
  nextDeclaredDate: ExpenseDecisionDate | null
  questions: string[]
  rule: string
}

export type ContractProposalComparison = {
  currentMonthlyCents: number
  proposedMonthlyCents: number
  oneOffCents: number
  commitmentMonths: number
  currentPeriodCents: number
  proposedPeriodCents: number
  firstMonthCents: number
  firstMonthDifferenceCents: number
  proposedMonthlyEquivalentCents: number
  recurringDifferenceCents: number
  breakEvenMonth: number | null
  introductoryMonths?: number
  laterMonthlyCents?: number
  laterPeriodMonths?: number
  laterRecurringDifferenceCents?: number
  laterAnnualCents?: number
  laterAnnualDifferenceCents?: number
  accumulatedAdvantageAtPromotionEndCents?: number
  accumulatedAdvantageExhaustedMonth?: number | null
  firstPeriodMonths: number
  firstPeriodCents: number
  firstPeriodDifferenceCents: number
  maximumMonthlyCentsForNoIncrease: number | null
  periodDifferenceCents: number
  outcome: 'lower' | 'same' | 'higher'
  rule: string
}

export type ContractProposalDecision = {
  tone: 'stop' | 'negotiate' | 'verify'
  title: string
  action: string
  rule: string
}

export type InsuranceProposalReadiness = {
  ready: boolean
  missing: string[]
  action: string
  rule: string
}

const civilDay = (value: string) => Date.parse(`${value}T00:00:00.000Z`)
const dayMs = 86_400_000

const actionFor = (event: ExpenseDecisionDate) => {
  if (event.kind === 'renewal') return 'Confirma as condições de renovação junto do fornecedor.'
  if (event.kind === 'commitment') return 'Confirma se já podes renegociar ou mudar de fornecedor.'
  return 'Confirma as condições de termo ou continuação do contrato.'
}

const decisionEvidence: Record<RecurringExpense['category'], string[]> = {
  electricity: [
    'Última fatura com o valor atual e a tarifa aplicada',
    'Potência contratada e consumo anual indicado na fatura',
    'Condições do contrato e data de termo, se estiver declarada'
  ],
  telecom: [
    'Última fatura ou extrato com o valor atual',
    'Resumo do contrato com fidelização e serviços incluídos',
    'Linhas, equipamentos e extras que aparecem na fatura'
  ],
  bank: [
    'Último extrato com as comissões cobradas',
    'Preçário aplicável à conta e aos cartões',
    'Serviços associados que condicionam a comissão'
  ],
  subscription: [
    'Última cobrança com o valor atual',
    'Plano e funcionalidades atualmente incluídas',
    'Utilização recente declarada antes de decidir manter ou cancelar'
  ],
  gym: [
    'Último recibo com o valor atual',
    'Condições de cancelamento e fidelização',
    'Serviços incluídos na mensalidade atual'
  ],
  insurance: [
    'Último recibo ou aviso com o prémio atual',
    'Condições particulares com capitais, coberturas, exclusões e franquias',
    'Aviso de renovação, se já foi recebido'
  ]
}

const callQuestions: Record<RecurringExpense['category'], string[]> = {
  electricity: [
    'Qual é o preço final da energia e da potência contratada?',
    'Que descontos existem, durante quanto tempo e com que condições?',
    'Existe fidelização, serviço adicional ou penalização de saída?'
  ],
  telecom: [
    'Qual é o preço final mensal, já com equipamentos e extras?',
    'Que serviços, linhas e velocidades ficam incluídos?',
    'Existe nova fidelização e qual é a data exata de termo?'
  ],
  bank: [
    'Qual é a comissão total mensal e anual da conta?',
    'Que cartões, transferências e serviços ficam incluídos?',
    'Que condições podem alterar ou eliminar a comissão?'
  ],
  subscription: [
    'Qual é o preço final do plano e quando volta a ser cobrado?',
    'Que funcionalidades ficam incluídas ou são retiradas?',
    'Como e até quando posso cancelar sem nova cobrança?'
  ],
  gym: [
    'Qual é o preço final mensal e que serviços inclui?',
    'Existe fidelização ou taxa de cancelamento?',
    'Qual é o procedimento e o prazo exato para cancelar?'
  ],
  insurance: [
    'Qual é o prémio final e a periodicidade de pagamento?',
    'Que capitais, coberturas, exclusões e franquias ficam contratados?',
    'Qual é a data de renovação e o prazo para alterar ou denunciar?'
  ]
}

export const buildContractDecisionDossier = (expense: RecurringExpense): ContractDecisionDossier => ({
  title: 'Leva estes factos para a conversa',
  evidence: structuredClone(decisionEvidence[expense.category]),
  rule: 'Serve para confirmar condições. Não estima nem confirma poupanças.'
})

export const buildContractCallGuide = (expense: RecurringExpense, decisionDates: ExpenseDecisionDate[]): ContractCallGuide => ({
  currentMonthlyCents: expense.monthlyCostCents,
  annualEquivalentCents: expense.monthlyCostCents * 12,
  nextDeclaredDate: decisionDates.length ? structuredClone([...decisionDates].sort((left, right) => left.date.localeCompare(right.date))[0]!) : null,
  questions: structuredClone(callQuestions[expense.category]),
  rule: 'Regista a resposta como proposta. Só um novo custo aceite e observado confirma poupança.'
})

export const buildInsuranceProposalReadiness = (input: {
  equivalentInsuredScope: boolean
  comparableCoverage: boolean
  comparableDeductibles: boolean
}): InsuranceProposalReadiness => {
  const checks = [
    {
      confirmed: input.equivalentInsuredScope,
      label: 'Capitais e pessoas ou bens cobertos equivalentes',
      action: 'Confirma que os capitais e as pessoas ou bens cobertos são equivalentes.'
    },
    {
      confirmed: input.comparableCoverage,
      label: 'Coberturas e exclusões comparadas',
      action: 'Compara as coberturas e exclusões da proposta com o contrato atual.'
    },
    {
      confirmed: input.comparableDeductibles,
      label: 'Franquias e condições de pagamento comparadas',
      action: 'Compara as franquias e as condições de pagamento da proposta.'
    }
  ]
  const missing = checks.filter(check => !check.confirmed)

  if (missing.length) {
    return {
      ready: false,
      missing: missing.map(check => check.label),
      action: missing[0]!.action,
      rule: 'Sem condições suficientemente equivalentes, não calculamos uma possível diferença de custo.'
    }
  }

  return {
    ready: true,
    missing: [],
    action: 'As condições essenciais foram declaradas como comparáveis; já podes comparar os custos.',
    rule: 'A comparação continua condicional e não confirma poupança.'
  }
}

export const compareContractProposal = (input: {
  currentMonthlyCents: number
  proposedMonthlyCents: number
  oneOffCents: number
  commitmentMonths: number
  introductoryMonths?: number
  laterMonthlyCents?: number
}): ContractProposalComparison => {
  for (const value of [input.currentMonthlyCents, input.proposedMonthlyCents, input.oneOffCents, input.laterMonthlyCents].filter(value => value !== undefined)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Valor monetário inválido.')
  }
  if (!Number.isSafeInteger(input.commitmentMonths) || input.commitmentMonths < 1 || input.commitmentMonths > 120) throw new Error('Duração inválida.')

  const hasPhasedPrice = input.introductoryMonths !== undefined || input.laterMonthlyCents !== undefined
  if (hasPhasedPrice && input.laterMonthlyCents === undefined) throw new Error('Indica o preço posterior à promoção.')
  if (hasPhasedPrice && (!Number.isSafeInteger(input.introductoryMonths) || input.introductoryMonths! < 1 || input.introductoryMonths! >= input.commitmentMonths)) {
    throw new Error('Duração promocional inválida.')
  }

  const currentPeriodCents = input.currentMonthlyCents * input.commitmentMonths
  const laterPeriodMonths = hasPhasedPrice ? input.commitmentMonths - input.introductoryMonths! : 0
  const proposedRecurringPeriodCents = hasPhasedPrice
    ? input.proposedMonthlyCents * input.introductoryMonths! + input.laterMonthlyCents! * laterPeriodMonths
    : input.proposedMonthlyCents * input.commitmentMonths
  const proposedPeriodCents = proposedRecurringPeriodCents + input.oneOffCents
  if (!Number.isSafeInteger(currentPeriodCents) || !Number.isSafeInteger(proposedPeriodCents)) throw new Error('Valor monetário inválido.')
  const firstMonthCents = input.proposedMonthlyCents + input.oneOffCents
  const firstMonthDifferenceCents = input.currentMonthlyCents - firstMonthCents
  if (!Number.isSafeInteger(firstMonthCents) || !Number.isSafeInteger(firstMonthDifferenceCents)) throw new Error('Valor monetário inválido.')
  const recurringDifferenceCents = input.currentMonthlyCents - input.proposedMonthlyCents
  if (!Number.isSafeInteger(recurringDifferenceCents)) throw new Error('Valor monetário inválido.')
  const laterRecurringDifferenceCents = hasPhasedPrice ? input.currentMonthlyCents - input.laterMonthlyCents! : undefined
  if (laterRecurringDifferenceCents !== undefined && !Number.isSafeInteger(laterRecurringDifferenceCents)) throw new Error('Valor monetário inválido.')
  const laterAnnualCents = hasPhasedPrice ? input.laterMonthlyCents! * 12 : undefined
  const laterAnnualDifferenceCents = hasPhasedPrice ? input.currentMonthlyCents * 12 - laterAnnualCents! : undefined
  if ((laterAnnualCents !== undefined && !Number.isSafeInteger(laterAnnualCents)) || (laterAnnualDifferenceCents !== undefined && !Number.isSafeInteger(laterAnnualDifferenceCents))) {
    throw new Error('Valor monetário inválido.')
  }
  const accumulatedAdvantageAtPromotionEndCents = hasPhasedPrice
    ? (input.currentMonthlyCents - input.proposedMonthlyCents) * input.introductoryMonths! - input.oneOffCents
    : undefined
  if (accumulatedAdvantageAtPromotionEndCents !== undefined && !Number.isSafeInteger(accumulatedAdvantageAtPromotionEndCents)) throw new Error('Valor monetário inválido.')
  const firstPeriodMonths = Math.min(12, input.commitmentMonths)
  const firstIntroductoryMonths = hasPhasedPrice ? Math.min(input.introductoryMonths!, firstPeriodMonths) : firstPeriodMonths
  const firstLaterMonths = firstPeriodMonths - firstIntroductoryMonths
  const firstPeriodCents = input.oneOffCents
    + input.proposedMonthlyCents * firstIntroductoryMonths
    + (hasPhasedPrice ? input.laterMonthlyCents! * firstLaterMonths : 0)
  const firstPeriodDifferenceCents = input.currentMonthlyCents * firstPeriodMonths - firstPeriodCents
  if (!Number.isSafeInteger(firstPeriodCents) || !Number.isSafeInteger(firstPeriodDifferenceCents)) throw new Error('Valor monetário inválido.')
  const priceLimitAvailableCents = hasPhasedPrice
    ? currentPeriodCents - input.oneOffCents - input.proposedMonthlyCents * input.introductoryMonths!
    : currentPeriodCents - input.oneOffCents
  if (!Number.isSafeInteger(priceLimitAvailableCents)) throw new Error('Valor monetário inválido.')
  const priceLimitMonths = hasPhasedPrice ? laterPeriodMonths : input.commitmentMonths
  const maximumMonthlyCentsForNoIncrease = priceLimitAvailableCents < 0
    ? null
    : Math.floor(priceLimitAvailableCents / priceLimitMonths)
  const periodDifferenceCents = currentPeriodCents - proposedPeriodCents
  let breakEvenMonth: number | null = input.oneOffCents === 0 && input.proposedMonthlyCents < input.currentMonthlyCents ? 0 : null
  let accumulatedAdvantageExhaustedMonth: number | null = null
  let accumulatedDifferenceCents = -input.oneOffCents
  for (let month = 1; breakEvenMonth === null && month <= input.commitmentMonths; month += 1) {
    const proposedMonthlyCents = hasPhasedPrice && month > input.introductoryMonths! ? input.laterMonthlyCents! : input.proposedMonthlyCents
    accumulatedDifferenceCents += input.currentMonthlyCents - proposedMonthlyCents
    if (accumulatedDifferenceCents >= 0 && (input.oneOffCents > 0 || accumulatedDifferenceCents > 0)) breakEvenMonth = month
  }
  if (hasPhasedPrice && laterRecurringDifferenceCents! < 0 && accumulatedAdvantageAtPromotionEndCents! > 0) {
    accumulatedDifferenceCents = accumulatedAdvantageAtPromotionEndCents!
    for (let month = input.introductoryMonths! + 1; accumulatedAdvantageExhaustedMonth === null && month <= input.commitmentMonths; month += 1) {
      accumulatedDifferenceCents += laterRecurringDifferenceCents!
      if (accumulatedDifferenceCents <= 0) accumulatedAdvantageExhaustedMonth = month
    }
  }

  return {
    ...input,
    ...(hasPhasedPrice ? { laterPeriodMonths, laterRecurringDifferenceCents, laterAnnualCents, laterAnnualDifferenceCents, accumulatedAdvantageAtPromotionEndCents, accumulatedAdvantageExhaustedMonth } : {}),
    currentPeriodCents,
    proposedPeriodCents,
    firstMonthCents,
    firstMonthDifferenceCents,
    firstPeriodMonths,
    firstPeriodCents,
    firstPeriodDifferenceCents,
    proposedMonthlyEquivalentCents: Math.round(proposedPeriodCents / input.commitmentMonths),
    recurringDifferenceCents,
    maximumMonthlyCentsForNoIncrease,
    breakEvenMonth,
    periodDifferenceCents,
    outcome: periodDifferenceCents > 0 ? 'lower' : periodDifferenceCents < 0 ? 'higher' : 'same',
    rule: 'Comparação condicional: assume o custo atual constante durante o período; não confirma poupança.'
  }
}

const euros = (cents: number) => {
  const absolute = Math.abs(cents)
  return `${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}\u00a0€`
}

export const buildContractProposalDecision = (comparison: ContractProposalComparison): ContractProposalDecision => {
  if (comparison.laterRecurringDifferenceCents !== undefined && comparison.laterRecurringDifferenceCents < 0) {
    const exhaustion = typeof comparison.accumulatedAdvantageExhaustedMonth === 'number'
      ? ` Com os valores declarados, a vantagem acumulada esgota-se no ${comparison.accumulatedAdvantageExhaustedMonth}.º mês.`
      : ''
    return {
      tone: 'negotiate',
      title: 'Negociar o preço depois da promoção',
      action: `Pede que a mensalidade posterior não ultrapasse ${euros(comparison.currentMonthlyCents)}.${exhaustion}`,
      rule: 'É um limite condicional para negociar, não uma poupança confirmada.'
    }
  }

  if (comparison.outcome === 'higher') {
    const action = comparison.maximumMonthlyCentsForNoIncrease === null
      ? 'Pede a remoção do custo único ou condições diferentes; com os valores declarados, nem uma mensalidade de 0,00 € evita pagar mais.'
      : `Pede uma mensalidade de ${euros(comparison.maximumMonthlyCentsForNoIncrease)} ou menos, mantendo os restantes valores declarados.`
    return {
      tone: 'stop',
      title: 'Não aceitar nestas condições',
      action,
      rule: 'É uma contraproposta calculada, não uma poupança confirmada.'
    }
  }

  if (comparison.outcome === 'same') {
    return {
      tone: 'negotiate',
      title: 'Sem vantagem de custo',
      action: 'Pede uma melhoria no preço ou nas condições antes de assumir uma nova fidelização.',
      rule: 'O custo total declarado é igual; não existe poupança confirmada.'
    }
  }

  return {
    tone: 'verify',
    title: 'Confirmar antes de decidir',
    action: 'Pede por escrito o preço final, os serviços incluídos, os custos únicos e a data exata de fim da fidelização.',
    rule: 'A comparação é favorável, mas só um novo custo aceite e observado confirma poupança.'
  }
}

export const buildContractProposalActionNote = (comparison: ContractProposalComparison) => {
  const decision = buildContractProposalDecision(comparison)
  const priceLines = comparison.introductoryMonths === undefined
    ? [`Mensalidade declarada: ${euros(comparison.proposedMonthlyCents)}`]
    : [
        `Preço inicial declarado: ${euros(comparison.proposedMonthlyCents)} durante ${comparison.introductoryMonths} meses`,
        `Preço posterior declarado: ${euros(comparison.laterMonthlyCents!)}`
      ]

  return [
    'Proposta em análise',
    ...priceLines,
    `Custo único declarado: ${euros(comparison.oneOffCents)}`,
    `Período comparado: ${comparison.commitmentMonths} meses`,
    `Custo total declarado: ${euros(comparison.proposedPeriodCents)}`,
    `Próxima ação: ${decision.title} — ${decision.action}`,
    'Estado: proposta não aceite; não é uma poupança confirmada.'
  ].join('\n')
}

export const buildContractDecisionSignal = (events: ExpenseDecisionDate[], civilDate: string): ContractDecisionSignal | null => {
  const today = civilDay(civilDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(civilDate) || Number.isNaN(today) || new Date(today).toISOString().slice(0, 10) !== civilDate) throw new Error('Data civil inválida.')
  if (!events.length) return null

  const ordered = [...events].sort((left, right) => left.date.localeCompare(right.date))
  const next = ordered.find(event => civilDay(event.date) >= today)
  if (next) {
    const days = (civilDay(next.date) - today) / dayMs
    return {
      event: structuredClone(next),
      timing: days === 0 ? 'today' : days <= 30 ? 'soon' : 'upcoming',
      days,
      timingLabel: days === 0 ? 'É hoje' : days === 1 ? 'É amanhã' : `Daqui a ${days} dias`,
      action: actionFor(next)
    }
  }

  const event = ordered.at(-1)!
  const days = (today - civilDay(event.date)) / dayMs
  return {
    event: structuredClone(event),
    timing: 'passed',
    days,
    timingLabel: days === 1 ? 'Passou ontem' : `Passou há ${days} dias`,
    action: 'Confirma o estado atual do contrato e corrige a data se renovou.'
  }
}

export const buildExpenseLifecycle = (expense: RecurringExpense, snapshots: ExpenseSnapshot[]): ExpenseLifecycle => {
  const orderedSnapshots = snapshots
    .map(snapshot => structuredClone(snapshot))
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt))

  const observations = orderedSnapshots.map((snapshot, index): ExpenseLifecycleObservation => {
    const previous = orderedSnapshots[index - 1]
    if (!previous) return { snapshot, change: null }

    const cents = snapshot.priceCents - previous.priceCents
    return {
      snapshot,
      change: {
        cents,
        basisPoints: previous.priceCents === 0 ? 0 : Math.round((cents * 10_000) / previous.priceCents)
      }
    }
  })

  const firstSnapshot = orderedSnapshots[0]
  const latestSnapshot = orderedSnapshots.at(-1)
  const observedChange = firstSnapshot && latestSnapshot && firstSnapshot.id !== latestSnapshot.id
    ? {
        monthlyCents: latestSnapshot.priceCents - firstSnapshot.priceCents,
        annualCents: (latestSnapshot.priceCents - firstSnapshot.priceCents) * 12,
        basisPoints: firstSnapshot.priceCents === 0 ? 0 : Math.round(((latestSnapshot.priceCents - firstSnapshot.priceCents) * 10_000) / firstSnapshot.priceCents),
        fromDate: firstSnapshot.observedAt,
        toDate: latestSnapshot.observedAt
      }
    : null

  const decisionDates: ExpenseDecisionDate[] = []
  if (expense.commitmentEndDate) decisionDates.push({ kind: 'commitment', label: 'Fim da fidelização', date: expense.commitmentEndDate })
  if (expense.details.kind === 'insurance' && expense.details.renewalDate) decisionDates.push({ kind: 'renewal', label: 'Próxima renovação', date: expense.details.renewalDate })
  if (expense.contractEndDate) decisionDates.push({ kind: 'contract', label: 'Fim do contrato', date: expense.contractEndDate })
  decisionDates.sort((left, right) => left.date.localeCompare(right.date))

  return {
    annualEquivalentCents: expense.monthlyCostCents * 12,
    observations,
    observedChange,
    decisionDates
  }
}
