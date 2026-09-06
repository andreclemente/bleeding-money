import { createFinding } from '../finding'
import type { RecurringExpense, SavingsAnalyzer, SavingsContext } from '../types'

export class TelecomContractExpiredAnalyzer implements SavingsAnalyzer {
  supports(expense: RecurringExpense) { return expense.category === 'telecom' }
  async analyze(expense: RecurringExpense, context: SavingsContext) {
    if (!expense.commitmentEndDate || new Date(expense.commitmentEndDate) >= context.now) return []
    const months = Math.max(0, Math.floor((context.now.getTime() - new Date(expense.commitmentEndDate).getTime()) / 2629800000))
    return [createFinding({ expenseId: expense.id, type: 'CONTRACT_EXPIRED', title: 'A fidelização já terminou', description: `O contrato está sem fidelização há cerca de ${months} meses.`, minCents: 0, maxCents: Math.round(expense.monthlyCostCents * 0.2), confidence: 1, severity: 'medium', effort: 'low', urgency: 'high', action: 'Contactar o operador e renegociar antes de considerar mudar.', evidence: [`Fim da fidelização: ${expense.commitmentEndDate}`, 'Podes negociar sem penalização de fidelização.'], now: context.now })]
  }
}
