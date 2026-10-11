export interface CryptoUsdRates {
  BTC: number;
  USDT: number;
}

export async function getCryptoUsdRates(): Promise<CryptoUsdRates> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Ctether&vs_currencies=usd', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Market price provider returned HTTP ${response.status}.`);
    }
    const data = await response.json() as {
      bitcoin?: { usd?: unknown };
      tether?: { usd?: unknown };
    };
    const BTC = Number(data.bitcoin?.usd);
    const USDT = Number(data.tether?.usd);
    if (!Number.isFinite(BTC) || BTC <= 0 || !Number.isFinite(USDT) || USDT <= 0) {
      throw new Error('Market price provider returned invalid crypto prices.');
    }
    return { BTC, USDT };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatCryptoAmount(amount: number, currency: string): string {
  const maximumFractionDigits = currency === 'BTC' ? 8 : 6;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Math.abs(amount))} ${currency}`;
}
