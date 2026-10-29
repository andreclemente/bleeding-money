import { defineStore } from 'pinia'
import type { RecurringExpense, SavingsFinding } from '../domain/types'
import type { FamilyRoute } from '../domain/family-route'

export const useSavingsStore = defineStore('savings', () => {
  const dashboard = ref<FamilyRoute | null>(null)
  const expenses = ref<RecurringExpense[]>([])
  const findings = ref<SavingsFinding[]>([])
  const loading = ref(false)
  const refresh = async (fetcher: typeof $fetch = $fetch) => {
    loading.value = true
    try { [dashboard.value, expenses.value, findings.value] = await Promise.all([fetcher('/api/dashboard'), fetcher('/api/expenses'), fetcher('/api/findings')]) }
    finally { loading.value = false }
  }
  const resolve = async (id: string, newCostCents: number, actionDate: string) => {
    await $fetch(`/api/findings/${id}/resolve`, { method: 'POST', body: { newCostCents, actionDate } })
    await refresh()
  }
  const dismiss = async (id: string) => {
    await $fetch(`/api/findings/${id}/dismiss`, { method: 'POST' })
    await refresh()
  }
  return { dashboard, expenses, findings, loading, refresh, resolve, dismiss }
})
