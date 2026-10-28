import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('detalhe do contrato', () => {
  it('apresenta uma linha de vida auditável e mantém custo, variações e datas semanticamente separados', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toContain('buildExpenseLifecycle')
    expect(page).toMatch(/Equivalente anual/i)
    expect(page).toMatch(/não é uma cobrança adicional/i)
    expect(page).toMatch(/Linha de vida da despesa/i)
    expect(page).toMatch(/Variação confirmada/i)
    expect(page).toMatch(/Evolução entre valores observados/i)
    expect(page).toMatch(/impacto anual ao ritmo atual/i)
    expect(page).toMatch(/lifecycle!\.observedChange/)
    expect(page).toMatch(/Datas para decidir/i)
    expect(page).toMatch(/Renovação, fidelização e fim de contrato são eventos diferentes/i)
    expect(page).not.toMatch(/poupança confirmada\s*[:—-]/i)
  })

  it('permite registar um novo valor observado sem o apresentar como poupança confirmada', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Registar novo valor observado/i)
    expect(page).toMatch(/method:\s*'PATCH'/)
    expect(page).toMatch(/monthlyCostCents/)
    expect(page).toMatch(/fica na linha de vida/i)
    expect(page).toMatch(/não confirma uma poupança/i)
    expect(page).toMatch(/Novo valor em EUR/i)
  })

  it('permite corrigir os prazos contratuais sem os confundir com custos ou poupanças', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Editar datas/i)
    expect(page).toMatch(/Fim da fidelização/i)
    expect(page).toMatch(/Fim do contrato/i)
    expect(page).toMatch(/Próxima renovação/i)
    expect(page).toMatch(/buildContractAgendaPatch/)
    expect(page).toMatch(/factos declarados/i)
  })

  it('transforma a agenda declarada num próximo passo concreto sem estimar poupanças', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Próximo prazo declarado/i)
    expect(page).toMatch(/buildContractDecisionSignal/)
    expect(page).toMatch(/decisionSignal\.action/)
    expect(page).toMatch(/Não altera custos nem confirma poupanças/i)
  })

  it('mostra um dossiê curto de factos para preparar a conversa com o fornecedor', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildContractDecisionDossier/)
    expect(page).toMatch(/Preparar a decisão/i)
    expect(page).toMatch(/decisionDossier\.evidence/)
    expect(page).toMatch(/decisionDossier\.rule/)
  })

  it('oferece um guião copiável com custo atual, prazo declarado e perguntas verificáveis', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildContractCallGuide/)
    expect(page).toMatch(/Guião para falar com o fornecedor/i)
    expect(page).toMatch(/Custo atual declarado/i)
    expect(page).toMatch(/Copiar guião/i)
    expect(page).toMatch(/navigator\.clipboard\.writeText/)
    expect(page).toMatch(/callGuide\.rule/)
  })

  it('compara uma proposta recebida pelo custo total sem a tratar como aceite', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/compareContractProposal/)
    expect(page).toMatch(/Comparar proposta recebida/i)
    expect(page).toMatch(/Custo único/i)
    expect(page).toMatch(/O preço aumenta durante a fidelização/i)
    expect(page).toMatch(/Meses ao preço inicial/i)
    expect(page).toMatch(/Mensalidade posterior/i)
    expect(page).toMatch(/Preço inicial/i)
    expect(page).toMatch(/Preço posterior/i)
    expect(page).toMatch(/Custo anual depois da promoção/i)
    expect(page).toMatch(/por ano face ao custo atual declarado/i)
    expect(page).toMatch(/Custo nos primeiros/i)
    expect(page).toMatch(/inclui o custo único/i)
    expect(page).toMatch(/face ao custo atual no mesmo período/i)
    expect(page).toMatch(/Custo no 1.º mês/i)
    expect(page).toMatch(/esforço inicial/i)
    expect(page).toMatch(/mais do que o custo atual no primeiro mês/i)
    expect(page).toMatch(/Depois da promoção/i)
    expect(page).toMatch(/acima do custo atual declarado/i)
    expect(page).toMatch(/vantagem acumulada começa a diminuir/i)
    expect(page).toMatch(/vantagem acumulada esgota-se/i)
    expect(page).toMatch(/não se esgota nos meses comparados/i)
    expect(page).toMatch(/Total no período/i)
    expect(page).toMatch(/Ponto de equilíbrio/i)
    expect(page).toMatch(/Custos únicos recuperados/i)
    expect(page).toMatch(/Limite para não pagar mais/i)
    expect(page).toMatch(/mensalidade posterior máxima/i)
    expect(page).toMatch(/nem uma mensalidade de 0/i)
    expect(page).toMatch(/Proposta em análise/i)
    expect(page).toMatch(/não é uma poupança confirmada/i)
  })

  it('fecha a comparação com uma única próxima ação condicional e verificável', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildContractProposalDecision/)
    expect(page).toMatch(/Próxima ação para esta proposta/i)
    expect(page).toMatch(/proposalDecision\.title/)
    expect(page).toMatch(/proposalDecision\.action/)
    expect(page).toMatch(/proposalDecision\.rule/)
  })
})
