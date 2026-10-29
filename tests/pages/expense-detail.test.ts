import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('detalhe do contrato', () => {
  it('liga cada redução confirmada ao contrato, custo anterior e novo custo observado', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Reduções deste contrato/i)
    expect(page).toContain('confirmedReductions')
    expect(page).toContain('action.previousCostCents')
    expect(page).toContain('action.newCostCents')
    expect(page).toContain('action.annualSavingCents')
    expect(page).toMatch(/apenas custos inferiores já observados/i)
  })

  it('abre diretamente o editor de agenda quando a fila de contratos o pede', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/route\.query\.edit\s*===\s*'agenda'/)
    expect(page).toMatch(/openAgendaEditor\(\)/)
  })

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
    expect(page).toMatch(/Retirar esta data/i)
    expect(page).toMatch(/documento não confirma/i)
    expect(page).toMatch(/clearCommitmentEndDate/)
    expect(page).toMatch(/clearRenewalDate/)
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
    expect(page).toMatch(/Muda durante o período/i)
    expect(page).toMatch(/Meses ao preço inicial/i)
    expect(page).toMatch(/Mensalidade posterior/i)
    expect(page).toMatch(/Preço inicial/i)
    expect(page).toMatch(/Preço posterior/i)
    expect(page).toMatch(/Custo anual depois da promoção/i)
    expect(page).toMatch(/por ano face ao custo atual declarado/i)
    expect(page).toMatch(/Custo nos primeiros/i)
    expect(page).toMatch(/inclui custos únicos, saída e (?:eventual )?sobreposição/i)
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
    expect(page).toMatch(/Custos iniciais recuperados/i)
    expect(page).toMatch(/Limite para não pagar mais/i)
    expect(page).toMatch(/mensalidade posterior máxima/i)
    expect(page).toMatch(/nem uma mensalidade de 0/i)
    expect(page).toMatch(/Proposta em análise/i)
    expect(page).toMatch(/não é uma poupança confirmada/i)
  })

  it('identifica o fornecedor e o plano antes de comparar ou copiar uma proposta', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Identificar proposta/i)
    expect(page).toMatch(/Fornecedor proposto/i)
    expect(page).toMatch(/Plano ou referência da proposta/i)
    expect(page).toMatch(/proposalProvider/)
    expect(page).toMatch(/proposalProduct/)
    expect(page).toMatch(/Fornecedor e plano declarados/i)
    expect(page).toMatch(/buildContractProposalActionNote\(proposalComparison\.value, proposalValidity\.value, proposalIdentity\.value/)
  })

  it('identifica o contrato atual usado como base na comparação e na nota copiada', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Contrato atual comparado/i)
    expect(page).toMatch(/data\.value\.expense\.provider/)
    expect(page).toMatch(/data\.value\.expense\.productName/)
    expect(page).toMatch(/Custo atual declarado/i)
    expect(page).toMatch(/buildContractProposalActionNote\([\s\S]*currentContractIdentity/)
  })

  it('exige factos essenciais da proposta antes de comparar os números', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildContractProposalReadiness/)
    expect(page).toMatch(/Factos confirmados na proposta/i)
    expect(page).toMatch(/Preço final com impostos, descontos e extras confirmado/i)
    expect(page).toMatch(/Serviços ou condições incluídos comparados/i)
    expect(page).toMatch(/Fidelização, renovação e cancelamento confirmados/i)
    expect(page).toMatch(/Custos únicos, saída e sobreposição confirmados/i)
    expect(page).toMatch(/Trajetória do preço durante o período comparado/i)
    expect(page).toMatch(/Mantém-se durante todo o período/i)
    expect(page).toMatch(/Muda durante o período/i)
    expect(page).toMatch(/proposalPricePath\s*===\s*'changes'/)
    expect(page).not.toMatch(/v-model="proposalHasLaterPrice"/)
    expect(page).toMatch(/mesmo quando sejam zero/i)
    expect(page).toMatch(/Comparação bloqueada/i)
    expect(page).toMatch(/proposalReadiness\.ready/)
  })

  it('torna visível o custo confirmado de saída do contrato atual na comparação', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Custo para sair do contrato atual/i)
    expect(page).toMatch(/exitCostCents/)
    expect(page).toMatch(/Custo de saída confirmado/i)
    expect(page).toMatch(/inclui custos únicos, saída e (?:eventual )?sobreposição/i)
  })

  it('inclui uma sobreposição declarada quando os dois contratos são pagos em simultâneo', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Meses com ambos os contratos a pagar/i)
    expect(page).toMatch(/proposalOverlapMonths/)
    expect(page).toMatch(/overlapMonths/)
    expect(page).toMatch(/Custo de sobreposição confirmado/i)
    expect(page).toMatch(/não existe sobreposição/i)
  })

  it('exige uma validade declarada ou a ausência explícita desse facto antes de comparar', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildContractProposalValidity/)
    expect(page).toMatch(/Validade da proposta/i)
    expect(page).toMatch(/A proposta não indica uma data de validade/i)
    expect(page).toMatch(/proposalValidity\.ready/)
    expect(page).toMatch(/proposalValidity\.status/)
    expect(page).toMatch(/proposalDecision\.title/)
  })

  it('fecha a comparação com uma única próxima ação condicional e verificável', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildContractProposalDecision/)
    expect(page).toMatch(/Próxima ação para esta proposta/i)
    expect(page).toMatch(/proposalDecision\.title/)
    expect(page).toMatch(/proposalDecision\.action/)
    expect(page).toMatch(/proposalDecision\.rule/)
  })

  it('retira resultados desatualizados quando qualquer valor da proposta muda', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/proposalComparisonStatus/)
    expect(page).toMatch(/proposalMonthlyCost,[\s\S]*proposalOneOffCost,[\s\S]*proposalExitCost,[\s\S]*proposalCommitmentMonths,[\s\S]*proposalIntroductoryMonths,[\s\S]*proposalLaterMonthlyCost/)
    expect(page).toMatch(/hadComparison[\s\S]*proposalComparison\.value\s*=\s*null/)
    expect(page).toMatch(/Custo atual ou valores da proposta alterados\. Volta a comparar antes de usar estes resultados\./)
    expect(page).toMatch(/class="proposal-comparison__stale"/)
  })

  it('retira a comparação quando um novo custo atual é observado', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/currentMonthlyCostForComparison/)
    expect(page).toMatch(/watch\(\[[\s\S]*currentMonthlyCostForComparison/)
    expect(page).toMatch(/Custo atual ou valores da proposta alterados\. Volta a comparar antes de usar estes resultados\./)
  })

  it('permite levar a próxima ação e os valores declarados sem aceitar a proposta', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildContractProposalActionNote/)
    expect(page).toMatch(/Copiar próxima ação/i)
    expect(page).toMatch(/proposalActionStatus/)
    expect(page).toMatch(/navigator\.clipboard\.writeText/)
  })

  it('confirma no objetivo apenas uma proposta estável que já apareceu numa cobrança real', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Confirmar mudança já faturada/i)
    expect(page).toMatch(/Já confirmei esta mensalidade numa fatura ou extrato/i)
    expect(page).toMatch(/proposalObservedDate/)
    expect(page).toMatch(/:max="currentCivilDate"/)
    expect(page).toMatch(/não pode estar no futuro/i)
    expect(page).toMatch(/estimatedMonthlySavingMaxCents\s*>\s*0/)
    expect(page).toMatch(/\/api\/findings\/\$\{proposalFindingId\.value\}\/resolve/)
    expect(page).toMatch(/newCostCents:\s*proposalComparison\.value\.proposedMonthlyCents/)
    expect(page).toMatch(/proposalPricePath\.value\s*!==\s*'stable'/)
    expect(page).toMatch(/entrou na linha de vida e no objetivo/i)
    expect(page).toMatch(/preço por fases/i)
  })

  it('não calcula uma diferença de seguro antes de confirmar condições comparáveis', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildInsuranceProposalReadiness/)
    expect(page).toMatch(/Proposta de seguro comparável/i)
    expect(page).toMatch(/Capitais e pessoas ou bens cobertos equivalentes/i)
    expect(page).toMatch(/Coberturas e exclusões comparadas/i)
    expect(page).toMatch(/Franquias e condições de pagamento comparadas/i)
    expect(page).toMatch(/Comparação monetária bloqueada/i)
    expect(page).toMatch(/insuranceProposalReadiness\.ready/)
  })
})
