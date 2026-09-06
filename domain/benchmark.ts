import type { MarketObservation } from './types'

export const MIN_BENCHMARK_SAMPLE_SIZE = 10
export interface BenchmarkStats { count: number, min: number, max: number, average: number, median: number, p25: number, p75: number }
const percentile = (sorted: number[], ratio: number) => {
  const position = (sorted.length - 1) * ratio
  const lower = Math.floor(position)
  const fraction = position - lower
  return sorted[lower]! + ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!) * fraction
}
export const benchmark = (values: number[]): BenchmarkStats | null => {
  if (values.length < MIN_BENCHMARK_SAMPLE_SIZE) return null
  const sorted = [...values].sort((a, b) => a - b)
  const round = (value: number) => Math.round(value)
  return { count: sorted.length, min: sorted[0]!, max: sorted.at(-1)!, average: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length), median: round(percentile(sorted, 0.5)), p25: round(percentile(sorted, 0.25)), p75: round(percentile(sorted, 0.75)) }
}
export interface BenchmarkFilter { category: string, provider: string, productType: string, attributes: Record<string, string | number | boolean>, country: string, now: Date }
export const filterComparableObservations = (items: MarketObservation[], filter: BenchmarkFilter) => {
  const cutoff = new Date(filter.now)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
  return items.filter(item => item.category === filter.category && item.provider.toLowerCase() === filter.provider.toLowerCase() && item.productType === filter.productType && item.country === filter.country && new Date(item.observedAt) >= cutoff && Object.entries(filter.attributes).every(([key, value]) => item.attributes[key] === value))
}
