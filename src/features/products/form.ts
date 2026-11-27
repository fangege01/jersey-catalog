import type { ProductFields } from './db';
import { toMinorUnits } from '../../money';
import { toGrams, type WeightUnit } from '../shipping/weight';
import { parseWholesalePrices } from './wholesale';
import { MIN_RELEASE_YEAR, MAX_RELEASE_YEAR } from './releaseYear';
import { hasRichProductFormat, productMarkdownSource, richProductValue } from './richFormat';

export interface ProductFormOptions {
  catalogOnly?: boolean;
  existingStock?: number;
  existingDelivery?: Pick<ProductFields, 'requires_shipping' | 'weight_grams'>;
  /** Admin's display unit. Storage is always grams. */
  unit?: WeightUnit;
  /**
   * True when at least one enabled zone prices by weight with no flat fallback —
   * i.e. when a missing weight would make this product unsellable. The merchant is
   * told at the field rather than discovering it as lost checkouts.
   */
  requireWeight?: boolean;
}

/**
 * Parse + validate the scalar product form fields. Prices arrive in major units
 * (e.g. dollars) and are stored as integer minor units, scaled by the product's
 * currency (×100 for USD, ×1 for JPY). Weight arrives in the store's display unit
 * and is stored as integer grams. The image upload is handled by the endpoint, not
 * here. Returns either the clean fields or a user-facing error.
 */
export function parseProductForm(
  form: FormData,
  options: ProductFormOptions = {},
): { data: ProductFields } | { error: string } {
  const { unit = 'g', requireWeight = false } = options;

  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: '请填写商品名称。' };

  const price = Number(String(form.get('price') ?? '').trim());
  if (!Number.isFinite(price) || price < 0) {
    return { error: '请输入大于或等于零的价格。' };
  }

  const stock = options.catalogOnly
    ? options.existingStock ?? 0
    : Number(String(form.get('stock') ?? '0').trim());
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: '请输入大于或等于零的整数库存。' };
  }

  const currency = String(form.get('currency') ?? 'usd').trim().toLowerCase() || 'usd';
  if (!/^[a-z]{3}$/.test(currency)) return { error: '请选择有效的货币。' };
  // Scale by the chosen currency's minor units (so 1000 JPY stores as 1000, not 100000).
  const price_cents = toMinorUnits(price, currency);
  if (!Number.isSafeInteger(price_cents)) return { error: '商品价格超出可保存范围。' };
  const tiers = parseWholesalePrices(form, currency);
  if (tiers.error) return { error: tiers.error };
  let releaseYear: number | null | undefined;
  if (options.catalogOnly && form.has('release_year')) {
    const value = form.get('release_year');
    if (typeof value !== 'string') return { error: '请填写有效的商品年份。' };
    const year = value.trim();
    releaseYear = year ? Number(year) : null;
    if (year && (!/^\d{4}$/.test(year) || Number(year) < MIN_RELEASE_YEAR || Number(year) > MAX_RELEASE_YEAR)) {
      return { error: '商品年份须在 1900 至 2099 年之间。' };
    }
  }
  const originalDescription = String(form.get('description') ?? '').trim();
  const description = hasRichProductFormat(originalDescription)
    ? richProductValue(productMarkdownSource(originalDescription))
    : originalDescription || null;
  if (description && hasRichProductFormat(description) && description.length > 16000) {
    return { error: '商品描述过长，请缩短文案后再保存。' };
  }
  // Unchecked checkboxes submit nothing, so absence means inactive.
  const active = form.get('active') != null ? 1 : 0;
  let requires_shipping = options.existingDelivery?.requires_shipping ?? 1;
  let weight_grams = options.existingDelivery?.weight_grams ?? null;
  if (!options.catalogOnly) {
    requires_shipping = form.get('requires_shipping') != null ? 1 : 0;
    const parsedWeight = toGrams(String(form.get('weight') ?? ''), unit);
    if (parsedWeight.status === 'error') return { error: weightFieldError(parsedWeight.reason, unit) };
    weight_grams = parsedWeight.status === 'ok' ? parsedWeight.grams : null;
    if (weight_grams === null && requireWeight && requires_shipping === 1 && active === 1) {
      return { error: '请填写配送重量。所有配置的配送区域均按重量计费，缺少重量时顾客无法购买。' };
    }
  }

  return {
    data: { name, description, price_cents, currency, stock, active, weight_grams, requires_shipping,
      ...(releaseYear !== undefined && { release_year: releaseYear }),
      ...(tiers.prices !== undefined && { wholesale_prices: tiers.prices }) },
  };
}

function weightFieldError(
  reason: 'not_number' | 'negative' | 'precision' | 'over_limit',
  unit: WeightUnit,
): string {
  switch (reason) {
    case 'negative':
      return '重量不能为负数。';
    case 'precision':
      return `${unit} 的重量小数位数过多。`;
    case 'over_limit':
      return '重量超过包裹配送上限。';
    default:
      return '请输入数字重量。';
  }
}
