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

const civilDay = (value: string) => Date.parse(`${value}T00:00:00.000Z`)
const dayMs = 86_400_000

const actionFor = (event: ExpenseDecisionDate) => {
  if (event.kind === 'renewal') return 'Confirma as condições de renovação junto do fornecedor.'
  if (event.kind === 'commitment') return 'Confirma se já podes renegociar ou mudar de fornecedor.'
  return 'Confirma as condições de termo ou continuação do contrato.'
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
