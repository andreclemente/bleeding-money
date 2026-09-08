import { describe, expect, it } from 'vitest'
import { analyzerCapabilities, applyExpenseTemplate, buildExpenseRequest, createExpenseWizardState, expenseTemplates, type ExpenseTemplate } from '../../utils/expense-wizard'
import { parseExpenseCreateInput } from '../../server/db/repository'

const expected: Record<ExpenseTemplate, [string, string]> = {
  electricity_bill: ['electricity', 'electricity'],
  internet_tv: ['telecom', 'telecom'],
  mobile_plan: ['telecom', 'telecom'],
  bank_account_card: ['bank', 'bank'],
  streaming: ['subscription', 'subscription'],
  software_cloud_saas: ['subscription', 'subscription']
}

describe('entrada guiada por perguntas', () => {
  it('oferece exatamente os seis exemplos suportados', () => {
    expect(expenseTemplates.map(item => item.value)).toEqual(Object.keys(expected))
  })

  it.each(Object.entries(expected) as Array<[ExpenseTemplate, [string, string]]>)('mapeia %s para o DTO real', (template, [category, kind]) => {
    const form = createExpenseWizardState()
    applyExpenseTemplate(form, template)
    Object.assign(form, { provider: 'Fornecedor', productName: 'Produto', monthlyCost: 10 })
    const dto = buildExpenseRequest(form)
    expect(() => parseExpenseCreateInput(dto)).not.toThrow()
    expect(dto.category).toBe(category)
    expect(dto.details.kind).toBe(kind)
  })

  it('declara checks disponíveis e indisponíveis conforme dados opcionais', () => {
    const subscription = createExpenseWizardState()
    applyExpenseTemplate(subscription, 'streaming')
    expect(analyzerCapabilities(subscription)).toEqual({
      available: [],
      unavailable: ['Aumento de preço — a monitorização começa agora; é necessária uma observação posterior', 'Subscrição sem utilização — falta a data da última utilização']
    })
    subscription.lastUsedAt = '2026-01-01'
    expect(analyzerCapabilities(subscription).available).toContain('Subscrição sem utilização')

    const telecom = createExpenseWizardState()
    applyExpenseTemplate(telecom, 'internet_tv')
    expect(analyzerCapabilities(telecom).unavailable).toContain('Fim da fidelização — falta a data de fim')
    telecom.hasCommitment = true
    telecom.commitmentEndDate = '2027-01-01'
    expect(analyzerCapabilities(telecom).available).toContain('Fim da fidelização')
    expect(analyzerCapabilities(telecom).available).toContain('Comparação com a comunidade (se existirem 10 casos comparáveis)')
  })
})
