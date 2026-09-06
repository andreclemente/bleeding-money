import { createFinding } from '../finding'
import type { RecurringExpense, SavingsAnalyzer, SavingsContext } from '../types'

export class BankMaintenanceFeeAnalyzer implements SavingsAnalyzer {
  supports(expense: RecurringExpense) { return expense.category === 'bank' && expense.details.kind === 'bank' }
  async analyze(expense: RecurringExpense, context: SavingsContext) {
    if (expense.details.kind !== 'bank' || expense.details.accountMaintenanceFeeCents <= 0) return []
    const fee = expense.details.accountMaintenanceFeeCents
    return [createFinding({ expenseId: expense.id, type: 'AVOIDABLE_FEE', title: 'Comissão bancária potencialmente evitável', description: 'Existem contas sem comissão ou formas de isentar este custo.', minCents: Math.round(fee * 0.8), maxCents: fee, confidence: 0.9, severity: 'medium', effort: 'low', urgency: 'medium', action: 'Pedir isenção ao banco e comparar uma conta sem manutenção.', evidence: [`Comissão de manutenção: ${(fee / 100).toFixed(2)} €/mês`], now: context.now })]
  }
}
