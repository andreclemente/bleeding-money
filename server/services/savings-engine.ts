import { BankMaintenanceFeeAnalyzer } from '../../domain/analyzers/bank-maintenance-fee'
import { ElectricityContractedPowerAnalyzer } from '../../domain/analyzers/electricity-contracted-power'
import { ExpensePriceIncreaseAnalyzer } from '../../domain/analyzers/expense-price-increase'
import { SubscriptionUnusedAnalyzer } from '../../domain/analyzers/subscription-unused'
import { TelecomContractExpiredAnalyzer } from '../../domain/analyzers/telecom-contract-expired'
import { TelecomMarketBenchmarkAnalyzer } from '../../domain/analyzers/telecom-market-benchmark'
import { SavingsEngine } from '../../domain/engine'

export const createSavingsEngine = () => new SavingsEngine()
  .register(new ElectricityContractedPowerAnalyzer())
  .register(new TelecomMarketBenchmarkAnalyzer())
  .register(new TelecomContractExpiredAnalyzer())
  .register(new ExpensePriceIncreaseAnalyzer())
  .register(new BankMaintenanceFeeAnalyzer())
  .register(new SubscriptionUnusedAnalyzer())
