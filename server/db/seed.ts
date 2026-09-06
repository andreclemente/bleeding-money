import { createDb } from './client'
import { bankDetails, electricityDetails, expenseSnapshots, marketObservations, marketOffers, recurringExpenses, savingsFindings, subscriptionDetails, telecomDetails, users } from './schema'
import { DEMO_USER_ID, demoExpenses, demoFindings, demoMarketObservations, demoMarketOffers, demoSnapshots } from './demo-data'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL é obrigatória')
const db = createDb(url)
await db.transaction(async tx => {
  await tx.insert(users).values({ id: DEMO_USER_ID, name: 'Utilizador Demo', email: 'demo@local.invalid' }).onConflictDoNothing()
  for (const item of demoExpenses) {
    const { details, createdAt, updatedAt, ...common } = item
    await tx.insert(recurringExpenses).values({ ...common, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt) }).onConflictDoNothing()
    if (details.kind === 'electricity') await tx.insert(electricityDetails).values({ expenseId: item.id, contractedPowerKva: details.contractedPowerKva, tariffType: details.tariffType, pricePerKwhCents: details.pricePerKwhCents, powerPricePerDayCents: details.powerPricePerDayCents, annualConsumptionKwh: details.annualConsumptionKwh, maxHistoricalPowerKva: details.maxHistoricalPowerKva }).onConflictDoNothing()
    if (details.kind === 'telecom') await tx.insert(telecomDetails).values({ expenseId: item.id, connectionType: details.connectionType, downloadSpeedMbps: details.downloadSpeedMbps, uploadSpeedMbps: details.uploadSpeedMbps, mobileDataGb: details.mobileDataGb, mobileLines: details.mobileLines, tvIncluded: details.tvIncluded }).onConflictDoNothing()
    if (details.kind === 'bank') await tx.insert(bankDetails).values({ expenseId: item.id, accountMaintenanceFeeCents: details.accountMaintenanceFeeCents, cardAnnualFeeCents: details.cardAnnualFeeCents, transferFeesCents: details.transferFeesCents }).onConflictDoNothing()
    if (details.kind === 'subscription') await tx.insert(subscriptionDetails).values({ expenseId: item.id, plan: details.plan, lastUsedAt: details.lastUsedAt, usageFrequency: details.usageFrequency }).onConflictDoNothing()
  }
  await tx.insert(expenseSnapshots).values(demoSnapshots).onConflictDoNothing()
  await tx.insert(marketObservations).values(demoMarketObservations).onConflictDoNothing()
  await tx.insert(marketOffers).values(demoMarketOffers).onConflictDoNothing()
  await tx.insert(savingsFindings).values(demoFindings.map(({ createdAt, resolvedAt, dismissedAt, ...item }) => ({ ...item, createdAt: new Date(createdAt), resolvedAt: resolvedAt ? new Date(resolvedAt) : undefined, dismissedAt: dismissedAt ? new Date(dismissedAt) : undefined }))).onConflictDoNothing()
})
console.log(`Seed concluída: ${demoExpenses.length} despesas, ${demoMarketObservations.length} observações anónimas e ${demoFindings.length} findings`)
