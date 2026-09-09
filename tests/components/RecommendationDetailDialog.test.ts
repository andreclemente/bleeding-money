// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RecommendationDetailDialog from '../../components/RecommendationDetailDialog.vue'
import type { SavingsFinding } from '../../domain/types'

const finding: SavingsFinding = {
  id: 'finding-1',
  expenseId: 'expense-1',
  type: 'NEGOTIATION_OPPORTUNITY',
  title: 'Renegociar o contrato',
  description: 'O preço atual está acima da referência.',
  estimatedMonthlySavingMinCents: 1001,
  estimatedMonthlySavingMaxCents: 2000,
  estimatedAnnualSavingMinCents: 12012,
  estimatedAnnualSavingMaxCents: 24000,
  confidence: 0.84,
  severity: 'medium',
  priority: 80,
  effort: 'low',
  urgency: 'medium',
  action: 'Contactar o fornecedor.',
  evidence: ['O contrato terminou.', 'Existem alternativas mais baratas.'],
  status: 'open',
  createdAt: '2026-09-07T10:00:00.000Z'
}

const stubs = {
  VDialog: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div><button data-testid="neutral-dialog-close" @click="$emit(\'update:modelValue\', false)">fechar diálogo</button><slot /></div>'
  },
  VCard: { template: '<article><slot /></article>' },
  VCardText: { template: '<div><slot /></div>' },
  VCardActions: { template: '<div><slot /></div>' },
  VBtn: {
    inheritAttrs: false,
    props: ['disabled'],
    emits: ['click'],
    template: '<button type="button" v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
  },
  VTextField: {
    inheritAttrs: false,
    props: ['modelValue', 'errorMessages'],
    emits: ['update:modelValue'],
    template: '<div><input data-testid="new-cost" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><p v-if="errorMessages" data-testid="cost-error">{{ errorMessages }}</p></div>'
  }
}

const mountDialog = (props: Record<string, unknown> = {}) => mount(RecommendationDetailDialog, {
  props: { modelValue: true, finding, currentExpenseCostCents: 4899, busy: false, ...props },
  global: { stubs }
})

describe('RecommendationDetailDialog', () => {
  it('emits only close when deciding later', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="decide-later"]').trigger('click')

    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    expect(wrapper.emitted('resolve')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps X and dialog backdrop or Escape closes neutral', async () => {
    const wrapper = mountDialog()

    await wrapper.get('.dialog-close').trigger('click')
    await wrapper.get('[data-testid="neutral-dialog-close"]').trigger('click')

    expect(wrapper.emitted('close')).toEqual([[], []])
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    expect(wrapper.emitted('resolve')).toBeUndefined()
  })

  it('initializes and resets the proposed cost from each finding midpoint in cents', async () => {
    const wrapper = mountDialog()

    expect(wrapper.get('[data-testid="new-cost"]').attributes('value')).toBe('33.98')

    const nextFinding = {
      ...finding,
      id: 'finding-2',
      expenseId: 'expense-2',
      estimatedMonthlySavingMinCents: 201,
      estimatedMonthlySavingMaxCents: 400
    }
    await wrapper.setProps({ finding: nextFinding, currentExpenseCostCents: 1299 })

    expect(wrapper.get('[data-testid="new-cost"]').attributes('value')).toBe('9.98')
  })

  it('clamps the finding-specific estimate to the valid expense range', () => {
    const wrapper = mountDialog({
      currentExpenseCostCents: 500,
      finding: {
        ...finding,
        estimatedMonthlySavingMinCents: 700,
        estimatedMonthlySavingMaxCents: 900
      }
    })

    expect(wrapper.get('[data-testid="new-cost"]').attributes('value')).toBe('0')
  })

  it.each([
    ['-1', 'não pode ser negativo'],
    ['49.00', 'não pode ser superior'],
    ['12.345', 'no máximo duas casas decimais'],
    ['NaN', 'Introduz um valor válido']
  ])('blocks invalid proposed cost %s with inline PT-PT guidance', async (value, guidance) => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="new-cost"]').setValue(value)

    expect(wrapper.get('[data-testid="cost-error"]').text()).toContain(guidance)
    expect(wrapper.get('[data-testid="resolve-finding"]').attributes()).toHaveProperty('disabled')
    await wrapper.get('[data-testid="resolve-finding"]').trigger('click')
    expect(wrapper.emitted('resolve')).toBeUndefined()
  })

  it('emits an exact integer-cent value when the proposed cost is valid', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="new-cost"]').setValue('12.34')
    await wrapper.get('[data-testid="resolve-finding"]').trigger('click')

    expect(wrapper.emitted('resolve')).toEqual([[1234]])
  })

  it('trata avisos sem estimativa como revisão, sem custo novo nem poupança zero', () => {
    const wrapper = mountDialog({ finding: {
      ...finding,
      type: 'CONTRACT_EXPIRING',
      estimatedMonthlySavingMinCents: 0,
      estimatedMonthlySavingMaxCents: 0
    } })

    expect(wrapper.text()).toContain('Poupança não estimada')
    expect(wrapper.text()).toContain('Marcar revisão como concluída')
    expect(wrapper.text()).not.toContain('Poupança mensal estimada')
    expect(wrapper.find('[data-testid="new-cost"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="resolve-finding"]').exists()).toBe(false)
  })
})
