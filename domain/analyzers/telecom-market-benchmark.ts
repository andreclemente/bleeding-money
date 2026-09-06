import { benchmark, filterComparableObservations } from '../benchmark'
import { createFinding } from '../finding'
import type { RecurringExpense, SavingsAnalyzer, SavingsContext } from '../types'

export class TelecomMarketBenchmarkAnalyzer implements SavingsAnalyzer {
  supports(expense: RecurringExpense) { return expense.category === 'telecom' && expense.details.kind === 'telecom' }
  async analyze(expense: RecurringExpense, context: SavingsContext) {
    if (expense.details.kind !== 'telecom') return []
    const comparable = filterComparableObservations(context.marketObservations, { category: 'telecom', provider: expense.provider, productType: expense.details.connectionType, attributes: { speedMbps: expense.details.downloadSpeedMbps }, country: 'PT', now: context.now })
    const stats = benchmark(comparable.map(item => item.monthlyPriceCents))
    if (!stats || expense.monthlyCostCents <= stats.p75) return []
    return [createFinding({ expenseId: expense.id, type: 'MARKET_OVERPRICED', title: 'Estás a pagar acima do normal', description: `O preço excede o intervalo recente de ${stats.count} contratos comparáveis.`, minCents: expense.monthlyCostCents - stats.p75, maxCents: expense.monthlyCostCents - stats.p25, confidence: 0.9, severity: 'high', effort: 'low', urgency: 'high', action: 'Renegociar primeiro com o fornecedor atual.', evidence: [`Amostra comparável: ${stats.count} contratos`, `Intervalo p25–p75: ${(stats.p25 / 100).toFixed(2)} €–${(stats.p75 / 100).toFixed(2)} €`, `Preço atual: ${(expense.monthlyCostCents / 100).toFixed(2)} €`], now: context.now })]
  }
}
