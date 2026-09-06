import type { RecurringExpense, SavingsAnalyzer, SavingsContext, SavingsFinding } from './types'

export class SavingsEngine {
  private analyzers: SavingsAnalyzer[] = []
  register(analyzer: SavingsAnalyzer) {
    this.analyzers.push(analyzer)
    return this
  }
  async analyze(expense: RecurringExpense, context: SavingsContext): Promise<SavingsFinding[]> {
    const groups = await Promise.all(this.analyzers.filter(item => item.supports(expense)).map(item => item.analyze(expense, context)))
    return groups.flat().sort((a, b) => b.priority - a.priority)
  }
}
