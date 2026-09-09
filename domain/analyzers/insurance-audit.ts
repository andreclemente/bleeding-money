import { createFinding } from '../finding'
import type { InsuranceCoverageCode, RecurringExpense, SavingsAnalyzer, SavingsContext } from '../types'

export const insuranceCoverageLabels: Record<InsuranceCoverageCode, string> = {
  civil_liability: 'Responsabilidade civil',
  own_damage: 'Danos próprios',
  building: 'Edifício',
  contents: 'Conteúdo/recheio',
  hospitalization: 'Hospitalização',
  outpatient: 'Ambulatório',
  death: 'Morte',
  disability: 'Invalidez',
  travel_assistance: 'Assistência em viagem'
}

const dayMs = 86_400_000
const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`)

export class InsuranceAuditAnalyzer implements SavingsAnalyzer {
  supports(expense: RecurringExpense) {
    return expense.category === 'insurance' && expense.details.kind === 'insurance'
  }

  async analyze(expense: RecurringExpense, context: SavingsContext) {
    if (expense.details.kind !== 'insurance') return []
    const findings = []
    const renewalDate = expense.details.renewalDate
    if (renewalDate) {
      const today = utcDate(context.now.toISOString().slice(0, 10))
      const days = Math.ceil((utcDate(renewalDate).getTime() - today.getTime()) / dayMs)
      if (days >= 0 && days <= 45) {
        findings.push(createFinding({
          expenseId: expense.id,
          type: 'CONTRACT_EXPIRING',
          title: 'Rever o seguro antes da renovação',
          description: `A renovação está prevista para ${renewalDate}. Este aviso não pressupõe que exista uma opção mais barata.`,
          minCents: 0,
          maxCents: 0,
          confidence: 1,
          severity: 'info',
          effort: 'low',
          urgency: days <= 15 ? 'high' : 'medium',
          action: 'Confirmar prémio, coberturas, exclusões e franquias antes de aceitar a renovação.',
          evidence: [`Data de renovação declarada: ${renewalDate}`, `Custo mensal equivalente declarado: ${(expense.monthlyCostCents / 100).toFixed(2)} EUR`, 'Poupança estimada: indisponível sem uma proposta comparável.'],
          now: context.now
        }))
      }
    }

    if (expense.details.coverageCodes.length) {
      const policyType = expense.details.policyType
      const coverageCodes = expense.details.coverageCodes
      const overlaps = context.expenses.flatMap(other => {
        if (other.id === expense.id || other.category !== 'insurance' || other.details.kind !== 'insurance' || other.details.policyType !== policyType) return []
        const common = coverageCodes.filter(code => other.details.kind === 'insurance' && other.details.coverageCodes.includes(code))
        return common.length ? [{ other, common }] : []
      })
      if (overlaps.length) {
        const evidence = overlaps.flatMap(({ other, common }) => common.map(code => `${insuranceCoverageLabels[code]} também declarada em “${other.productName}”.`))
        findings.push(createFinding({
          expenseId: expense.id,
          type: 'DUPLICATE_SERVICE',
          title: 'Cobertura possivelmente duplicada',
          description: 'Há coberturas com o mesmo nome noutro seguro teu. Isto é um pedido de verificação, não prova de duplicação nem de desperdício.',
          minCents: 0,
          maxCents: 0,
          confidence: 0.7,
          severity: 'info',
          effort: 'medium',
          urgency: 'low',
          action: 'Comparar capitais, pessoas ou bens cobertos, exclusões e franquias nas apólices antes de alterar qualquer contrato.',
          evidence: [...evidence, 'Poupança estimada: indisponível até confirmares uma duplicação e uma redução real.'],
          now: context.now
        }))
      }
    }
    return findings
  }
}
