import { createFinding } from '../finding'
import type { RecurringExpense, SavingsAnalyzer, SavingsContext } from '../types'

export class SubscriptionUnusedAnalyzer implements SavingsAnalyzer {
  supports(expense: RecurringExpense) { return expense.category === 'subscription' && expense.details.kind === 'subscription' }
  async analyze(expense: RecurringExpense, context: SavingsContext) {
    if (expense.details.kind !== 'subscription' || !expense.details.lastUsedAt) return []
    const days = (context.now.getTime() - new Date(expense.details.lastUsedAt).getTime()) / 86400000
    if (days < 60) return []
    return [createFinding({ expenseId: expense.id, type: 'UNUSED_SERVICE', title: 'Subscrição aparentemente não utilizada', description: `Não existem sinais de utilização há ${Math.floor(days)} dias.`, minCents: expense.monthlyCostCents, maxCents: expense.monthlyCostCents, confidence: 0.95, severity: 'high', effort: 'very_low', urgency: 'high', action: 'Confirmar a utilização e cancelar a subscrição se já não for necessária.', evidence: [`Última utilização registada: ${expense.details.lastUsedAt}`, `Custo atual: ${expense.monthlyCostCents / 100} €/mês`], now: context.now })]
  }
}
