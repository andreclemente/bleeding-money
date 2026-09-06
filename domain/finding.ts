import { calculatePriority } from './priority'
import type { Effort, FindingType, SavingsFinding, Severity, Urgency } from './types'

export const createFinding = (input: {
  expenseId: string, type: FindingType, title: string, description: string,
  minCents: number, maxCents: number, confidence: number, severity: Severity,
  effort: Effort, urgency: Urgency, action: string, evidence: string[], now: Date
}): SavingsFinding => {
  const annualMin = input.minCents * 12
  const annualMax = input.maxCents * 12
  return {
    id: crypto.randomUUID(), expenseId: input.expenseId, type: input.type,
    title: input.title, description: input.description,
    estimatedMonthlySavingMinCents: input.minCents, estimatedMonthlySavingMaxCents: input.maxCents,
    estimatedAnnualSavingMinCents: annualMin, estimatedAnnualSavingMaxCents: annualMax,
    confidence: input.confidence, severity: input.severity,
    priority: calculatePriority({ annualSavingMaxCents: annualMax, confidence: input.confidence, effort: input.effort, urgency: input.urgency }),
    effort: input.effort, urgency: input.urgency, action: input.action, evidence: input.evidence,
    status: 'open', createdAt: input.now.toISOString()
  }
}
export const euros = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
