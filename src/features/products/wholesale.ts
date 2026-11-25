import { currencyDecimals, toMinorUnits } from '../../money';

export const wholesaleRanges = ['1–9', '10–49', '50–199', '200+'] as const;
export const wholesaleFields = ['wholesale_10', 'wholesale_50', 'wholesale_200'] as const;

export function readWholesalePrices(raw: string | null | undefined): Array<number | null> {
  let values: unknown;
  try { values = raw ? JSON.parse(raw) : null; } catch { values = null; }
  const entries = Array.isArray(values) ? values : [];
  return wholesaleFields.map((_, index) => {
    const value = entries[index];
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
  });
}

export function parseWholesalePrices(form: FormData, currency: string) {
  if (!wholesaleFields.some((field) => form.has(field))) return { prices: undefined };
  const decimals = currencyDecimals(currency);
  const pattern = new RegExp('^\\d{1,8}' + (decimals ? '(?:\\.\\d{1,' + decimals + '})?' : '') + '$');
  const prices: Array<number | null> = [];
  for (const field of wholesaleFields) {
    const value = form.get(field);
    if (typeof value !== 'string') return { error: '阶梯报价字段不完整，请刷新页面后重试。' };
    const text = value.trim();
    if (!text) {
      prices.push(null);
      continue;
    }
    const minor = pattern.test(text) ? toMinorUnits(Number(text), currency) : 0;
    if (!Number.isSafeInteger(minor) || minor <= 0) return { error: '阶梯报价须为有效的正数，未定价时请留空。' };
    prices.push(minor);
  }
  return { prices: JSON.stringify(prices) };
}
