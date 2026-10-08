const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Money is always displayed exactly as the server sent it; never recomputed here. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return usd.format(value);
}

/** Tight spaces (cards, KPI tiles) may drop the cents when the value is whole. */
export function formatMoneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? usdWhole.format(value) : usd.format(value);
}

const MONEY_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

/** Mirrors the backend: at most two decimals, never rounded. */
export function isValidMoneyInput(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (!MONEY_PATTERN.test(trimmed)) return false;
  return Number(trimmed) >= 0;
}

/** Turns "1.2" into 1.20 for display, and rejects anything with sub-cent precision. */
export function normalizeMoneyInput(value: string): string {
  const trimmed = value.trim();
  if (!isValidMoneyInput(trimmed)) return trimmed;
  return Number(trimmed).toFixed(2);
}

export function toMoneyNumber(value: string): number {
  return Number(value);
}