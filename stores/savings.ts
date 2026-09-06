import { defineStore } from 'pinia'
import type { RecurringExpense, SavingsFinding } from '../domain/types'

interface Dashboard { monthlyExpensesCents: number, potentialMonthlyMinCents: number, potentialMonthlyMaxCents: number, realizedAnnualCents: number, priorityFindings: SavingsFinding[], expenses: RecurringExpense[] }
export const useSavingsStore = defineStore('savings', () => {
  const dashboard = ref<Dashboard | null>(null)
  const expenses = ref<RecurringExpense[]>([])
  const findings = ref<SavingsFinding[]>([])
  const loading = ref(false)
  const refresh = async () => {
    loading.value = true
    try { [dashboard.value, expenses.value, findings.value] = await Promise.all([$fetch('/api/dashboard'), $fetch('/api/expenses'), $fetch('/api/findings')]) }
    finally { loading.value = false }
  }
  const resolve = async (id: string, newCostCents: number) => {
    await $fetch(`/api/findings/${id}/resolve`, { method: 'POST', body: { newCostCents } })
    await refresh()
  }
  const dismiss = async (id: string) => {
    await $fetch(`/api/findings/${id}/dismiss`, { method: 'POST' })
    await refresh()
  }
  return { dashboard, expenses, findings, loading, refresh, resolve, dismiss }
})
