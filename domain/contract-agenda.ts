import type { RecurringExpense } from './types'

export interface ContractAgendaInput {
  commitmentEndDate?: string
  contractEndDate?: string
  renewalDate?: string
}

export type ContractAgendaPatch = Pick<RecurringExpense, 'commitmentEndDate' | 'contractEndDate'> & {
  details?: RecurringExpense['details']
}

const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const declaredDate = (value: string | undefined) => {
  const normalized = value?.trim()
  if (!normalized) return undefined
  if (!isIsoDate(normalized)) throw new Error('Data inválida.')
  return normalized
}

export const buildContractAgendaPatch = (expense: RecurringExpense, input: ContractAgendaInput): ContractAgendaPatch => {
  const patch: ContractAgendaPatch = {}
  const commitmentEndDate = declaredDate(input.commitmentEndDate)
  const contractEndDate = declaredDate(input.contractEndDate)
  const renewalDate = declaredDate(input.renewalDate)

  if (commitmentEndDate && commitmentEndDate !== expense.commitmentEndDate) patch.commitmentEndDate = commitmentEndDate
  if (contractEndDate && contractEndDate !== expense.contractEndDate) patch.contractEndDate = contractEndDate

  if (renewalDate) {
    if (expense.details.kind !== 'insurance') throw new Error('A renovação só se aplica a seguros.')
    if (renewalDate !== expense.details.renewalDate) patch.details = { ...structuredClone(expense.details), renewalDate }
  }

  if (!Object.keys(patch).length) throw new Error('Indica pelo menos uma data diferente.')
  return patch
}
