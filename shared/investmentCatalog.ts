export type InvestmentAssetType = 'Equity' | 'ETF' | 'Mutual Fund' | 'Fixed Income' | 'Crypto';

export interface InvestmentAsset {
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  marketPrice: number;
  dailyChangePercent: number;
  detail: string;
}

const LEGACY_INVESTMENT_SYMBOLS: Record<string, string> = {
  'DEMO-BAL': 'BAL',
  'DEMO-UST10': 'UST10',
  'DEMO-CD12': 'CD12',
};

export const INVESTMENT_CATALOG: InvestmentAsset[] = [
  { symbol: 'TSLA', name: 'Tesla Inc.', assetType: 'Equity', marketPrice: 220, dailyChangePercent: 0.82, detail: 'Individual Equity' },
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'Equity', marketPrice: 230, dailyChangePercent: 0.35, detail: 'Individual Equity' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', assetType: 'Equity', marketPrice: 420, dailyChangePercent: -0.24, detail: 'Individual Equity' },
  { symbol: 'SPY', name: 'S&P 500 Index ETF', assetType: 'ETF', marketPrice: 600, dailyChangePercent: 0.18, detail: 'Exchange-traded fund' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetType: 'ETF', marketPrice: 300, dailyChangePercent: 0.12, detail: 'Exchange-traded fund' },
  { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin', assetType: 'Crypto', marketPrice: 65000, dailyChangePercent: 0, detail: 'Cryptocurrency · BTC/USDT' },
  { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', assetType: 'Crypto', marketPrice: 3500, dailyChangePercent: 0, detail: 'Cryptocurrency · ETH/USDT' },
  { symbol: 'BINANCE:SOLUSDT', name: 'Solana', assetType: 'Crypto', marketPrice: 150, dailyChangePercent: 0, detail: 'Cryptocurrency · SOL/USDT' },
  { symbol: 'BAL', name: 'Diversified Balanced Fund', assetType: 'Mutual Fund', marketPrice: 25, dailyChangePercent: 0.08, detail: 'Diversified mutual fund' },
  { symbol: 'UST10', name: 'U.S. Treasury Bond', assetType: 'Fixed Income', marketPrice: 100, dailyChangePercent: 0, detail: 'Fixed-income security' },
  { symbol: 'CD12', name: '12-Month Certificate of Deposit', assetType: 'Fixed Income', marketPrice: 1000, dailyChangePercent: 0, detail: 'Fixed-term deposit' },
];

export function getInvestmentAsset(symbol: string): InvestmentAsset | undefined {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const canonicalSymbol = LEGACY_INVESTMENT_SYMBOLS[normalizedSymbol] || normalizedSymbol;
  return INVESTMENT_CATALOG.find((asset) => asset.symbol === canonicalSymbol);
}

export function getLegacyInvestmentSymbols(symbol: string): string[] {
  return Object.entries(LEGACY_INVESTMENT_SYMBOLS)
    .filter(([, canonicalSymbol]) => canonicalSymbol === symbol)
    .map(([legacySymbol]) => legacySymbol);
}
