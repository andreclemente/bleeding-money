import pg from 'pg'
import { and, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { annualSaving } from '../../domain/savings'
import { findingCycleKey } from '../../domain/finding'
import { confirmedGoalProgress, parseSavingsGoalInput, type SavingsGoal, type SavingsGoalInput } from '../../domain/savings-goal'
import { adultBand, amountBases, dependentBand, parseHouseholdInput, parseMonthlySpendInput, spendCategories, spendScopes, spendStatuses, supermarketCoverages, trackingIntents, type AnonymousCohortAggregate, type HouseholdInput, type HouseholdProfile, type MonthlySpendInput, type MonthlySpendPeriod } from '../../domain/spending'
import type { ExpenseDetails, ExpenseSnapshot, MarketObservation, RecurringExpense, SavingAction, SavingsFinding } from '../../domain/types'
import type { StoredOwner, StoredSession } from '../auth/types'
import { parsePasswordHash } from '../auth/crypto'
import { createSavingsEngine } from '../services/savings-engine'
import { isIsoDate, parseExpenseCreateInput, parseExpensePatchInput, validateCommitmentDates, type ExpenseInput, type ExpensePatchInput, type PoupancasRepository } from './repository'
import { recurringExpenses, sessions, users } from './schema'

type Queryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>
const dateFrom = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}
const isoFrom = (value: unknown): string => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString()
const insurancePolicyTypes = ['car', 'home', 'health', 'life', 'other'] as const
const insuranceCoverageCodes = ['civil_liability', 'own_damage', 'building', 'contents', 'hospitalization', 'outpatient', 'death', 'disability', 'travel_assistance'] as const
export const detailsFrom = (row: Record<string, unknown>): ExpenseDetails => {
  if (row.category === 'electricity') return { kind: 'electricity', contractedPowerKva: Number(row.contracted_power_kva), tariffType: String(row.tariff_type), pricePerKwhCents: Number(row.price_per_kwh_cents), powerPricePerDayCents: Number(row.power_price_per_day_cents), annualConsumptionKwh: Number(row.annual_consumption_kwh), maxHistoricalPowerKva: Number(row.max_historical_power_kva) }
  if (row.category === 'telecom') return { kind: 'telecom', connectionType: String(row.connection_type), downloadSpeedMbps: Number(row.download_speed_mbps), uploadSpeedMbps: row.upload_speed_mbps === null ? undefined : Number(row.upload_speed_mbps), mobileDataGb: row.mobile_data_gb === null ? undefined : Number(row.mobile_data_gb), mobileLines: row.mobile_lines === null ? undefined : Number(row.mobile_lines), tvIncluded: row.tv_included === null ? undefined : Boolean(row.tv_included) }
  if (row.category === 'bank') return { kind: 'bank', accountMaintenanceFeeCents: Number(row.account_maintenance_fee_cents), cardAnnualFeeCents: Number(row.card_annual_fee_cents), transferFeesCents: Number(row.transfer_fees_cents) }
  if (row.category === 'subscription') return { kind: 'subscription', plan: String(row.plan), lastUsedAt: dateFrom(row.last_used_at), usageFrequency: row.usage_frequency === null ? undefined : String(row.usage_frequency) }
  if (row.category === 'insurance' && row.policy_type !== null && row.policy_type !== undefined) {
    if (!insurancePolicyTypes.includes(row.policy_type as typeof insurancePolicyTypes[number]) || !Array.isArray(row.coverage_codes) || !row.coverage_codes.every(value => insuranceCoverageCodes.includes(value as typeof insuranceCoverageCodes[number])) || new Set(row.coverage_codes).size !== row.coverage_codes.length) throw pgStoredError()
    return { kind: 'insurance', policyType: row.policy_type as typeof insurancePolicyTypes[number], renewalDate: dateFrom(row.renewal_date), coverageCodes: row.coverage_codes as typeof insuranceCoverageCodes[number][] }
  }
  return { kind: 'generic' }
}
const expenseFrom = (row: Record<string, unknown>): RecurringExpense => ({ id: String(row.id), userId: String(row.user_id), category: row.category as RecurringExpense['category'], provider: String(row.provider), productName: String(row.product_name), monthlyCostCents: Number(row.monthly_cost_cents), billingFrequency: row.billing_frequency as RecurringExpense['billingFrequency'], currency: String(row.currency), contractStartDate: dateFrom(row.contract_start_date), contractEndDate: dateFrom(row.contract_end_date), commitmentEndDate: dateFrom(row.commitment_end_date), details: detailsFrom(row), createdAt: isoFrom(row.created_at), updatedAt: isoFrom(row.updated_at) })
const snapshotFrom = (row: Record<string, unknown>): ExpenseSnapshot => ({ id: String(row.id), expenseId: String(row.expense_id), observedAt: dateFrom(row.observed_at)!, priceCents: Number(row.price_cents), plan: row.plan === null ? undefined : String(row.plan), properties: (row.properties || {}) as Record<string, unknown>, source: String(row.source) })
const observationFrom = (row: Record<string, unknown>): MarketObservation => ({ id: String(row.id), category: row.category as MarketObservation['category'], provider: String(row.provider), productType: String(row.product_type), attributes: row.attributes as MarketObservation['attributes'], monthlyPriceCents: Number(row.monthly_price_cents), negotiated: Boolean(row.negotiated), country: String(row.country), observedAt: dateFrom(row.observed_at)!, source: String(row.source), confidence: Number(row.confidence) })
const findingFrom = (row: Record<string, unknown>): SavingsFinding => ({ id: String(row.id), expenseId: String(row.expense_id), type: row.type as SavingsFinding['type'], title: String(row.title), description: String(row.description), estimatedMonthlySavingMinCents: Number(row.estimated_monthly_saving_min_cents), estimatedMonthlySavingMaxCents: Number(row.estimated_monthly_saving_max_cents), estimatedAnnualSavingMinCents: Number(row.estimated_annual_saving_min_cents), estimatedAnnualSavingMaxCents: Number(row.estimated_annual_saving_max_cents), confidence: Number(row.confidence), severity: row.severity as SavingsFinding['severity'], priority: Number(row.priority), effort: row.effort as SavingsFinding['effort'], urgency: row.urgency as SavingsFinding['urgency'], action: String(row.action), evidence: row.evidence as string[], status: row.status as SavingsFinding['status'], createdAt: isoFrom(row.created_at), resolvedAt: row.resolved_at ? isoFrom(row.resolved_at) : undefined, dismissedAt: row.dismissed_at ? isoFrom(row.dismissed_at) : undefined })
const pgStoredError = () => new Error('Dados de gastos inválidos no PostgreSQL.')
const pgEnum = <T extends string>(value: unknown, allowed: readonly T[]): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw pgStoredError()
  return value as T
}
const pgInteger = (value: unknown, minimum = 0) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > 2_147_483_647) throw pgStoredError()
  return value
}
const pgFinite = (value: unknown, minimum: number, maximum: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw pgStoredError()
  return value
}
const pgDate = (value: unknown) => {
  const parsed = dateFrom(value)
  if (!parsed || !isIsoDate(parsed)) throw pgStoredError()
  return parsed
}
const pgIso = (value: unknown) => {
  if (!(value instanceof Date) && typeof value !== 'string') throw pgStoredError()
  try { return isoFrom(value) } catch { throw pgStoredError() }
}
export const householdFrom = (row: Record<string, unknown>): HouseholdProfile => {
  try {
    const parsed = parseHouseholdInput({ adults: pgInteger(row.adults, 1), dependents: pgInteger(row.dependents), country: row.country })
    return { userId: String(row.user_id), ...parsed, effectiveAt: pgDate(row.effective_at), updatedAt: pgIso(row.updated_at) }
  } catch { throw pgStoredError() }
}
const spendAmountFrom = (row: Record<string, unknown>, joined = false): MonthlySpendPeriod['amounts'][number] => {
  const prefix = joined ? 'amount_' : ''
  const key = (name: string) => row[`${prefix}${name}`]
  const target = key('user_target_cents')
  return { id: String(key('id')), periodId: String(key('period_id')), category: pgEnum(key('category'), spendCategories), scope: pgEnum(key('scope'), spendScopes), amountCents: pgInteger(key('amount_cents')), trackingIntent: pgEnum(key('tracking_intent'), trackingIntents), ...(target === null || target === undefined ? {} : { userTargetCents: pgInteger(target) }) }
}
export const spendPeriodFrom = (row: Record<string, unknown>, amounts: MonthlySpendPeriod['amounts']): MonthlySpendPeriod => {
  try {
    if (row.country !== 'PT') throw pgStoredError()
    const adults = pgInteger(row.adults, 1)
    const dependents = pgInteger(row.dependents)
    if (row.adult_band !== adultBand(adults) || row.dependent_band !== dependentBand(dependents)) throw pgStoredError()
    const parsed = parseMonthlySpendInput({ month: pgDate(row.month), adults, dependents, status: pgEnum(row.status, spendStatuses), supermarketCoverage: pgEnum(row.supermarket_coverage, supermarketCoverages), amountBasis: pgEnum(row.amount_basis, amountBases), amounts: amounts.map(({ category, scope, amountCents, trackingIntent, userTargetCents }) => ({ category, scope, amountCents, trackingIntent, ...(userTargetCents === undefined ? {} : { userTargetCents }) })) })
    const id = String(row.id)
    if (amounts.some(amount => amount.periodId !== id)) throw pgStoredError()
    return { id, userId: String(row.user_id), ...parsed, country: 'PT', adultBand: adultBand(adults), dependentBand: dependentBand(dependents), createdAt: pgIso(row.created_at), updatedAt: pgIso(row.updated_at), amounts }
  } catch { throw pgStoredError() }
}
export const cohortFrom = (row: Record<string, unknown>): AnonymousCohortAggregate => {
  try {
    if (row.country !== 'PT') throw pgStoredError()
    const p25Cents = pgInteger(row.p25_cents)
    const medianCents = pgInteger(row.median_cents)
    const p75Cents = pgInteger(row.p75_cents)
    if (p25Cents > medianCents || medianCents > p75Cents) throw pgStoredError()
    const adultBandValue = pgEnum(row.adult_band, ['1', '2', '3plus'] as const)
    const dependentBandValue = pgEnum(row.dependent_band, ['0', '1', '2plus'] as const)
    const windowStart = pgDate(row.window_start)
    const windowEnd = pgDate(row.window_end)
    if (windowStart > windowEnd) throw pgStoredError()
    const source = typeof row.source === 'string' && row.source.trim() ? row.source : (() => { throw pgStoredError() })()
    return { id: String(row.id), category: pgEnum(row.category, spendCategories), scope: pgEnum(row.scope, spendScopes), country: 'PT', adultBand: adultBandValue, dependentBand: dependentBandValue, supermarketCoverage: pgEnum(row.supermarket_coverage, supermarketCoverages), amountBasis: pgEnum(row.amount_basis, amountBases), status: pgEnum(row.status, spendStatuses), windowStart, windowEnd, householdCount: pgInteger(row.household_count), p25Cents, medianCents, p75Cents, source, confidence: pgFinite(row.confidence, 0, 1) }
  } catch { throw pgStoredError() }
}
export const goalFrom = (row: Record<string, unknown>): SavingsGoal => {
  try {
    const parsed = parseSavingsGoalInput({ name: row.name, targetAnnualCents: pgInteger(row.target_annual_cents, 1) })
    const createdAt = pgIso(row.created_at)
    const updatedAt = pgIso(row.updated_at)
    if (Date.parse(updatedAt) < Date.parse(createdAt)) throw pgStoredError()
    return { id: String(row.id), userId: String(row.user_id), ...parsed, createdAt, updatedAt }
  } catch { throw pgStoredError() }
}
const expenseSql = 'select e.*, ed.contracted_power_kva, ed.tariff_type, ed.price_per_kwh_cents, ed.power_price_per_day_cents, ed.annual_consumption_kwh, ed.max_historical_power_kva, td.connection_type, td.download_speed_mbps, td.upload_speed_mbps, td.mobile_data_gb, td.mobile_lines, td.tv_included, bd.account_maintenance_fee_cents, bd.card_annual_fee_cents, bd.transfer_fees_cents, sd.plan, sd.last_used_at, sd.usage_frequency, id.policy_type, id.renewal_date, id.coverage_codes from recurring_expenses e left join electricity_details ed on ed.expense_id=e.id left join telecom_details td on td.expense_id=e.id left join bank_details bd on bd.expense_id=e.id left join subscription_details sd on sd.expense_id=e.id left join insurance_details id on id.expense_id=e.id'
const snapshotProperties = (expense: RecurringExpense) => ({ provider: expense.provider, details: expense.details, contractStartDate: expense.contractStartDate, contractEndDate: expense.contractEndDate, commitmentEndDate: expense.commitmentEndDate })
const relevantState = (expense: RecurringExpense) => JSON.stringify({ provider: expense.provider, productName: expense.productName, monthlyCostCents: expense.monthlyCostCents, currency: expense.currency, contractStartDate: expense.contractStartDate, contractEndDate: expense.contractEndDate, commitmentEndDate: expense.commitmentEndDate, details: expense.details })
const findingValues = (finding: SavingsFinding) => [finding.title, finding.description, finding.estimatedMonthlySavingMinCents, finding.estimatedMonthlySavingMaxCents, finding.estimatedAnnualSavingMinCents, finding.estimatedAnnualSavingMaxCents, finding.confidence, finding.severity, finding.priority, finding.effort, finding.urgency, finding.action, finding.evidence]

export class PostgresRepository implements PoupancasRepository {
  private pool: pg.Pool
  private db: ReturnType<typeof drizzle>
  private engine = createSavingsEngine()
  constructor(url: string) { this.pool = new pg.Pool({ connectionString: url }); this.db = drizzle(this.pool) }

  async getOwner(): Promise<StoredOwner | null> {
    const row = (await this.db.select().from(users).where(eq(users.ownerKey, 'owner')).limit(1))[0]
    if (!row?.passwordHash) return null
    if (!parsePasswordHash(row.passwordHash)) throw new Error('Dados de autenticação do proprietário inválidos.')
    return { id: row.id, name: row.name, email: row.email, passwordHash: row.passwordHash, createdAt: row.createdAt.toISOString(), legacyClaimedAt: row.legacyClaimedAt?.toISOString() }
  }
  async registerOwner(owner: StoredOwner, session: StoredSession, legacyUserId: string) {
    try {
      await this.db.transaction(async tx => {
        await tx.insert(users).values({ id: owner.id, name: owner.name, email: owner.email, passwordHash: owner.passwordHash, ownerKey: 'owner', createdAt: new Date(owner.createdAt), legacyClaimedAt: new Date(owner.createdAt) })
        await tx.update(recurringExpenses).set({ userId: owner.id }).where(eq(recurringExpenses.userId, legacyUserId))
        await tx.insert(sessions).values({ id: session.id, userId: session.userId, tokenHash: session.tokenHash, createdAt: new Date(session.createdAt), expiresAt: new Date(session.expiresAt) })
      })
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new Error('Esta área pessoal já tem proprietário.')
      throw error
    }
  }
  async replaceSessions(session: StoredSession) {
    await this.db.transaction(async tx => {
      await tx.update(sessions).set({ revokedAt: new Date(session.createdAt) }).where(and(eq(sessions.userId, session.userId), isNull(sessions.revokedAt)))
      await tx.insert(sessions).values({ id: session.id, userId: session.userId, tokenHash: session.tokenHash, createdAt: new Date(session.createdAt), expiresAt: new Date(session.expiresAt) })
    })
  }
  async getSession(tokenHash: string) {
    const rows = await this.db.select({ session: sessions, owner: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.tokenHash, tokenHash), eq(users.ownerKey, 'owner'))).limit(1)
    const row = rows[0]
    if (!row || !row.owner.passwordHash) return null
    return {
      owner: { id: row.owner.id, name: row.owner.name, email: row.owner.email, passwordHash: row.owner.passwordHash, createdAt: row.owner.createdAt.toISOString(), legacyClaimedAt: row.owner.legacyClaimedAt?.toISOString() },
      session: { id: row.session.id, userId: row.session.userId, tokenHash: row.session.tokenHash, createdAt: row.session.createdAt.toISOString(), expiresAt: row.session.expiresAt.toISOString(), revokedAt: row.session.revokedAt?.toISOString() }
    }
  }
  async revokeSession(tokenHash: string, revokedAt: string) { await this.db.update(sessions).set({ revokedAt: new Date(revokedAt) }).where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt))) }
  async claimLegacyExpenses(ownerId: string, legacyUserId: string, claimedAt: string) {
    await this.db.transaction(async tx => {
      await tx.update(recurringExpenses).set({ userId: ownerId }).where(eq(recurringExpenses.userId, legacyUserId))
      await tx.update(users).set({ legacyClaimedAt: new Date(claimedAt) }).where(and(eq(users.id, ownerId), eq(users.ownerKey, 'owner')))
    })
  }

  private async listExpensesWith(db: Queryable, userId: string) { return (await db.query(`${expenseSql} where e.user_id=$1 order by e.created_at`, [userId])).rows.map(expenseFrom) }
  private async getExpenseWith(db: Queryable, userId: string, id: string) {
    const expenseRow = (await db.query(`${expenseSql} where e.user_id=$1 and e.id=$2`, [userId, id])).rows[0]
    if (!expenseRow) return null
    const [snapshots, findings] = await Promise.all([db.query('select * from expense_snapshots where expense_id=$1 order by observed_at,created_at', [id]), db.query('select f.* from savings_findings f join recurring_expenses e on e.id=f.expense_id where e.user_id=$1 and f.expense_id=$2 order by f.priority desc', [userId, id])])
    return { expense: expenseFrom(expenseRow), snapshots: snapshots.rows.map(snapshotFrom), findings: findings.rows.map(findingFrom) }
  }
  private async writeDetails(db: Queryable, id: string, details: Exclude<ExpenseDetails, { kind: 'generic' }>, update = false) {
    if (details.kind === 'electricity') await db.query(`${update ? 'update electricity_details set contracted_power_kva=$2,tariff_type=$3,price_per_kwh_cents=$4,power_price_per_day_cents=$5,annual_consumption_kwh=$6,max_historical_power_kva=$7 where expense_id=$1' : 'insert into electricity_details (expense_id,contracted_power_kva,tariff_type,price_per_kwh_cents,power_price_per_day_cents,annual_consumption_kwh,max_historical_power_kva) values ($1,$2,$3,$4,$5,$6,$7)'}`, [id, details.contractedPowerKva, details.tariffType, details.pricePerKwhCents, details.powerPricePerDayCents, details.annualConsumptionKwh, details.maxHistoricalPowerKva])
    if (details.kind === 'telecom') await db.query(`${update ? 'update telecom_details set connection_type=$2,download_speed_mbps=$3,upload_speed_mbps=$4,mobile_data_gb=$5,mobile_lines=$6,tv_included=$7 where expense_id=$1' : 'insert into telecom_details (expense_id,connection_type,download_speed_mbps,upload_speed_mbps,mobile_data_gb,mobile_lines,tv_included) values ($1,$2,$3,$4,$5,$6,$7)'}`, [id, details.connectionType, details.downloadSpeedMbps, details.uploadSpeedMbps, details.mobileDataGb, details.mobileLines, details.tvIncluded])
    if (details.kind === 'bank') await db.query(`${update ? 'update bank_details set account_maintenance_fee_cents=$2,card_annual_fee_cents=$3,transfer_fees_cents=$4 where expense_id=$1' : 'insert into bank_details (expense_id,account_maintenance_fee_cents,card_annual_fee_cents,transfer_fees_cents) values ($1,$2,$3,$4)'}`, [id, details.accountMaintenanceFeeCents, details.cardAnnualFeeCents, details.transferFeesCents])
    if (details.kind === 'subscription') await db.query(`${update ? 'update subscription_details set plan=$2,last_used_at=$3,usage_frequency=$4 where expense_id=$1' : 'insert into subscription_details (expense_id,plan,last_used_at,usage_frequency) values ($1,$2,$3,$4)'}`, [id, details.plan, details.lastUsedAt, details.usageFrequency])
    if (details.kind === 'insurance') await db.query('insert into insurance_details (expense_id,policy_type,renewal_date,coverage_codes) values ($1,$2,$3,$4) on conflict (expense_id) do update set policy_type=excluded.policy_type,renewal_date=excluded.renewal_date,coverage_codes=excluded.coverage_codes', [id, details.policyType, details.renewalDate ?? null, JSON.stringify(details.coverageCodes)])
  }
  private async analyze(db: Queryable, userId: string, expense: RecurringExpense, excludedTypes: SavingsFinding['type'][] = []) {
    const [snapshots, observations, expenses, openRows, closedRows] = await Promise.all([
      db.query('select * from expense_snapshots where expense_id=$1 order by observed_at,created_at', [expense.id]),
      db.query('select * from market_observations'),
      this.listExpensesWith(db, userId),
      db.query("select * from savings_findings where expense_id=$1 and status='open' for update", [expense.id]),
      db.query("select * from savings_findings where expense_id=$1 and status<>'open'", [expense.id])
    ])
    const closedCycles = expense.category === 'insurance' ? new Set(closedRows.rows.map(row => findingCycleKey(findingFrom(row)))) : new Set<string>()
    const generated = (await this.engine.analyze(expense, { now: new Date(), snapshots: snapshots.rows.map(snapshotFrom), marketObservations: observations.rows.map(observationFrom), expenses }))
      .filter(item => !excludedTypes.includes(item.type) && !closedCycles.has(findingCycleKey(item)))
    const byType = new Map(openRows.rows.map(row => [String(row.type), findingFrom(row)]))
    const generatedTypes = generated.map(item => item.type)
    await db.query("update savings_findings set status='dismissed',dismissed_at=now() where expense_id=$1 and status='open' and not (type = any($2::text[]))", [expense.id, generatedTypes])
    for (const finding of generated) {
      const existing = byType.get(finding.type)
      const values = findingValues(finding)
      if (existing) await db.query('update savings_findings set title=$2,description=$3,estimated_monthly_saving_min_cents=$4,estimated_monthly_saving_max_cents=$5,estimated_annual_saving_min_cents=$6,estimated_annual_saving_max_cents=$7,confidence=$8,severity=$9,priority=$10,effort=$11,urgency=$12,action=$13,evidence=$14 where id=$1', [existing.id, ...values])
      else await db.query("insert into savings_findings (id,expense_id,type,title,description,estimated_monthly_saving_min_cents,estimated_monthly_saving_max_cents,estimated_annual_saving_min_cents,estimated_annual_saving_max_cents,confidence,severity,priority,effort,urgency,action,evidence,status,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'open',$17) on conflict (expense_id,type) where status='open' do update set title=excluded.title,description=excluded.description,estimated_monthly_saving_min_cents=excluded.estimated_monthly_saving_min_cents,estimated_monthly_saving_max_cents=excluded.estimated_monthly_saving_max_cents,estimated_annual_saving_min_cents=excluded.estimated_annual_saving_min_cents,estimated_annual_saving_max_cents=excluded.estimated_annual_saving_max_cents,confidence=excluded.confidence,severity=excluded.severity,priority=excluded.priority,effort=excluded.effort,urgency=excluded.urgency,action=excluded.action,evidence=excluded.evidence", [finding.id, finding.expenseId, finding.type, ...values, new Date(finding.createdAt)])
    }
  }
  private async analyzeInsurances(db: Queryable, userId: string) {
    await db.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
    for (const expense of (await this.listExpensesWith(db, userId)).filter(item => item.category === 'insurance' && item.details.kind === 'insurance')) {
      await this.analyze(db, userId, expense)
    }
  }

  async listExpenses(userId: string) { return this.listExpensesWith(this.pool, userId) }
  async getExpense(userId: string, id: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      await this.analyzeInsurances(client, userId)
      const result = await this.getExpenseWith(client, userId, id)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally { client.release() }
  }
  async createExpense(userId: string, raw: ExpenseInput) {
    const input = parseExpenseCreateInput(raw)
    const client = await this.pool.connect()
    const id = crypto.randomUUID()
    try {
      await client.query('begin')
      await client.query('insert into recurring_expenses (id,user_id,category,provider,product_name,monthly_cost_cents,billing_frequency,currency,contract_start_date,contract_end_date,commitment_end_date) values ($1,$2,$3,$4,$5,$6,\'monthly\',$7,$8,$9,$10)', [id, userId, input.category, input.provider, input.productName, input.monthlyCostCents, input.currency || 'EUR', input.contractStartDate, input.contractEndDate, input.commitmentEndDate])
      await this.writeDetails(client, id, input.details)
      const created = (await this.getExpenseWith(client, userId, id))!.expense
      await client.query('insert into expense_snapshots (id,expense_id,observed_at,price_cents,plan,properties,source) values ($1,$2,current_date,$3,$4,$5,\'manual\')', [crypto.randomUUID(), id, created.monthlyCostCents, created.productName, snapshotProperties(created)])
      if (created.category === 'insurance') await this.analyzeInsurances(client, userId)
      else await this.analyze(client, userId, created)
      const result = (await this.getExpenseWith(client, userId, id))!.expense
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally { client.release() }
  }
  async updateExpense(userId: string, id: string, raw: ExpensePatchInput) {
    const input = parseExpensePatchInput(raw)
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
      await client.query('select id from recurring_expenses where id=$1 and user_id=$2 for update', [id, userId])
      const current = await this.getExpenseWith(client, userId, id)
      if (!current) { await client.query('rollback'); return null }
      if (input.details && input.details.kind !== current.expense.category) throw new Error('Detalhes incompatíveis com a categoria')
      const merged = { ...current.expense, ...input, updatedAt: new Date().toISOString() } as RecurringExpense
      for (const key of ['contractStartDate', 'contractEndDate', 'commitmentEndDate'] as const) if (input[key] === null) merged[key] = undefined
      validateCommitmentDates(merged.contractStartDate, merged.commitmentEndDate)
      if (relevantState(merged) === relevantState(current.expense)) { await client.query('commit'); return current.expense }
      await client.query('update recurring_expenses set provider=$3,product_name=$4,monthly_cost_cents=$5,currency=$6,contract_start_date=$7,contract_end_date=$8,commitment_end_date=$9,updated_at=now() where id=$1 and user_id=$2', [id, userId, merged.provider, merged.productName, merged.monthlyCostCents, merged.currency, merged.contractStartDate ?? null, merged.contractEndDate ?? null, merged.commitmentEndDate ?? null])
      if (input.details) await this.writeDetails(client, id, input.details, true)
      const updated = (await this.getExpenseWith(client, userId, id))!.expense
      await client.query("insert into expense_snapshots (id,expense_id,observed_at,price_cents,plan,properties,source) values ($1,$2,current_date,$3,$4,$5,'manual_update')", [crypto.randomUUID(), id, updated.monthlyCostCents, updated.details.kind === 'subscription' ? updated.details.plan : updated.productName, snapshotProperties(updated)])
      if (updated.category === 'insurance') await this.analyzeInsurances(client, userId)
      else await this.analyze(client, userId, updated)
      const result = (await this.getExpenseWith(client, userId, id))!.expense
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally { client.release() }
  }
  async listFindings(userId: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      await this.analyzeInsurances(client, userId)
      const findings = (await client.query('select f.* from savings_findings f join recurring_expenses e on e.id=f.expense_id where e.user_id=$1 order by f.priority desc', [userId])).rows.map(findingFrom)
      await client.query('commit')
      return findings
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally { client.release() }
  }
  async getFinding(userId: string, id: string) { return (await this.listFindings(userId)).find(item => item.id === id) || null }
  async resolveFinding(userId: string, id: string, newCostCents: number, actionDate: string) {
    if (!Number.isSafeInteger(newCostCents) || newCostCents < 0 || newCostCents > Math.floor(2_147_483_647 / 12)) throw new Error('Novo custo inválido')
    if (!isIsoDate(actionDate)) throw new Error('Data inválida')
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
      const row = (await client.query("select f.id,f.type,f.expense_id,f.estimated_monthly_saving_max_cents,e.monthly_cost_cents from savings_findings f join recurring_expenses e on e.id=f.expense_id where f.id=$1 and e.user_id=$2 and f.status='open' for update", [id, userId])).rows[0]
      if (!row) throw new Error('Finding não encontrado ou já fechado')
      if (Number(row.estimated_monthly_saving_max_cents) <= 0) throw new Error('Esta revisão não tem uma poupança estimada e só pode ser concluída sem registar uma ação de poupança')
      if (actionDate > new Date().toISOString().slice(0, 10)) throw new Error('A data da cobrança não pode estar no futuro')
      const previousCostCents = Number(row.monthly_cost_cents)
      if (newCostCents >= previousCostCents) throw new Error('O novo custo tem de ser inferior ao custo anterior')
      const action: SavingAction = { id: crypto.randomUUID(), findingId: id, previousCostCents, newCostCents, actionDate, annualSavingCents: annualSaving(previousCostCents, newCostCents), createdAt: new Date().toISOString() }
      await client.query('insert into saving_actions (id,finding_id,previous_cost_cents,new_cost_cents,action_date,annual_saving_cents) values ($1,$2,$3,$4,$5,$6)', [action.id, id, previousCostCents, newCostCents, actionDate, action.annualSavingCents])
      await client.query("update savings_findings set status='resolved',resolved_at=now() where id=$1", [id])
      await client.query('update recurring_expenses set monthly_cost_cents=$1,updated_at=now() where id=$2 and user_id=$3', [newCostCents, row.expense_id, userId])
      const updated = (await this.getExpenseWith(client, userId, String(row.expense_id)))!.expense
      await client.query("insert into expense_snapshots (id,expense_id,observed_at,price_cents,plan,properties,source) values ($1,$2,$3,$4,$5,$6,'saving_action')", [crypto.randomUUID(), row.expense_id, actionDate, newCostCents, updated.productName, { ...snapshotProperties(updated), savingActionId: action.id }])
      await this.analyze(client, userId, updated, [String(row.type) as SavingsFinding['type']])
      await client.query('commit')
      return action
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally { client.release() }
  }
  async dismissFinding(userId: string, id: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
      const row = (await client.query("update savings_findings f set status='dismissed',dismissed_at=now() from recurring_expenses e where f.id=$1 and f.expense_id=e.id and e.user_id=$2 and f.status='open' returning f.*", [id, userId])).rows[0]
      if (!row) throw new Error('Finding não encontrado ou já fechado')
      await client.query('commit')
      return findingFrom(row)
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally { client.release() }
  }
  async listActions(userId: string) {
    const rows = (await this.pool.query('select a.* from saving_actions a join savings_findings f on f.id=a.finding_id join recurring_expenses e on e.id=f.expense_id where e.user_id=$1 order by a.action_date desc', [userId])).rows
    return rows.map(row => ({ id: String(row.id), findingId: String(row.finding_id), previousCostCents: Number(row.previous_cost_cents), newCostCents: Number(row.new_cost_cents), actionDate: dateFrom(row.action_date)!, annualSavingCents: Number(row.annual_saving_cents), createdAt: isoFrom(row.created_at) }))
  }
  async getHouseholdProfile(userId: string) {
    const row = (await this.pool.query('select * from household_profiles where user_id=$1', [userId])).rows[0]
    return row ? householdFrom(row) : null
  }
  async upsertHouseholdProfile(userId: string, raw: HouseholdInput) {
    const input = parseHouseholdInput(raw)
    const row = (await this.pool.query("insert into household_profiles (user_id,adults,dependents,country,effective_at) values ($1,$2,$3,'PT',current_date) on conflict (user_id) do update set adults=excluded.adults,dependents=excluded.dependents,updated_at=now() returning *", [userId, input.adults, input.dependents])).rows[0]
    return householdFrom(row)
  }
  private async listMonthlySpendPeriodsWith(db: Queryable, userId: string, periodId?: string) {
    const rows = (await db.query(`select p.*,
      a.id as amount_id,a.period_id as amount_period_id,a.category as amount_category,a.scope as amount_scope,
      a.amount_cents as amount_amount_cents,a.tracking_intent as amount_tracking_intent,a.user_target_cents as amount_user_target_cents
      from monthly_spend_periods p left join monthly_spend_amounts a on a.period_id=p.id
      where p.user_id=$1${periodId ? ' and p.id=$2' : ''} order by p.month desc,a.category,a.scope`, periodId ? [userId, periodId] : [userId])).rows
    const byPeriod = new Map<string, MonthlySpendPeriod['amounts']>()
    const periodRows = new Map<string, Record<string, unknown>>()
    for (const row of rows) {
      const id = String(row.id)
      periodRows.set(id, row)
      if (row.amount_id !== null) {
        const amount = spendAmountFrom(row, true)
        const values = byPeriod.get(id) || []
        values.push(amount)
        byPeriod.set(id, values)
      }
    }
    return [...periodRows.values()].map(row => spendPeriodFrom(row, byPeriod.get(String(row.id)) || []))
  }
  async listMonthlySpendPeriods(userId: string) { return this.listMonthlySpendPeriodsWith(this.pool, userId) }
  async upsertMonthlySpendPeriod(userId: string, raw: MonthlySpendInput) {
    const input = parseMonthlySpendInput(raw)
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const periodRow = (await client.query("insert into monthly_spend_periods (id,user_id,month,status,supermarket_coverage,amount_basis,country,adults,dependents,adult_band,dependent_band) values ($1,$2,$3,$4,$5,$6,'PT',$7,$8,$9,$10) on conflict (user_id,month) do update set status=excluded.status,supermarket_coverage=excluded.supermarket_coverage,amount_basis=excluded.amount_basis,country=excluded.country,adults=excluded.adults,dependents=excluded.dependents,adult_band=excluded.adult_band,dependent_band=excluded.dependent_band,updated_at=now() returning *", [crypto.randomUUID(), userId, input.month, input.status, input.supermarketCoverage, input.amountBasis, input.adults, input.dependents, adultBand(input.adults), dependentBand(input.dependents)])).rows[0]
      const id = String(periodRow.id)
      await client.query('delete from monthly_spend_amounts where period_id=$1', [id])
      for (const amount of input.amounts) await client.query('insert into monthly_spend_amounts (id,period_id,category,scope,amount_cents,tracking_intent,user_target_cents) values ($1,$2,$3,$4,$5,$6,$7)', [crypto.randomUUID(), id, amount.category, amount.scope, amount.amountCents, amount.trackingIntent, amount.userTargetCents])
      const result = (await this.listMonthlySpendPeriodsWith(client, userId, id))[0]
      if (!result) throw new Error('Período mensal não encontrado após gravação')
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally { client.release() }
  }
  async listAnonymousSpendCohorts() {
    return (await this.pool.query('select * from spend_cohort_aggregates order by window_end desc')).rows.map(cohortFrom)
  }
  async getSavingsGoal(userId: string) {
    const row = (await this.pool.query('select * from savings_goals where user_id=$1', [userId])).rows[0]
    return row ? goalFrom(row) : null
  }
  async upsertSavingsGoal(userId: string, raw: SavingsGoalInput) {
    const input = parseSavingsGoalInput(raw)
    const row = (await this.pool.query('insert into savings_goals (id,user_id,name,target_annual_cents) values ($1,$2,$3,$4) on conflict (user_id) do update set name=excluded.name,target_annual_cents=excluded.target_annual_cents,updated_at=now() returning *', [crypto.randomUUID(), userId, input.name, input.targetAnnualCents])).rows[0]
    return goalFrom(row)
  }
  async getSavingsGoalProgress(userId: string) {
    const goal = await this.getSavingsGoal(userId)
    return goal ? confirmedGoalProgress(goal, await this.listActions(userId)) : null
  }
}
