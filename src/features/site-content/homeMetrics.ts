import type { D1Database } from '@cloudflare/workers-types';
import { prepareEnglishSave } from '../i18n/english';

export const homeMetricsKey = 'home_metrics';
export const homeMetricSlots = 4;
const numberPattern = /^\d{1,6}(?:\.\d{1,2})?$/;
const labelLimit = 48;
const suffixLimit = 12;

interface Metric {
  value: string;
  sourceLabel: string;
  sourceSuffix: string;
  label: string;
  suffix: string;
}
export interface HomeMetrics { enabled: boolean; items: Metric[] }

export class HomeMetricInputError extends Error {}

export async function loadHomeMetrics(db: D1Database, stored?: string | null): Promise<HomeMetrics> {
  if (stored != null) {
    try {
      const data = JSON.parse(stored) as Partial<HomeMetrics> | null;
      if (data && typeof data.enabled === 'boolean' && Array.isArray(data.items)) {
        return {
          enabled: data.enabled,
          items: data.items.slice(0, homeMetricSlots).filter(item => item &&
            typeof item.value === 'string' && numberPattern.test(item.value) &&
            [item.label, item.sourceLabel].every(label => typeof label === 'string' && label.length <= labelLimit) && item.sourceLabel.trim() &&
            typeof item.suffix === 'string' && item.suffix.length <= suffixLimit &&
            typeof item.sourceSuffix === 'string' && item.sourceSuffix.length <= suffixLimit),
        };
      }
    } catch { /* Ignore a malformed manual settings record. */ }
    return { enabled: false, items: [] };
  }
  const counts = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM products WHERE active=1) AS products,
      (SELECT COUNT(*) FROM categories) AS categories,
      (SELECT COUNT(*) FROM storefront_showcase_items s JOIN media m ON m.id=s.image_id
        WHERE s.section='cases' AND s.visible=1 AND NOT EXISTS (
          SELECT 1 FROM settings WHERE key='showcase_cases_enabled' AND value='0'
        )) AS cases,
      (SELECT COUNT(*) FROM customer_testimonials WHERE published=1) AS reviews
  `).first<Record<'products' | 'categories' | 'cases' | 'reviews', number>>();
  const summaries = [
    ['products', '上架球衣', 'Listed jerseys'],
    ['categories', '商品分类', 'Product categories'],
    ['cases', '客户案例', 'Customer cases'],
    ['reviews', '公开评价', 'Published reviews'],
  ] as const;
  return { enabled: true, items: summaries.map(([key, sourceLabel, label]) => ({
    value: String(counts?.[key] ?? 0), sourceLabel, label, sourceSuffix: '', suffix: '',
  })) };
}

export function homeMetricsForm(form: FormData): HomeMetrics {
  const input = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value.trim() : '';
  };
  return {
    enabled: form.get('metricsEnabled') === '1',
    items: Array.from({ length: homeMetricSlots }, (_, i) => ({
      value: input('metricValue' + i),
      sourceLabel: input('metricLabel' + i),
      sourceSuffix: input('metricSuffix' + i),
      label: '', suffix: '',
    })),
  };
}

export function prepareHomeMetrics(input: HomeMetrics, previous: HomeMetrics) {
  const items = input.items.filter(item => item.value || item.sourceLabel || item.sourceSuffix);
  if (input.enabled && !items.length) throw new HomeMetricInputError('启用时请至少填写一项指标。');
  if (items.some(item => !numberPattern.test(item.value) || !item.sourceLabel ||
      item.sourceLabel.length > labelLimit || item.sourceSuffix.length > suffixLimit)) {
    throw new HomeMetricInputError('请填写有效数字和名称。数字最多 6 位整数和 2 位小数，名称最多 48 字，后缀最多 12 字。');
  }
  const original: Record<string, string> = {};
  const limits: Record<string, number> = {};
  const before = { source: {} as Record<string, string>, english: {} as Record<string, string> };
  items.forEach((item, i) => {
    const old = previous.items.find(entry => entry.sourceLabel === item.sourceLabel && entry.sourceSuffix === item.sourceSuffix);
    for (const [field, value, oldValue, max] of [
      ['label', item.sourceLabel, old?.label, labelLimit],
      ['suffix', item.sourceSuffix, old?.suffix, suffixLimit],
    ] as const) {
      const key = field + i;
      original[key] = value;
      limits[key] = max;
      if (oldValue !== undefined) {
        before.source[key] = value;
        before.english[key] = oldValue;
      }
    }
  });
  const { fallback, pending } = prepareEnglishSave(original, before, Object.keys(original));
  const makeValue = (english: Record<string, string>): HomeMetrics => ({
    enabled: input.enabled,
    items: items.map((item, i) => ({ ...item, label: english['label' + i], suffix: english['suffix' + i] })),
  });
  return { fallback: makeValue(fallback), pending, limits,
    complete: (translated: Record<string, string>) => makeValue({ ...fallback, ...translated }) };
}
