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
