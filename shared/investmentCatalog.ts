export type InvestmentAssetType = 'Equity' | 'ETF' | 'Mutual Fund' | 'Fixed Income';

export interface InvestmentAsset {
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  demoPrice: number;
  dailyChangePercent: number;
  detail: string;
}

export const INVESTMENT_CATALOG: InvestmentAsset[] = [
  { symbol: 'TSLA', name: 'Tesla Inc.', assetType: 'Equity', demoPrice: 220, dailyChangePercent: 0.82, detail: 'Individual equity · simulated reference price' },
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'Equity', demoPrice: 230, dailyChangePercent: 0.35, detail: 'Individual equity · simulated reference price' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', assetType: 'Equity', demoPrice: 420, dailyChangePercent: -0.24, detail: 'Individual equity · simulated reference price' },
  { symbol: 'SPY', name: 'S&P 500 Index ETF', assetType: 'ETF', demoPrice: 600, dailyChangePercent: 0.18, detail: 'Exchange-traded fund · simulated reference price' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetType: 'ETF', demoPrice: 300, dailyChangePercent: 0.12, detail: 'Exchange-traded fund · simulated reference price' },
  { symbol: 'DEMO-BAL', name: 'Diversified Balanced Fund (Demo)', assetType: 'Mutual Fund', demoPrice: 25, dailyChangePercent: 0.08, detail: 'Simulated fund NAV; mutual funds typically price once per business day' },
  { symbol: 'DEMO-UST10', name: 'U.S. Treasury Bond (Demo)', assetType: 'Fixed Income', demoPrice: 100, dailyChangePercent: 0, detail: 'Illustrative 4.00% fixed yield; simulated bond unit' },
  { symbol: 'DEMO-CD12', name: '12-Month Certificate of Deposit (Demo)', assetType: 'Fixed Income', demoPrice: 1000, dailyChangePercent: 0, detail: 'Illustrative 4.50% fixed yield; simulated CD unit' },
];

export function getInvestmentAsset(symbol: string): InvestmentAsset | undefined {
  return INVESTMENT_CATALOG.find((asset) => asset.symbol === symbol);
}
