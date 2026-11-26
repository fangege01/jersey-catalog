import type { Ai, D1Database } from '@cloudflare/workers-types';
import { prepareEnglishSave } from '../i18n/english';
import { syncSiteEnglish } from '../i18n/englishSettings';
import { CACHE_TAG } from '../cache/tags';
import { purgeCacheTags } from '../cache/purge';

export const detailSectionFields = {
  quoteNote: '价格下方说明',
  specifications: '产品规格',
  shippingPayment: '运输及付款',
} as const;
type Key = keyof typeof detailSectionFields;
type Fields = Record<Key, string>;
export const detailSectionKeys = Object.keys(detailSectionFields) as Key[];
export const DETAIL_SECTION_LIMIT = 1800;
const MAX_LINES = 15;
const empty = (): Fields => ({ quoteNote: '', specifications: '', shippingPayment: '' });
export const detailSectionLines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

function safeFields(value: unknown): Fields {
  const result = empty();
  if (!value || typeof value !== 'object') return result;
  for (const key of detailSectionKeys) {
    const text = (value as Partial<Fields>)[key];
    if (typeof text === 'string') result[key] = text.slice(0, DETAIL_SECTION_LIMIT);
  }
  return result;
}

export function readProductDetailSections(raw: string | null | undefined) {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return { source: safeFields(value?.source), english: safeFields(value?.english) };
  } catch {
    return { source: empty(), english: empty() };
  }
}

export function parseProductDetailSections(form: FormData): { source?: Fields } | { error: string } {
  const source = empty();
  if (!detailSectionKeys.some(key => form.has(key))) return {};
  for (const key of detailSectionKeys) {
    const value = form.get(key);
    const label = detailSectionFields[key];
    if (typeof value !== 'string' || value.length > DETAIL_SECTION_LIMIT) {
      return { error: label + '最多可填写 ' + DETAIL_SECTION_LIMIT + ' 个字符。' };
    }
    const lines = detailSectionLines(value);
    if (lines.length > MAX_LINES) return { error: label + '最多可填写 ' + MAX_LINES + ' 行。' };
    source[key] = lines.join('\n');
  }
  return { source };
}

export function prepareProductDetailSections(db: D1Database, ai: Ai | undefined, source: Fields | undefined, raw?: string | null) {
  if (!source) return undefined;
  const previous = readProductDetailSections(raw);
  const limits = {
    quoteNote: DETAIL_SECTION_LIMIT, specifications: DETAIL_SECTION_LIMIT, shippingPayment: DETAIL_SECTION_LIMIT,
  };
  const { fallback, pending } = prepareEnglishSave(source, previous, detailSectionKeys);
  const value = JSON.stringify({ source, english: fallback });
  return { value, sync(context: { waitUntil(promise: Promise<unknown>): void } | undefined, id: number, publicId?: string | null) {
    syncSiteEnglish(context, ai, pending, limits, async translated => {
      const english = { ...fallback };
      for (const key of detailSectionKeys) {
        const text = translated[key];
        if (text && detailSectionLines(source[key]).length === detailSectionLines(text).length) english[key] = text;
      }
      const updated = await db.prepare('UPDATE products SET detail_sections=? WHERE id=? AND detail_sections=?')
        .bind(JSON.stringify({ source, english }), id, value).run();
      if (updated.meta.changes) await purgeCacheTags([CACHE_TAG.catalog, ...(publicId ? [CACHE_TAG.product(publicId)] : [])]);
    });
  } };
}
