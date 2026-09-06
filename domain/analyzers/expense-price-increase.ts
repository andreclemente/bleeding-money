import { createFinding } from '../finding'
import type { RecurringExpense, SavingsAnalyzer, SavingsContext } from '../types'

export class ExpensePriceIncreaseAnalyzer implements SavingsAnalyzer {
  supports() { return true }
  async analyze(expense: RecurringExpense, context: SavingsContext) {
    const snapshots = context.snapshots.filter(item => item.expenseId === expense.id).sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    const baseline = snapshots[0]?.priceCents
    if (!baseline || expense.monthlyCostCents - baseline < 200) return []
    const percent = (expense.monthlyCostCents - baseline) / baseline * 100
    if (percent < 10) return []
    const difference = expense.monthlyCostCents - baseline
    return [createFinding({ expenseId: expense.id, type: 'PRICE_INCREASE', title: 'O preço aumentou de forma relevante', description: `O preço mensal subiu ${percent.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}% desde o primeiro registo.`, minCents: Math.round(difference * 0.5), maxCents: difference, confidence: 0.98, severity: 'medium', effort: 'low', urgency: 'medium', action: 'Pedir justificação e negociar a reposição de um preço mais baixo.', evidence: [`Preço inicial: ${(baseline / 100).toFixed(2)} €`, `Preço atual: ${(expense.monthlyCostCents / 100).toFixed(2)} €`], now: context.now })]
  }
}
