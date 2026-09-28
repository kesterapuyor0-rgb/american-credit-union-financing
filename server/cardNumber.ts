/** Returns four numeric display digits, including for legacy hexadecimal values. */
export const numericCardLastFour = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (/^\d{4}$/.test(raw)) return raw;
  if (/^[\da-f]{4}$/i.test(raw)) {
    return String(Number.parseInt(raw, 16) % 10000).padStart(4, '0');
  }
  return raw.replace(/\D/g, '').slice(-4).padStart(4, '0');
};

/** Display-only masked number; the app never stores or exposes a complete PAN. */
export const maskedCardNumber = (network: string, lastFour: unknown): string =>
  `${network === 'Mastercard' ? '5424' : '4532'} •••• •••• ${numericCardLastFour(lastFour)}`;
