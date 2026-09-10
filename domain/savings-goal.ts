const POSTGRES_INTEGER_MAX = 2_147_483_647

export interface SavingsGoal {
  id: string
  userId: string
  name: string
  targetAnnualCents: number
  createdAt: string
  updatedAt: string
}

export interface SavingsGoalInput {
  name: string
  targetAnnualCents: number
}

export interface SavingsGoalProgress extends SavingsGoal {
  confirmedAnnualCents: number
  remainingAnnualCents: number
  percentage: number
}

export const parseSavingsGoalInput = (value: unknown): SavingsGoalInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objetivo inválido')
  const row = value as Record<string, unknown>
  const unknown = Object.keys(row).find(key => !['name', 'targetAnnualCents'].includes(key))
  if (unknown) throw new Error(`Campo não permitido: ${unknown}`)
  if (typeof row.name !== 'string' || !row.name.trim() || row.name.trim().length > 80) throw new Error('Nome do objetivo inválido')
  if (!Number.isSafeInteger(row.targetAnnualCents) || (row.targetAnnualCents as number) <= 0 || (row.targetAnnualCents as number) > POSTGRES_INTEGER_MAX) throw new Error('Montante anual inválido')
  return { name: row.name.trim(), targetAnnualCents: row.targetAnnualCents as number }
}

export const confirmedGoalProgress = (goal: SavingsGoal, actions: Array<{ annualSavingCents: number }>): SavingsGoalProgress => {
  const confirmedAnnualCents = actions.reduce((sum, action) => {
    if (!Number.isSafeInteger(action.annualSavingCents) || action.annualSavingCents < 0) throw new Error('Valor monetário inválido')
    const next = sum + action.annualSavingCents
    if (!Number.isSafeInteger(next)) throw new Error('Total monetário inválido')
    return next
  }, 0)
  return {
    ...goal,
    confirmedAnnualCents,
    remainingAnnualCents: Math.max(0, goal.targetAnnualCents - confirmedAnnualCents),
    percentage: Math.min(100, Math.round(confirmedAnnualCents / goal.targetAnnualCents * 100))
  }
}
