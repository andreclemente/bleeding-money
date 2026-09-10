import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { cohortFrom, detailsFrom, goalFrom, householdFrom, spendPeriodFrom } from '../../server/db/postgres-repository'

const periodRow = {
  id: '10000000-0000-4000-8000-000000000010', user_id: '10000000-0000-4000-8000-000000000001',
  month: '2026-08-01', status: 'complete', supermarket_coverage: 'food_only', amount_basis: 'statement_or_receipts',
  country: 'PT', adults: 2, dependents: 1, adult_band: '2', dependent_band: '1',
  created_at: '2026-08-31T10:00:00Z', updated_at: '2026-08-31T10:00:00Z'
}
const amount = { id: '10000000-0000-4000-8000-000000000011', periodId: periodRow.id, category: 'supermarket_total' as const, scope: 'supermarket' as const, amountCents: 50000, trackingIntent: 'track_only' as const }
const cohortRow = { id: '10000000-0000-4000-8000-000000000012', category: 'supermarket_total', scope: 'supermarket', country: 'PT', adult_band: '2', dependent_band: '1', supermarket_coverage: 'food_only', amount_basis: 'statement_or_receipts', status: 'complete', window_start: '2026-01-01', window_end: '2026-08-31', household_count: 10, p25_cents: 30000, median_cents: 40000, p75_cents: 50000, source: 'fixture', confidence: 0.8 }

describe('paridade PostgreSQL fail-closed', () => {
  it('migra, valida e isola o objetivo familiar por utilizador', async () => {
    const migration = await readFile(new URL('../../drizzle/0006_savings_goal.sql', import.meta.url), 'utf8')
    const repository = await readFile(new URL('../../server/db/postgres-repository.ts', import.meta.url), 'utf8')
    expect(migration).toMatch(/create table "savings_goals"/i)
    expect(migration).toMatch(/unique[^\n]+"user_id"/i)
    expect(migration).toMatch(/target_annual_cents[^\n]+> 0/i)
    expect(repository).toMatch(/where user_id=\$1/i)
    expect(goalFrom({ id: '10000000-0000-4000-8000-000000000020', user_id: periodRow.user_id, name: 'Reserva', target_annual_cents: 120000, created_at: periodRow.created_at, updated_at: periodRow.updated_at })).toMatchObject({ name: 'Reserva', targetAnnualCents: 120000 })
    expect(() => goalFrom({ id: 'x', user_id: periodRow.user_id, name: '', target_annual_cents: -1, created_at: periodRow.created_at, updated_at: periodRow.updated_at })).toThrow(/PostgreSQL/i)
  })

  it('fecha concorrência de findings e restringe todas as coberturas na base de dados', async () => {
    const repository = await readFile(new URL('../../server/db/postgres-repository.ts', import.meta.url), 'utf8')
    const migration = await readFile(new URL('../../drizzle/0005_condemned_tiger_shark.sql', import.meta.url), 'utf8')
    expect(repository).toMatch(/pg_advisory_xact_lock/)
    expect(repository).toMatch(/on conflict \(expense_id,type\) where status='open' do update/i)
    const dismissal = repository.slice(repository.indexOf('async dismissFinding'), repository.indexOf('async listActions'))
    expect(dismissal).toMatch(/pool\.connect\(\)/)
    expect(dismissal).toMatch(/pg_advisory_xact_lock/)
    expect(dismissal).toMatch(/commit/)
    expect(migration).toMatch(/valid_insurance_coverages/)
    expect(migration).toMatch(/count\(distinct value\)/i)
    expect(migration).toMatch(/travel_assistance/)
    expect(repository).toMatch(/estimated_monthly_saving_max_cents[\s\S]+não tem uma poupança estimada/i)
  })

  it('faz upsert dos detalhes ao converter seguros legados e obtém o lock de utilizador primeiro', async () => {
    const repository = await readFile(new URL('../../server/db/postgres-repository.ts', import.meta.url), 'utf8')
    const writeDetails = repository.slice(repository.indexOf('private async writeDetails'), repository.indexOf('private async analyze('))
    expect(writeDetails).toMatch(/insert into insurance_details[\s\S]+on conflict \(expense_id\) do update/i)
    const updateExpense = repository.slice(repository.indexOf('async updateExpense'), repository.indexOf('async listFindings'))
    expect(updateExpense.indexOf('pg_advisory_xact_lock')).toBeGreaterThan(-1)
    expect(updateExpense.indexOf('pg_advisory_xact_lock')).toBeLessThan(updateExpense.indexOf('for update'))
  })

  it('reconstitui os dados auditáveis de seguro e rejeita cobertura corrompida', () => {
    expect(detailsFrom({ category: 'insurance', policy_type: 'home', renewal_date: '2026-11-15', coverage_codes: ['building', 'contents'] })).toEqual({ kind: 'insurance', policyType: 'home', renewalDate: '2026-11-15', coverageCodes: ['building', 'contents'] })
    expect(() => detailsFrom({ category: 'insurance', policy_type: 'home', renewal_date: '2026-11-15', coverage_codes: ['invented'] })).toThrow(/PostgreSQL/i)
  })
  it('rejeita país, composição, bandas e montantes/intenções armazenados inválidos', () => {
    expect(() => householdFrom({ user_id: periodRow.user_id, adults: 2, dependents: 1, country: 'ES', effective_at: '2026-01-01', updated_at: periodRow.updated_at })).toThrow(/PostgreSQL/i)
    expect(() => spendPeriodFrom({ ...periodRow, country: 'ES' }, [amount])).toThrow(/PostgreSQL/i)
    expect(() => spendPeriodFrom({ ...periodRow, adult_band: '1' }, [amount])).toThrow(/PostgreSQL/i)
    expect(() => spendPeriodFrom(periodRow, [{ ...amount, amountCents: -1 }])).toThrow(/PostgreSQL/i)
    expect(() => spendPeriodFrom(periodRow, [{ ...amount, trackingIntent: 'reduce' }])).toThrow(/PostgreSQL/i)
  })

  it('rejeita coortes com país, contagem, percentis ou confiança inválidos', () => {
    expect(() => cohortFrom({ ...cohortRow, country: 'ES' })).toThrow(/PostgreSQL/i)
    expect(() => cohortFrom({ ...cohortRow, household_count: -1 })).toThrow(/PostgreSQL/i)
    expect(() => cohortFrom({ ...cohortRow, median_cents: 60000 })).toThrow(/PostgreSQL/i)
    expect(() => cohortFrom({ ...cohortRow, confidence: 2 })).toThrow(/PostgreSQL/i)
    expect(() => cohortFrom({ ...cohortRow, amount_basis: 'guess' })).toThrow(/PostgreSQL/i)
    expect(() => cohortFrom({ ...cohortRow, status: 'draft' })).toThrow(/PostgreSQL/i)
    expect(() => cohortFrom({ ...cohortRow, scope: 'everywhere' })).toThrow(/PostgreSQL/i)
  })

  it('migra dimensões exatas e constraints antes de expor coortes', async () => {
    const migration = await readFile(new URL('../../drizzle/0003_dazzling_lucky_pierre.sql', import.meta.url), 'utf8')
    expect(migration).toMatch(/spend_cohort_aggregates[\s\S]+"scope" "spend_scope" not null/i)
    expect(migration).toMatch(/spend_cohort_aggregates[\s\S]+"amount_basis" "spend_amount_basis" not null/i)
    expect(migration).toMatch(/spend_cohort_aggregates[\s\S]+"status" "spend_status" not null/i)
    expect(migration).toMatch(/spend_cohort_exact_match_idx[\s\S]+"category","scope","country","adult_band","dependent_band","supermarket_coverage","amount_basis","status","window_end"/i)
    expect(migration).toMatch(/monthly_spend_amount_target_intent_check/i)
    expect(migration).toMatch(/monthly_spend_periods_bands_check/i)
  })

  it('usa upsert atómico e lê períodos e montantes num único snapshot SQL', async () => {
    const source = await readFile(new URL('../../server/db/postgres-repository.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/insert into monthly_spend_periods[\s\S]+on conflict \(user_id,month\) do update[\s\S]+returning \*/i)
    expect(source).toMatch(/from monthly_spend_periods p left join monthly_spend_amounts a/i)
    expect(source).not.toMatch(/Promise\.all\(\[\s*this\.pool\.query\('select \* from monthly_spend_periods/i)
  })

  it('migra categorias e âmbito de habitação como contexto neutro', async () => {
    const migration = await readFile(new URL('../../drizzle/0004_housing_context.sql', import.meta.url), 'utf8')
    const snapshot = await readFile(new URL('../../drizzle/meta/0004_snapshot.json', import.meta.url), 'utf8')
    expect(migration).toMatch(/alter type "public"\."spend_category" add value 'rent'/i)
    expect(migration).toMatch(/alter type "public"\."spend_category" add value 'mortgage_payment'/i)
    expect(migration).toMatch(/alter type "public"\."spend_category" add value 'condominium_fee'/i)
    expect(migration).toMatch(/alter type "public"\."spend_scope" add value 'housing'/i)
    expect(migration).toMatch(/monthly_spend_amount_housing_context_check/i)
    expect(migration).toMatch(/"category"::text in \('rent','mortgage_payment','condominium_fee'\)/i)
    expect(migration).toMatch(/"scope"::text = 'housing'/i)
    expect(snapshot).toMatch(/monthly_spend_amount_housing_context_check/i)
  })
})