import { describe, expect, it } from 'vitest'
import { buildContractCallGuide, buildContractDecisionDossier, buildContractDecisionSignal, buildContractProposalActionNote, buildContractProposalDecision, buildContractProposalReadiness, buildContractProposalValidity, buildExpenseLifecycle, buildInsuranceProposalReadiness, compareContractProposal } from '../../domain/expense-lifecycle'
import type { ExpenseSnapshot, RecurringExpense } from '../../domain/types'

const expense = (overrides: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id: 'expense-1',
  userId: 'user-1',
  category: 'telecom',
  provider: 'Fornecedor',
  productName: 'Fibra',
  monthlyCostCents: 4890,
  billingFrequency: 'monthly',
  currency: 'EUR',
  contractStartDate: '2024-01-01',
  commitmentEndDate: '2026-04-01',
  details: { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 },
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  ...overrides
})

const snapshot = (id: string, observedAt: string, priceCents: number): ExpenseSnapshot => ({
  id,
  expenseId: 'expense-1',
  observedAt,
  priceCents,
  plan: 'Fibra 500',
  properties: {},
  source: 'manual'
})

describe('linha de vida da despesa', () => {
  it('ordena observações e calcula apenas variações confirmadas entre valores registados', () => {
    const lifecycle = buildExpenseLifecycle(expense(), [
      snapshot('latest', '2026-08-01', 4890),
      snapshot('first', '2024-01-01', 3690),
      snapshot('middle', '2025-07-01', 4190)
    ])

    expect(lifecycle.annualEquivalentCents).toBe(58_680)
    expect(lifecycle.observations.map(item => item.snapshot.id)).toEqual(['first', 'middle', 'latest'])
    expect(lifecycle.observations.map(item => item.change)).toEqual([
      null,
      { cents: 500, basisPoints: 1355 },
      { cents: 700, basisPoints: 1671 }
    ])
    expect(lifecycle.observedChange).toEqual({
      monthlyCents: 1200,
      annualCents: 14_400,
      basisPoints: 3252,
      fromDate: '2024-01-01',
      toDate: '2026-08-01'
    })
  })

  it('separa renovação, fim de fidelização e fim de contrato sem inventar datas', () => {
    const insurance = expense({
      category: 'insurance',
      commitmentEndDate: '2026-03-01',
      contractEndDate: '2026-12-31',
      details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-11-15', coverageCodes: ['building'] }
    })

    expect(buildExpenseLifecycle(insurance, []).decisionDates).toEqual([
      { kind: 'commitment', label: 'Fim da fidelização', date: '2026-03-01' },
      { kind: 'renewal', label: 'Próxima renovação', date: '2026-11-15' },
      { kind: 'contract', label: 'Fim do contrato', date: '2026-12-31' }
    ])
  })

  it('mantém a linha de vida honesta quando ainda não existe histórico', () => {
    const lifecycle = buildExpenseLifecycle(expense({ monthlyCostCents: 1199, contractStartDate: undefined, commitmentEndDate: undefined }), [])

    expect(lifecycle.observations).toEqual([])
    expect(lifecycle.observedChange).toBeNull()
    expect(lifecycle.decisionDates).toEqual([])
    expect(lifecycle.annualEquivalentCents).toBe(14_388)
  })

  it('resume uma redução apenas entre o primeiro e o último valor observados', () => {
    const lifecycle = buildExpenseLifecycle(expense(), [
      snapshot('first', '2025-01-01', 5000),
      snapshot('latest', '2026-01-01', 4500)
    ])

    expect(lifecycle.observedChange).toEqual({
      monthlyCents: -500,
      annualCents: -6000,
      basisPoints: -1000,
      fromDate: '2025-01-01',
      toDate: '2026-01-01'
    })
  })

  it('destaca o próximo prazo declarado com uma ação verificável', () => {
    const signal = buildContractDecisionSignal([
      { kind: 'commitment', label: 'Fim da fidelização', date: '2026-10-01' },
      { kind: 'renewal', label: 'Próxima renovação', date: '2026-10-20' },
      { kind: 'contract', label: 'Fim do contrato', date: '2027-01-31' }
    ], '2026-10-14')

    expect(signal).toEqual({
      event: { kind: 'renewal', label: 'Próxima renovação', date: '2026-10-20' },
      timing: 'soon',
      days: 6,
      timingLabel: 'Daqui a 6 dias',
      action: 'Confirma as condições de renovação junto do fornecedor.'
    })
  })

  it('assinala o último prazo passado sem inventar uma nova data', () => {
    const signal = buildContractDecisionSignal([
      { kind: 'commitment', label: 'Fim da fidelização', date: '2026-09-01' },
      { kind: 'contract', label: 'Fim do contrato', date: '2026-10-10' }
    ], '2026-10-14')

    expect(signal).toEqual({
      event: { kind: 'contract', label: 'Fim do contrato', date: '2026-10-10' },
      timing: 'passed',
      days: 4,
      timingLabel: 'Passou há 4 dias',
      action: 'Confirma o estado atual do contrato e corrige a data se renovou.'
    })
    expect(buildContractDecisionSignal([], '2026-10-14')).toBeNull()
  })

  it('prepara a decisão de telecomunicações apenas com evidência do contrato atual', () => {
    expect(buildContractDecisionDossier(expense())).toEqual({
      title: 'Leva estes factos para a conversa',
      evidence: [
        'Última fatura ou extrato com o valor atual',
        'Resumo do contrato com fidelização e serviços incluídos',
        'Linhas, equipamentos e extras que aparecem na fatura'
      ],
      rule: 'Serve para confirmar condições. Não estima nem confirma poupanças.'
    })
  })

  it('torna a preparação de seguros auditável por coberturas e condições', () => {
    const insurance = expense({
      category: 'insurance',
      details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-11-15', coverageCodes: ['building'] }
    })

    expect(buildContractDecisionDossier(insurance).evidence).toEqual([
      'Último recibo ou aviso com o prémio atual',
      'Condições particulares com capitais, coberturas, exclusões e franquias',
      'Aviso de renovação, se já foi recebido'
    ])
  })

  it('cria um guião de chamada com factos atuais e perguntas, sem calcular poupanças', () => {
    expect(buildContractCallGuide(expense(), [
      { kind: 'commitment', label: 'Fim da fidelização', date: '2026-04-01' },
      { kind: 'contract', label: 'Fim do contrato', date: '2027-01-31' }
    ])).toEqual({
      currentMonthlyCents: 4890,
      annualEquivalentCents: 58_680,
      nextDeclaredDate: { kind: 'commitment', label: 'Fim da fidelização', date: '2026-04-01' },
      questions: [
        'Qual é o preço final mensal, já com equipamentos e extras?',
        'Que serviços, linhas e velocidades ficam incluídos?',
        'Existe nova fidelização e qual é a data exata de termo?'
      ],
      rule: 'Regista a resposta como proposta. Só um novo custo aceite e observado confirma poupança.'
    })
  })

  it('compara o custo total de uma proposta com o contrato atual sem confirmar poupança', () => {
    expect(compareContractProposal({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 3990,
      oneOffCents: 5000,
      commitmentMonths: 24
    })).toEqual({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 3990,
      oneOffCents: 5000,
      commitmentMonths: 24,
      currentPeriodCents: 117360,
      proposedPeriodCents: 100760,
      firstMonthCents: 8990,
      firstMonthDifferenceCents: -4100,
      firstPeriodMonths: 12,
      firstPeriodCents: 52_880,
      firstPeriodDifferenceCents: 5_800,
      proposedMonthlyEquivalentCents: 4198,
      recurringDifferenceCents: 900,
      maximumMonthlyCentsForNoIncrease: 4681,
      breakEvenMonth: 6,
      periodDifferenceCents: 16600,
      outcome: 'lower',
      rule: 'Comparação condicional: assume o custo atual constante durante o período; não confirma poupança.'
    })
  })

  it('calcula propostas com preço promocional sem prolongar o desconto até ao fim da fidelização', () => {
    expect(compareContractProposal({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 2990,
      oneOffCents: 3000,
      commitmentMonths: 24,
      introductoryMonths: 6,
      laterMonthlyCents: 4590
    })).toMatchObject({
      introductoryMonths: 6,
      laterMonthlyCents: 4590,
      laterPeriodMonths: 18,
      laterAnnualCents: 55_080,
      laterAnnualDifferenceCents: 3_600,
      firstPeriodMonths: 12,
      firstPeriodCents: 48_480,
      firstPeriodDifferenceCents: 10_200,
      proposedPeriodCents: 103_560,
      proposedMonthlyEquivalentCents: 4315,
      laterRecurringDifferenceCents: 300,
      maximumMonthlyCentsForNoIncrease: 5356,
      periodDifferenceCents: 13_800,
      outcome: 'lower'
    })
  })

  it('expõe o custo real do primeiro ano incluindo promoção e custo único', () => {
    expect(compareContractProposal({
      currentMonthlyCents: 5000,
      proposedMonthlyCents: 2500,
      oneOffCents: 6000,
      commitmentMonths: 24,
      introductoryMonths: 3,
      laterMonthlyCents: 5500
    })).toMatchObject({
      firstPeriodMonths: 12,
      firstPeriodCents: 63_000,
      firstPeriodDifferenceCents: -3_000
    })

    expect(compareContractProposal({
      currentMonthlyCents: 5000,
      proposedMonthlyCents: 4000,
      oneOffCents: 1000,
      commitmentMonths: 6
    })).toMatchObject({
      firstPeriodMonths: 6,
      firstPeriodCents: 25_000,
      firstPeriodDifferenceCents: 5_000
    })
  })

  it('expõe o esforço de tesouraria do primeiro mês sem o diluir no equivalente mensal', () => {
    expect(compareContractProposal({
      currentMonthlyCents: 5000,
      proposedMonthlyCents: 3500,
      oneOffCents: 9000,
      commitmentMonths: 24
    })).toMatchObject({
      firstMonthCents: 12_500,
      firstMonthDifferenceCents: -7_500,
      outcome: 'lower'
    })
  })

  it('inclui o custo confirmado de saída do contrato atual no esforço inicial e no custo total da mudança', () => {
    expect(compareContractProposal({
      currentMonthlyCents: 5000,
      proposedMonthlyCents: 4000,
      oneOffCents: 2000,
      exitCostCents: 12_000,
      commitmentMonths: 24
    })).toMatchObject({
      exitCostCents: 12_000,
      firstMonthCents: 18_000,
      firstMonthDifferenceCents: -13_000,
      proposedPeriodCents: 110_000,
      periodDifferenceCents: 10_000,
      outcome: 'lower'
    })
  })

  it('expõe quando o preço posterior à promoção fica acima do contrato atual', () => {
    expect(compareContractProposal({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 2990,
      oneOffCents: 0,
      commitmentMonths: 24,
      introductoryMonths: 6,
      laterMonthlyCents: 5290
    })).toMatchObject({
      laterRecurringDifferenceCents: -400,
      laterAnnualCents: 63_480,
      laterAnnualDifferenceCents: -4_800,
      accumulatedAdvantageExhaustedMonth: null,
      maximumMonthlyCentsForNoIncrease: 5523,
      outcome: 'lower'
    })
  })

  it('indica o mês em que um preço posterior mais alto esgota a vantagem promocional acumulada', () => {
    expect(compareContractProposal({
      currentMonthlyCents: 5000,
      proposedMonthlyCents: 3000,
      oneOffCents: 0,
      commitmentMonths: 12,
      introductoryMonths: 3,
      laterMonthlyCents: 6000
    })).toMatchObject({
      accumulatedAdvantageExhaustedMonth: 9,
      periodDifferenceCents: -3_000,
      outcome: 'higher'
    })
  })

  it('indica quando nem uma mensalidade gratuita compensa o custo único', () => {
    expect(compareContractProposal({
      currentMonthlyCents: 1000,
      proposedMonthlyCents: 0,
      oneOffCents: 13_000,
      commitmentMonths: 12
    })).toMatchObject({
      maximumMonthlyCentsForNoIncrease: null,
      outcome: 'higher'
    })
  })

  it('transforma uma proposta mais cara numa única contraproposta verificável', () => {
    const comparison = compareContractProposal({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 4690,
      oneOffCents: 5000,
      commitmentMonths: 12
    })

    expect(buildContractProposalDecision(comparison)).toEqual({
      tone: 'stop',
      title: 'Não aceitar nestas condições',
      action: 'Pede uma mensalidade de 44,73 € ou menos, mantendo os restantes valores declarados.',
      rule: 'É uma contraproposta calculada, não uma poupança confirmada.'
    })
  })

  it('põe o preço posterior em primeiro lugar quando a promoção esconde um agravamento', () => {
    const comparison = compareContractProposal({
      currentMonthlyCents: 5000,
      proposedMonthlyCents: 3000,
      oneOffCents: 0,
      commitmentMonths: 12,
      introductoryMonths: 3,
      laterMonthlyCents: 6000
    })

    expect(buildContractProposalDecision(comparison)).toEqual({
      tone: 'negotiate',
      title: 'Negociar o preço depois da promoção',
      action: 'Pede que a mensalidade posterior não ultrapasse 50,00 €. Com os valores declarados, a vantagem acumulada esgota-se no 9.º mês.',
      rule: 'É um limite condicional para negociar, não uma poupança confirmada.'
    })
  })

  it('manda confirmar por escrito quando o custo total é inferior sem agravamento posterior', () => {
    const comparison = compareContractProposal({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 3990,
      oneOffCents: 0,
      commitmentMonths: 24
    })

    expect(buildContractProposalDecision(comparison)).toEqual({
      tone: 'verify',
      title: 'Confirmar antes de decidir',
      action: 'Pede por escrito o preço final, os serviços incluídos, os custos únicos e a data exata de fim da fidelização.',
      rule: 'A comparação é favorável, mas só um novo custo aceite e observado confirma poupança.'
    })
  })

  it('cria uma nota copiável com os valores declarados e uma única próxima ação', () => {
    const comparison = compareContractProposal({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 4690,
      oneOffCents: 5000,
      commitmentMonths: 12
    })

    expect(buildContractProposalActionNote(comparison)).toBe([
      'Proposta em análise',
      'Mensalidade declarada: 46,90 €',
      'Custo único declarado: 50,00 €',
      'Período comparado: 12 meses',
      'Custo total declarado: 612,80 €',
      'Próxima ação: Não aceitar nestas condições — Pede uma mensalidade de 44,73 € ou menos, mantendo os restantes valores declarados.',
      'Estado: proposta não aceite; não é uma poupança confirmada.'
    ].join('\n'))
  })

  it('torna a validade da proposta um facto obrigatório e trava decisões sobre propostas expiradas', () => {
    expect(buildContractProposalValidity({
      validUntil: '',
      validityUndeclared: false,
      civilDate: '2026-10-28'
    })).toMatchObject({
      ready: false,
      status: 'missing',
      action: 'Indica a validade da proposta ou confirma que o documento não a declara.'
    })

    const expired = buildContractProposalValidity({
      validUntil: '2026-10-20',
      validityUndeclared: false,
      civilDate: '2026-10-28'
    })
    expect(expired).toMatchObject({
      ready: true,
      status: 'expired',
      days: -8,
      label: 'Expirou há 8 dias'
    })

    const comparison = compareContractProposal({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 3990,
      oneOffCents: 0,
      commitmentMonths: 24
    })
    expect(buildContractProposalDecision(comparison, expired)).toEqual({
      tone: 'stop',
      title: 'Pedir proposta atualizada',
      action: 'A validade declarada terminou em 20/10/2026. Pede os mesmos valores e condições por escrito numa proposta ainda válida.',
      rule: 'Não uses uma proposta expirada para decidir nem para confirmar poupança.'
    })
    expect(buildContractProposalActionNote(comparison, expired)).toContain('Validade declarada: 20/10/2026 · Expirou há 8 dias')
  })

  it('aceita validade não declarada sem a inventar e pede confirmação antes da decisão', () => {
    const validity = buildContractProposalValidity({
      validUntil: '',
      validityUndeclared: true,
      civilDate: '2026-10-28'
    })
    expect(validity).toMatchObject({
      ready: true,
      status: 'undeclared',
      validUntil: null,
      label: 'Validade não declarada'
    })

    const comparison = compareContractProposal({
      currentMonthlyCents: 4890,
      proposedMonthlyCents: 3990,
      oneOffCents: 0,
      commitmentMonths: 24
    })
    expect(buildContractProposalDecision(comparison, validity)).toMatchObject({
      tone: 'verify',
      title: 'Confirmar validade da proposta'
    })
  })

  it('bloqueia a comparação até confirmar preço final, âmbito, prazo e custos iniciais da proposta', () => {
    expect(buildContractProposalReadiness({
      finalPriceConfirmed: true,
      scopeCompared: false,
      commitmentTermsConfirmed: false,
      upfrontCostsConfirmed: true,
      pricePath: 'stable'
    })).toEqual({
      ready: false,
      missing: ['Serviços ou condições incluídos comparados', 'Fidelização, renovação e cancelamento confirmados'],
      action: 'Compara os serviços ou condições incluídos com o contrato atual.',
      rule: 'Sem estes factos, uma mensalidade isolada não permite uma comparação auditável.'
    })

    expect(buildContractProposalReadiness({
      finalPriceConfirmed: true,
      scopeCompared: true,
      commitmentTermsConfirmed: true,
      upfrontCostsConfirmed: true,
      pricePath: 'stable'
    })).toEqual({
      ready: true,
      missing: [],
      action: 'Os factos essenciais da proposta foram confirmados; já podes comparar os custos declarados.',
      rule: 'A comparação continua condicional e não confirma poupança.'
    })

    expect(buildContractProposalReadiness({
      finalPriceConfirmed: true,
      scopeCompared: true,
      commitmentTermsConfirmed: true,
      upfrontCostsConfirmed: false,
      pricePath: 'stable'
    })).toEqual({
      ready: false,
      missing: ['Custos únicos e custo de saída confirmados'],
      action: 'Confirma os custos únicos da proposta e o custo para sair do contrato atual, mesmo quando sejam zero.',
      rule: 'Sem estes factos, uma mensalidade isolada não permite uma comparação auditável.'
    })
  })

  it('exige declarar explicitamente se o preço se mantém ou muda durante o período comparado', () => {
    expect(buildContractProposalReadiness({
      finalPriceConfirmed: true,
      scopeCompared: true,
      commitmentTermsConfirmed: true,
      upfrontCostsConfirmed: true,
      pricePath: null
    })).toEqual({
      ready: false,
      missing: ['Trajetória do preço durante o período comparado declarada'],
      action: 'Declara se o preço se mantém durante todo o período ou se muda numa data prevista.',
      rule: 'Sem estes factos, uma mensalidade isolada não permite uma comparação auditável.'
    })

    const complete = {
      finalPriceConfirmed: true,
      scopeCompared: true,
      commitmentTermsConfirmed: true,
      upfrontCostsConfirmed: true
    }
    expect(buildContractProposalReadiness({ ...complete, pricePath: 'stable' }).ready).toBe(true)
    expect(buildContractProposalReadiness({ ...complete, pricePath: 'changes' }).ready).toBe(true)
  })

  it('bloqueia a comparação monetária de seguros até a proposta ter condições comparáveis', () => {
    expect(buildInsuranceProposalReadiness({
      equivalentInsuredScope: true,
      comparableCoverage: false,
      comparableDeductibles: false
    })).toEqual({
      ready: false,
      missing: ['Coberturas e exclusões comparadas', 'Franquias e condições de pagamento comparadas'],
      action: 'Compara as coberturas e exclusões da proposta com o contrato atual.',
      rule: 'Sem condições suficientemente equivalentes, não calculamos uma possível diferença de custo.'
    })

    expect(buildInsuranceProposalReadiness({
      equivalentInsuredScope: true,
      comparableCoverage: true,
      comparableDeductibles: true
    })).toEqual({
      ready: true,
      missing: [],
      action: 'As condições essenciais foram declaradas como comparáveis; já podes comparar os custos.',
      rule: 'A comparação continua condicional e não confirma poupança.'
    })
  })

  it('assinala propostas mais caras, não inventa ponto de equilíbrio e rejeita valores monetários inseguros', () => {
    expect(compareContractProposal({ currentMonthlyCents: 2000, proposedMonthlyCents: 2100, oneOffCents: 0, commitmentMonths: 12 })).toMatchObject({
      outcome: 'higher',
      recurringDifferenceCents: -100,
      breakEvenMonth: null
    })
    expect(compareContractProposal({ currentMonthlyCents: 2000, proposedMonthlyCents: 2000, oneOffCents: 0, commitmentMonths: 12 })).toMatchObject({
      outcome: 'same',
      breakEvenMonth: null
    })
    expect(() => compareContractProposal({ currentMonthlyCents: 2000, proposedMonthlyCents: Number.MAX_SAFE_INTEGER, oneOffCents: 0, commitmentMonths: 12 })).toThrow(/Valor monetário inválido/)
    expect(() => compareContractProposal({ currentMonthlyCents: 2000, proposedMonthlyCents: 1900, oneOffCents: 0, exitCostCents: -1, commitmentMonths: 12 })).toThrow(/Valor monetário inválido/)
    expect(() => compareContractProposal({ currentMonthlyCents: 2000, proposedMonthlyCents: 1900, oneOffCents: 0, commitmentMonths: 0 })).toThrow(/Duração inválida/)
    expect(() => compareContractProposal({ currentMonthlyCents: 2000, proposedMonthlyCents: 1900, oneOffCents: 0, commitmentMonths: 12, introductoryMonths: 3 })).toThrow(/preço posterior/i)
    expect(() => compareContractProposal({ currentMonthlyCents: 2000, proposedMonthlyCents: 1900, oneOffCents: 0, commitmentMonths: 12, introductoryMonths: 13, laterMonthlyCents: 2000 })).toThrow(/Duração promocional inválida/)
  })
})
