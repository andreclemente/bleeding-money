import type { Effort, Urgency } from './types'

const effortScores: Record<Effort, number> = { very_low: 1, low: 0.8, medium: 0.45, high: 0.15 }
const urgencyScores: Record<Urgency, number> = { low: 0.25, medium: 0.65, high: 1 }
export interface PriorityInput { annualSavingMaxCents: number, confidence: number, effort: Effort, urgency: Urgency }
export const calculatePriority = (input: PriorityInput) => {
  const saving = Math.min(1, Math.max(0, input.annualSavingMaxCents) / 30000)
  const confidence = Math.max(0, Math.min(1, input.confidence))
  return Math.round((saving * 0.45 + confidence * 0.25 + effortScores[input.effort] * 0.15 + urgencyScores[input.urgency] * 0.15) * 100)
}
