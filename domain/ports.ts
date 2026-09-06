import type { MarketOffer } from './types'

export interface ParsedDocument { fields: Record<string, unknown>, confidence: number }
export interface DocumentParser { supports(mimeType: string): boolean, parse(input: Uint8Array): Promise<ParsedDocument> }
export interface MarketDataProvider { sync(): Promise<MarketOffer[]> }
export class FixturesMarketDataProvider implements MarketDataProvider {
  constructor(private readonly offers: MarketOffer[]) {}
  async sync() { return structuredClone(this.offers) }
}
