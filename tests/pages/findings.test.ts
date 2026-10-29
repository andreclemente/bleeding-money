// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FindingsPage from '../../pages/findings.vue'
import type { RecurringExpense, SavingsFinding } from '../../domain/types'
import type { FamilyRoute } from '../../domain/family-route'

const finding: SavingsFinding = {
  id: 'finding-1',
  expenseId: 'expense-1',
  type: 'NEGOTIATION_OPPORTUNITY',
  title: 'Renegociar o contrato',
  description: 'O preço atual está acima da referência.',
  estimatedMonthlySavingMinCents: 1001,
  estimatedMonthlySavingMaxCents: 2002,
  estimatedAnnualSavingMinCents: 12012,
  estimatedAnnualSavingMaxCents: 24024,
  confidence: 0.84,
  severity: 'medium',
  priority: 80,
  effort: 'low',
  urgency: 'medium',
  action: 'Contactar o fornecedor.',
  evidence: ['O contrato terminou.'],
  status: 'open',
  createdAt: '2026-09-07T10:00:00.000Z'
}

const expense: RecurringExpense = {
  id: 'expense-1',
  userId: 'user-1',
  category: 'subscription',
  provider: 'Fornecedor',
  productName: 'Plano',
  monthlyCostCents: 4899,
  billingFrequency: 'monthly',
  currency: 'EUR',
  details: { kind: 'subscription', plan: 'Pro' },
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z'
}

const dialogStub = defineComponent({
  name: 'RecommendationDetailDialog',
  props: {
    modelValue: Boolean,
    finding: Object,
    currentExpenseCostCents: Number,
    busy: Boolean,
    error: String
  },
  emits: ['close', 'dismiss', 'resolve'],
  template: `
    <div data-testid="dialog" :data-open="String(modelValue)" :data-current-cost="String(currentExpenseCostCents)">
      <p v-if="error" role="alert">{{ error }}</p>
      <button data-testid="neutral-close" @click="$emit('close')">fechar</button>
      <button data-testid="resolve" @click="$emit('resolve', 3397, '2026-09-12')">resolver</button>
    </div>
  `
})

interface StoreStub {
  findings: SavingsFinding[]
  expenses: RecurringExpense[]
  loading: boolean
  dashboard: FamilyRoute | null
  refresh: ReturnType<typeof vi.fn>
  resolve: ReturnType<typeof vi.fn>
  dismiss: ReturnType<typeof vi.fn>
}

let store: StoreStub
let route: { query: Record<string, string> }
let routerReplace: ReturnType<typeof vi.fn>

const mountPage = async () => {
  const wrapper = mount(defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(FindingsPage) })
  }), {
    global: {
      components: {
        RecommendationDetailDialog: dialogStub,
        VBtn: defineComponent({ template: '<button><slot /></button>' })
      }
    }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  routerReplace = vi.fn().mockResolvedValue(undefined)
  route = reactive({ query: { open: finding.id, vista: 'prioritarias' } })
  store = reactive({
    findings: [finding],
    expenses: [expense],
    loading: false,
    dashboard: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    resolve: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined)
  })

  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useSavingsStore', () => store)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ replace: routerReplace }))
  vi.stubGlobal('callOnce', (callback: () => unknown) => callback())
})

describe('pages/findings', () => {
  it('passes the selected finding current expense cost to the dialog', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="dialog"]').attributes('data-current-cost')).toBe('4899')
  })

  it('keeps cents in recommendation monetary values', async () => {
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('10,01')
    expect(wrapper.text()).toContain('20,02')
  })

  it('não apresenta zero euros como poupança quando o aviso não tem estimativa', async () => {
    store.findings = [{ ...finding, type: 'CONTRACT_EXPIRING', estimatedMonthlySavingMinCents: 0, estimatedMonthlySavingMaxCents: 0 }]
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Poupança não estimada')
    expect(wrapper.text()).toContain('Sem poupanças potenciais estimadas')
    expect(wrapper.text()).not.toContain('0,00 €–0,00 €')
  })

  it('não afirma que existem avisos factuais quando a lista aberta está vazia', async () => {
    store.findings = []
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Sem decisões pendentes')
    expect(wrapper.text()).not.toContain('avisos factuais por rever')
  })

  it('clears selected state and only the open query on neutral close', async () => {
    const wrapper = await mountPage()

    await wrapper.get('[data-testid="neutral-close"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="dialog"]').attributes('data-open')).toBe('false')
    expect(routerReplace).toHaveBeenCalledWith({ query: { vista: 'prioritarias' } })
    expect(store.resolve).not.toHaveBeenCalled()
    expect(store.dismiss).not.toHaveBeenCalled()
  })

  it('shows a visible PT-PT error when resolution API fails', async () => {
    store.resolve = vi.fn().mockRejectedValue(new Error('Conflito ao resolver'))
    const wrapper = await mountPage()

    await wrapper.get('[data-testid="resolve"]').trigger('click')
    await flushPromises()

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Não foi possível marcar a recomendação como resolvida')
    expect(wrapper.get('[data-testid="dialog"]').attributes('data-open')).toBe('true')
  })

  it('envia a data da cobrança observada ao fechar a recomendação', async () => {
    const wrapper = await mountPage()

    await wrapper.get('[data-testid="resolve"]').trigger('click')
    await flushPromises()

    expect(store.resolve).toHaveBeenCalledWith(finding.id, 3397, '2026-09-12')
  })

  it('mantém um arquivo que separa reduções comprovadas de casos encerrados sem alteração', async () => {
    const resolved = { ...finding, id: 'resolved-1', status: 'resolved' as const, resolvedAt: '2026-09-12T10:00:00.000Z' }
    const dismissed = { ...finding, id: 'dismissed-1', title: 'Rever cobertura', status: 'dismissed' as const, dismissedAt: '2026-09-11T10:00:00.000Z' }
    store.findings = [resolved, dismissed]
    store.dashboard = {
      decisions: [{ id: 'action-1', findingId: resolved.id, previousCostCents: 4899, newCostCents: 3397, actionDate: '2026-09-12', annualSavingCents: 18024, createdAt: '2026-09-12T10:00:00.000Z' }]
    } as FamilyRoute
    route.query = { vista: 'prioritarias' }

    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Arquivo auditável')
    expect(wrapper.text()).toContain('Redução confirmada')
    expect(wrapper.text()).toContain('180,24')
    expect(wrapper.text()).toContain('48,99')
    expect(wrapper.text()).toContain('33,97')
    expect(wrapper.text()).toContain('Encerrado sem alteração')
    expect(wrapper.text()).toContain('não entra no objetivo')
  })
})
