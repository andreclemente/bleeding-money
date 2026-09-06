import type { BillingFrequency } from './types'

const assertMinorUnits = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('O montante deve ser um inteiro não negativo em cêntimos')
}

export const monthlyCost = (amountCents: number, frequency: BillingFrequency) => {
  assertMinorUnits(amountCents)
  if (frequency === 'annual') return Math.round(amountCents / 12)
  if (frequency === 'quarterly') return Math.round(amountCents / 3)
  return amountCents
}

export const annualSaving = (previousCostCents: number, newCostCents: number) => {
  assertMinorUnits(previousCostCents)
  assertMinorUnits(newCostCents)
  return Math.max(0, previousCostCents - newCostCents) * 12
}

export const annualRange = (minCents: number, maxCents: number) => ({ min: minCents * 12, max: maxCents * 12 })
