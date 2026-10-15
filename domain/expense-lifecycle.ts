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
  proposedMonthlyEquivalentCents: number
  recurringDifferenceCents: number
  breakEvenMonth: number | null
  introductoryMonths?: number
  laterMonthlyCents?: number
  laterPeriodMonths?: number
  laterRecurringDifferenceCents?: number
  maximumMonthlyCentsForNoIncrease: number | null
  periodDifferenceCents: number
  outcome: 'lower' | 'same' | 'higher'
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
  const recurringDifferenceCents = input.currentMonthlyCents - input.proposedMonthlyCents
  if (!Number.isSafeInteger(recurringDifferenceCents)) throw new Error('Valor monetário inválido.')
  const laterRecurringDifferenceCents = hasPhasedPrice ? input.currentMonthlyCents - input.laterMonthlyCents! : undefined
  if (laterRecurringDifferenceCents !== undefined && !Number.isSafeInteger(laterRecurringDifferenceCents)) throw new Error('Valor monetário inválido.')
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
  let accumulatedDifferenceCents = -input.oneOffCents
  for (let month = 1; breakEvenMonth === null && month <= input.commitmentMonths; month += 1) {
    const proposedMonthlyCents = hasPhasedPrice && month > input.introductoryMonths! ? input.laterMonthlyCents! : input.proposedMonthlyCents
    accumulatedDifferenceCents += input.currentMonthlyCents - proposedMonthlyCents
    if (accumulatedDifferenceCents >= 0 && (input.oneOffCents > 0 || accumulatedDifferenceCents > 0)) breakEvenMonth = month
  }

  return {
    ...input,
    ...(hasPhasedPrice ? { laterPeriodMonths, laterRecurringDifferenceCents } : {}),
    currentPeriodCents,
    proposedPeriodCents,
    proposedMonthlyEquivalentCents: Math.round(proposedPeriodCents / input.commitmentMonths),
    recurringDifferenceCents,
    maximumMonthlyCentsForNoIncrease,
    breakEvenMonth,
    periodDifferenceCents,
    outcome: periodDifferenceCents > 0 ? 'lower' : periodDifferenceCents < 0 ? 'higher' : 'same',
    rule: 'Comparação condicional: assume o custo atual constante durante o período; não confirma poupança.'
  }
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

  const decisionDates: ExpenseDecisionDate[] = []
  if (expense.commitmentEndDate) decisionDates.push({ kind: 'commitment', label: 'Fim da fidelização', date: expense.commitmentEndDate })
  if (expense.details.kind === 'insurance' && expense.details.renewalDate) decisionDates.push({ kind: 'renewal', label: 'Próxima renovação', date: expense.details.renewalDate })
  if (expense.contractEndDate) decisionDates.push({ kind: 'contract', label: 'Fim do contrato', date: expense.contractEndDate })
  decisionDates.sort((left, right) => left.date.localeCompare(right.date))

  return {
    annualEquivalentCents: expense.monthlyCostCents * 12,
    observations,
    decisionDates
  }
}
