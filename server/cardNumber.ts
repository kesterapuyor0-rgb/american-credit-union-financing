import { randomInt } from 'crypto';

/** Returns four numeric display digits, including for legacy hexadecimal values. */
export const numericCardLastFour = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (/^\d{4}$/.test(raw)) return raw;
  if (/^[\da-f]{4}$/i.test(raw)) {
    return String(Number.parseInt(raw, 16) % 10000).padStart(4, '0');
  }
  return raw.replace(/\D/g, '').slice(-4).padStart(4, '0');
};

/** Generates a 16-digit mock card number with a network-appropriate first digit. */
export const generateCardNumber = (network: string, lastFour: unknown): string => {
  const prefix = network === 'Mastercard' ? '5' : '4';
  const middleDigits = Array.from({ length: 11 }, () => randomInt(0, 10)).join('');
  return `${prefix}${middleDigits}${numericCardLastFour(lastFour)}`;
};

/** Display-only masked number; the app never stores or exposes a complete PAN. */
export const maskedCardNumber = (network: string, lastFour: unknown): string =>
  `${network === 'Mastercard' ? '5424' : '4532'} •••• •••• ${numericCardLastFour(lastFour)}`;
