import { sql } from 'drizzle-orm'
import { boolean, check, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const categoryEnum = pgEnum('expense_category', ['electricity', 'telecom', 'bank', 'subscription', 'gym', 'insurance'])
export const frequencyEnum = pgEnum('billing_frequency', ['monthly', 'quarterly', 'annual'])
export const statusEnum = pgEnum('finding_status', ['open', 'resolved', 'dismissed'])
export const severityEnum = pgEnum('finding_severity', ['info', 'low', 'medium', 'high'])
export const effortEnum = pgEnum('finding_effort', ['very_low', 'low', 'medium', 'high'])
export const urgencyEnum = pgEnum('finding_urgency', ['low', 'medium', 'high'])
export const spendCategoryEnum = pgEnum('spend_category', ['supermarket_total', 'fast_food_takeaway', 'alcohol', 'tobacco_nicotine', 'sweets_snacks_soft_drinks', 'other_discretionary'])
export const spendScopeEnum = pgEnum('spend_scope', ['supermarket', 'outside_supermarket'])
export const trackingIntentEnum = pgEnum('tracking_intent', ['track_only', 'maintain', 'reduce'])
export const supermarketCoverageEnum = pgEnum('supermarket_coverage', ['food_only', 'includes_cleaning_hygiene', 'unknown'])
export const spendAmountBasisEnum = pgEnum('spend_amount_basis', ['statement_or_receipts', 'calculated_estimate', 'memory_estimate'])
export const spendStatusEnum = pgEnum('spend_status', ['estimated', 'complete'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(), passwordHash: text('password_hash'), ownerKey: text('owner_key').unique(), legacyClaimedAt: timestamp('legacy_claimed_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})
export const sessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), tokenHash: text('token_hash').notNull().unique(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), revokedAt: timestamp('revoked_at', { withTimezone: true })
}, table => [index('auth_sessions_user_expiry_idx').on(table.userId, table.expiresAt)])
export const householdProfiles = pgTable('household_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }), adults: integer('adults').notNull(), dependents: integer('dependents').notNull(), country: text('country').notNull().default('PT'), effectiveAt: date('effective_at').notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [check('household_profiles_country_pt_check', sql`${table.country} = 'PT'`), check('household_profiles_composition_check', sql`${table.adults} between 1 and 20 and ${table.dependents} between 0 and 20`)])
export const monthlySpendPeriods = pgTable('monthly_spend_periods', {
  id: uuid('id').primaryKey(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), month: date('month').notNull(), status: spendStatusEnum('status').notNull(), supermarketCoverage: supermarketCoverageEnum('supermarket_coverage').notNull(), amountBasis: spendAmountBasisEnum('amount_basis').notNull(), country: text('country').notNull().default('PT'), adults: integer('adults').notNull(), dependents: integer('dependents').notNull(), adultBand: text('adult_band').notNull(), dependentBand: text('dependent_band').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  uniqueIndex('monthly_spend_user_month_idx').on(table.userId, table.month), index('monthly_spend_user_month_order_idx').on(table.userId, table.month),
  check('monthly_spend_periods_country_pt_check', sql`${table.country} = 'PT'`),
  check('monthly_spend_periods_composition_check', sql`${table.adults} between 1 and 20 and ${table.dependents} between 0 and 20`),
  check('monthly_spend_periods_bands_check', sql`${table.adultBand} = case when ${table.adults} = 1 then '1' when ${table.adults} = 2 then '2' else '3plus' end and ${table.dependentBand} = case when ${table.dependents} = 0 then '0' when ${table.dependents} = 1 then '1' else '2plus' end`)
])
export const monthlySpendAmounts = pgTable('monthly_spend_amounts', {
  id: uuid('id').primaryKey(), periodId: uuid('period_id').notNull().references(() => monthlySpendPeriods.id, { onDelete: 'cascade' }), category: spendCategoryEnum('category').notNull(), scope: spendScopeEnum('scope').notNull(), amountCents: integer('amount_cents').notNull(), trackingIntent: trackingIntentEnum('tracking_intent').notNull(), userTargetCents: integer('user_target_cents')
}, table => [
  uniqueIndex('monthly_spend_amount_category_scope_idx').on(table.periodId, table.category, table.scope),
  check('monthly_spend_amount_nonnegative_check', sql`${table.amountCents} >= 0`),
  check('monthly_spend_amount_target_intent_check', sql`(${table.trackingIntent} = 'reduce' and ${table.userTargetCents} is not null and ${table.userTargetCents} between 0 and ${table.amountCents}) or (${table.trackingIntent} <> 'reduce' and ${table.userTargetCents} is null)`)
])
export const spendCohortAggregates = pgTable('spend_cohort_aggregates', {
  id: uuid('id').primaryKey(), category: spendCategoryEnum('category').notNull(), scope: spendScopeEnum('scope').notNull(), country: text('country').notNull(), adultBand: text('adult_band').notNull(), dependentBand: text('dependent_band').notNull(), supermarketCoverage: supermarketCoverageEnum('supermarket_coverage').notNull(), amountBasis: spendAmountBasisEnum('amount_basis').notNull(), status: spendStatusEnum('status').notNull(), windowStart: date('window_start').notNull(), windowEnd: date('window_end').notNull(), householdCount: integer('household_count').notNull(), p25Cents: integer('p25_cents').notNull(), medianCents: integer('median_cents').notNull(), p75Cents: integer('p75_cents').notNull(), source: text('source').notNull(), confidence: doublePrecision('confidence').notNull()
}, table => [
  index('spend_cohort_exact_match_idx').on(table.category, table.scope, table.country, table.adultBand, table.dependentBand, table.supermarketCoverage, table.amountBasis, table.status, table.windowEnd),
  check('spend_cohort_country_pt_check', sql`${table.country} = 'PT'`),
  check('spend_cohort_bands_check', sql`${table.adultBand} in ('1','2','3plus') and ${table.dependentBand} in ('0','1','2plus')`),
  check('spend_cohort_nonnegative_check', sql`${table.householdCount} >= 0 and ${table.p25Cents} >= 0 and ${table.medianCents} >= 0 and ${table.p75Cents} >= 0`),
  check('spend_cohort_percentiles_check', sql`${table.p25Cents} <= ${table.medianCents} and ${table.medianCents} <= ${table.p75Cents}`),
  check('spend_cohort_confidence_check', sql`${table.confidence} between 0 and 1`)
])
export const recurringExpenses = pgTable('recurring_expenses', {
  id: uuid('id').primaryKey(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), category: categoryEnum('category').notNull(), provider: text('provider').notNull(), productName: text('product_name').notNull(), monthlyCostCents: integer('monthly_cost_cents').notNull(), billingFrequency: frequencyEnum('billing_frequency').notNull(), currency: text('currency').notNull().default('EUR'), contractStartDate: date('contract_start_date'), contractEndDate: date('contract_end_date'), commitmentEndDate: date('commitment_end_date'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('expenses_user_category_idx').on(table.userId, table.category)])
export const electricityDetails = pgTable('electricity_details', {
  expenseId: uuid('expense_id').primaryKey().references(() => recurringExpenses.id, { onDelete: 'cascade' }), contractedPowerKva: doublePrecision('contracted_power_kva').notNull(), tariffType: text('tariff_type').notNull(), pricePerKwhCents: integer('price_per_kwh_cents').notNull(), powerPricePerDayCents: integer('power_price_per_day_cents').notNull(), annualConsumptionKwh: integer('annual_consumption_kwh').notNull(), maxHistoricalPowerKva: doublePrecision('max_historical_power_kva').notNull()
})
export const telecomDetails = pgTable('telecom_details', {
  expenseId: uuid('expense_id').primaryKey().references(() => recurringExpenses.id, { onDelete: 'cascade' }), connectionType: text('connection_type').notNull(), downloadSpeedMbps: integer('download_speed_mbps').notNull(), uploadSpeedMbps: integer('upload_speed_mbps'), mobileDataGb: integer('mobile_data_gb'), mobileLines: integer('mobile_lines'), tvIncluded: boolean('tv_included')
})
export const bankDetails = pgTable('bank_details', {
  expenseId: uuid('expense_id').primaryKey().references(() => recurringExpenses.id, { onDelete: 'cascade' }), accountMaintenanceFeeCents: integer('account_maintenance_fee_cents').notNull(), cardAnnualFeeCents: integer('card_annual_fee_cents').notNull(), transferFeesCents: integer('transfer_fees_cents').notNull()
})
export const subscriptionDetails = pgTable('subscription_details', {
  expenseId: uuid('expense_id').primaryKey().references(() => recurringExpenses.id, { onDelete: 'cascade' }), plan: text('plan').notNull(), lastUsedAt: date('last_used_at'), usageFrequency: text('usage_frequency')
})
export const expenseSnapshots = pgTable('expense_snapshots', {
  id: uuid('id').primaryKey(), expenseId: uuid('expense_id').notNull().references(() => recurringExpenses.id, { onDelete: 'cascade' }), observedAt: date('observed_at').notNull(), priceCents: integer('price_cents').notNull(), plan: text('plan'), properties: jsonb('properties').$type<Record<string, unknown>>().notNull().default({}), source: text('source').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('snapshots_expense_date_idx').on(table.expenseId, table.observedAt)])
export const marketObservations = pgTable('market_observations', {
  id: uuid('id').primaryKey(), category: categoryEnum('category').notNull(), provider: text('provider').notNull(), productType: text('product_type').notNull(), attributes: jsonb('attributes').$type<Record<string, string | number | boolean>>().notNull(), monthlyPriceCents: integer('monthly_price_cents').notNull(), negotiated: boolean('negotiated').notNull(), country: text('country').notNull(), observedAt: date('observed_at').notNull(), source: text('source').notNull(), confidence: doublePrecision('confidence').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('market_benchmark_idx').on(table.category, table.provider, table.productType, table.country, table.observedAt)])
export const marketOffers = pgTable('market_offers', {
  id: uuid('id').primaryKey(), provider: text('provider').notNull(), category: categoryEnum('category').notNull(), productName: text('product_name').notNull(), validFrom: date('valid_from').notNull(), validUntil: date('valid_until'), attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull(), pricing: jsonb('pricing').$type<Record<string, number>>().notNull(), source: text('source').notNull()
})
export const savingsFindings = pgTable('savings_findings', {
  id: uuid('id').primaryKey(), expenseId: uuid('expense_id').notNull().references(() => recurringExpenses.id, { onDelete: 'cascade' }), type: text('type').notNull(), title: text('title').notNull(), description: text('description').notNull(), estimatedMonthlySavingMinCents: integer('estimated_monthly_saving_min_cents').notNull(), estimatedMonthlySavingMaxCents: integer('estimated_monthly_saving_max_cents').notNull(), estimatedAnnualSavingMinCents: integer('estimated_annual_saving_min_cents').notNull(), estimatedAnnualSavingMaxCents: integer('estimated_annual_saving_max_cents').notNull(), confidence: doublePrecision('confidence').notNull(), severity: severityEnum('severity').notNull(), priority: integer('priority').notNull(), effort: effortEnum('effort').notNull(), urgency: urgencyEnum('urgency').notNull(), action: text('action').notNull(), evidence: jsonb('evidence').$type<string[]>().notNull(), status: statusEnum('status').notNull().default('open'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), resolvedAt: timestamp('resolved_at', { withTimezone: true }), dismissedAt: timestamp('dismissed_at', { withTimezone: true })
}, table => [index('findings_expense_status_idx').on(table.expenseId, table.status), uniqueIndex('findings_open_expense_type_idx').on(table.expenseId, table.type).where(sql`${table.status} = 'open'`)])
export const savingActions = pgTable('saving_actions', {
  id: uuid('id').primaryKey(), findingId: uuid('finding_id').notNull().references(() => savingsFindings.id), previousCostCents: integer('previous_cost_cents').notNull(), newCostCents: integer('new_cost_cents').notNull(), actionDate: date('action_date').notNull(), annualSavingCents: integer('annual_saving_cents').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('saving_action_finding_idx').on(table.findingId)])
