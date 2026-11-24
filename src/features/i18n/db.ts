import type { D1Database } from '@cloudflare/workers-types';
import type { LocaleEntity, StoreLocale } from './locale';
import type { Product } from '../products/db';

export interface Translation {
  public_id: string;
  title: string;
  body: string | null;
}

export type SourceCopy = { title: string; body: string | null };

export function sourceCopyStatement(db: D1Database, entity: LocaleEntity, publicId: string, source: SourceCopy) {
  const table = { product: 'products', category: 'categories', page: 'pages' }[entity];
  return db.prepare(`
    INSERT INTO storefront_translations (locale, entity, public_id, title, body)
    SELECT 'zh-CN', ?, public_id, ?, ? FROM ${table} WHERE public_id = ?
    ON CONFLICT(locale, entity, public_id) DO UPDATE SET title = excluded.title, body = excluded.body
  `).bind(entity, source.title, source.body, publicId);
}

export async function translations(
  db: D1Database, locale: StoreLocale | undefined, entity: LocaleEntity, ids: Array<string | null>,
): Promise<Map<string, Translation>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (locale !== 'zh-CN' || !unique.length) return new Map();
  const all = [];
  for (let index = 0; index < unique.length; index += 80) {
    const chunk = unique.slice(index, index + 80);
    const { results } = await db.prepare(
      'SELECT public_id, title, body FROM storefront_translations WHERE locale = ? AND entity = ? AND public_id IN (' +
      chunk.map(() => '?').join(',') + ')',
    ).bind(locale, entity, ...chunk).all<Translation>();
    all.push(...results);
  }
  return new Map(all.map((value) => [value.public_id, value]));
}

export function localizedProduct(product: Product, value?: Translation): Product {
  return value ? { ...product, name: value.title, description: value.body || product.description } : product;
}

export async function searchChineseProducts(db: D1Database, query: string, limit: number, offset: number) {
  const term = '%' + query.replace(/[\\%_]/g, '\\$&') + '%';
  const where = "FROM storefront_translations t JOIN products p ON p.public_id = t.public_id WHERE p.active = 1 AND t.locale = 'zh-CN' AND t.entity = 'product' AND (t.title LIKE ? ESCAPE '\\' OR t.body LIKE ? ESCAPE '\\')";
  const [matches, count] = await db.batch<{ total?: number }>([
    db.prepare('SELECT p.* ' + where + ' ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?').bind(term, term, limit, offset),
    db.prepare('SELECT COUNT(*) AS total ' + where).bind(term, term),
  ]);
  return { products: matches.results as unknown as Product[], total: Number(count.results[0]?.total ?? 0), correctedTo: null };
}
