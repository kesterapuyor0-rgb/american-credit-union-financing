export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  pc: number;
}

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || 'db5quvpr01qmd5lf3v20db5quvpr01qmd5lf3v2g';

export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote> {
  const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(FINNHUB_API_KEY)}`);
  if (!response.ok) throw new Error(`Finnhub returned HTTP ${response.status}.`);

  const quote = await response.json() as FinnhubQuote;
  if (!Number.isFinite(quote.c) || quote.c <= 0) throw new Error('Finnhub returned no current market price.');
  return quote;
}
