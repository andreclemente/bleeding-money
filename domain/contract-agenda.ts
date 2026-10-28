import type { RecurringExpense } from './types'

export interface ContractAgendaInput {
  commitmentEndDate?: string
  contractEndDate?: string
  renewalDate?: string
  clearCommitmentEndDate?: boolean
  clearContractEndDate?: boolean
  clearRenewalDate?: boolean
}

export type ContractAgendaPatch = {
  commitmentEndDate?: string | null
  contractEndDate?: string | null
  details?: RecurringExpense['details']
}

export type ContractRadarItem = {
  expenseId: string
  productName: string
  provider: string
  kind: 'commitment' | 'renewal' | 'contract'
  label: string
  date: string
  daysUntil: number
  action: string
}

export type ContractAgendaGap = {
  expenseId: string
  productName: string
  provider: string
  status: 'stale' | 'missing'
  label: string
  action: string
  lastDeclaredDate: string | null
}

const dayMs = 86_400_000
const radarEventMeta: Record<ContractRadarItem['kind'], Pick<ContractRadarItem, 'label' | 'action'>> = {
  commitment: { label: 'Fim da fidelização', action: 'Preparar renegociação ou mudança.' },
  renewal: { label: 'Próxima renovação', action: 'Confirmar condições de renovação.' },
  contract: { label: 'Fim do contrato', action: 'Confirmar continuação ou termo.' }
}

const declaredEvents = (expense: RecurringExpense) => {
  const events: Array<{ kind: ContractRadarItem['kind'], label: string, date: string }> = []
  if (expense.commitmentEndDate) events.push({ kind: 'commitment', label: radarEventMeta.commitment.label, date: expense.commitmentEndDate })
  if (expense.details.kind === 'insurance' && expense.details.renewalDate) events.push({ kind: 'renewal', label: radarEventMeta.renewal.label, date: expense.details.renewalDate })
  if (expense.contractEndDate) events.push({ kind: 'contract', label: radarEventMeta.contract.label, date: expense.contractEndDate })
  return events.sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind))
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

  if (input.clearCommitmentEndDate && expense.commitmentEndDate) patch.commitmentEndDate = null
  else if (commitmentEndDate && commitmentEndDate !== expense.commitmentEndDate) patch.commitmentEndDate = commitmentEndDate
  if (input.clearContractEndDate && expense.contractEndDate) patch.contractEndDate = null
  else if (contractEndDate && contractEndDate !== expense.contractEndDate) patch.contractEndDate = contractEndDate

  if (input.clearRenewalDate) {
    if (expense.details.kind !== 'insurance') throw new Error('A renovação só se aplica a seguros.')
    if (expense.details.renewalDate) {
      const details = structuredClone(expense.details)
      delete details.renewalDate
      patch.details = details
    }
  } else if (renewalDate) {
    if (expense.details.kind !== 'insurance') throw new Error('A renovação só se aplica a seguros.')
    if (renewalDate !== expense.details.renewalDate) patch.details = { ...structuredClone(expense.details), renewalDate }
  }

  if (!Object.keys(patch).length) throw new Error('Indica pelo menos uma data diferente.')
  return patch
}

export const buildContractRadar = (expenses: RecurringExpense[], civilDate: string, windowDays = 45): ContractRadarItem[] => {
  if (!isIsoDate(civilDate)) throw new Error('Data civil inválida.')
  if (!Number.isSafeInteger(windowDays) || windowDays < 0) throw new Error('Janela inválida.')
  const currentDay = Date.parse(`${civilDate}T00:00:00.000Z`)

  return expenses.flatMap((expense) => {
    return declaredEvents(expense).flatMap((event) => {
      const daysUntil = (Date.parse(`${event.date}T00:00:00.000Z`) - currentDay) / dayMs
      if (!Number.isInteger(daysUntil) || daysUntil < 0 || daysUntil > windowDays) return []
      return [{
        expenseId: expense.id,
        productName: expense.productName,
        provider: expense.provider,
        kind: event.kind,
        ...radarEventMeta[event.kind],
        date: event.date,
        daysUntil
      }]
    })
  }).sort((left, right) => left.daysUntil - right.daysUntil || left.expenseId.localeCompare(right.expenseId) || left.kind.localeCompare(right.kind))
}

export const getNextDeclaredContractDate = (expense: RecurringExpense, civilDate: string) => {
  if (!isIsoDate(civilDate)) throw new Error('Data civil inválida.')
  const next = declaredEvents(expense).find(event => event.date >= civilDate)
  return next ? structuredClone(next) : null
}

export const buildContractAgendaGapQueue = (expenses: RecurringExpense[], civilDate: string): ContractAgendaGap[] => {
  if (!isIsoDate(civilDate)) throw new Error('Data civil inválida.')

  return expenses.flatMap((expense) => {
    const events = declaredEvents(expense)
    if (events.some(event => event.date >= civilDate)) return []
    const lastDeclaredDate = events.at(-1)?.date || null
    return [{
      expenseId: expense.id,
      productName: expense.productName,
      provider: expense.provider,
      status: lastDeclaredDate ? 'stale' as const : 'missing' as const,
      label: lastDeclaredDate ? 'Prazo passado por confirmar' : 'Agenda não declarada',
      action: lastDeclaredDate
        ? 'Confirma se o contrato renovou e regista a próxima data real.'
        : 'Regista uma data contratual apenas se constar do contrato ou aviso.',
      lastDeclaredDate
    }]
  }).sort((left, right) => {
    if (left.status !== right.status) return left.status === 'stale' ? -1 : 1
    if (left.lastDeclaredDate !== right.lastDeclaredDate) return (right.lastDeclaredDate || '').localeCompare(left.lastDeclaredDate || '')
    return left.expenseId.localeCompare(right.expenseId)
  })
}
