/** Money is always integer minor units internally. */
export function formatMoney(minor: number, currency = 'USD'): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export function parseMoneyToMinor(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'GEN'] as const;
