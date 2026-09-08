import { createFinding } from '../finding'
import type { RecurringExpense, SavingsAnalyzer, SavingsContext } from '../types'

export class ElectricityContractedPowerAnalyzer implements SavingsAnalyzer {
  supports(expense: RecurringExpense) { return expense.category === 'electricity' && expense.details.kind === 'electricity' }
  async analyze(expense: RecurringExpense, context: SavingsContext) {
    if (expense.details.kind !== 'electricity') return []
    const { contractedPowerKva, maxHistoricalPowerKva } = expense.details
    if (contractedPowerKva - maxHistoricalPowerKva < 1) return []
    const target = [1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7, 27.6, 34.5, 41.4].find(level => level >= maxHistoricalPowerKva)
    if (!target) return []
    if (target >= contractedPowerKva) return []
    const targetLabel = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(target)
    return [createFinding({ expenseId: expense.id, type: 'WRONG_PLAN', title: 'Potência contratada possivelmente excessiva', description: `O máximo histórico foi ${maxHistoricalPowerKva} kVA, abaixo dos ${contractedPowerKva} kVA contratados.`, minCents: 400, maxCents: 600, confidence: 0.94, severity: 'medium', effort: 'low', urgency: 'medium', action: `Pedir ao fornecedor a redução para ${targetLabel} kVA, confirmando antes as necessidades do agregado.`, evidence: [`Máximo histórico: ${maxHistoricalPowerKva} kVA`, `Potência contratada: ${contractedPowerKva} kVA`, 'Analisámos o histórico disponibilizado.'], now: context.now })]
  }
}
