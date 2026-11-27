import type { D1Database } from '@cloudflare/workers-types';

const DIACRITICS = /[̀-ͯ]/g;

/** Turn arbitrary text into a URL-safe slug. */
export function slugify(input: string): string {
  return normalizeSlug(input) || 'product';
}

function normalizeSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/['’`]/g, '') // drop apostrophes so "mom's" → "moms", not "mom-s"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export async function adminProductSlug(
  db: D1Database, requested: string, title: string, existing?: { id: number; slug: string },
): Promise<{ slug: string } | { error: string }> {
  const raw = requested.trim();
  if (existing?.slug && (!raw || raw === existing.slug)) return { slug: existing.slug };
  if (!raw) return { slug: await uniqueSlug(db, title, existing?.id) };
  const slug = normalizeSlug(raw);
  if (!slug) return { error: '商品网址需包含英文字母或数字。' };
  if (await uniqueSlug(db, slug, existing?.id) !== slug) return { error: '此商品网址已使用或已保留，请换一个网址。' };
  return { slug };
}

/**
 * Return a slug unique across products, appending -2, -3, … on collision.
 * Pass excludeId when updating so a product doesn't collide with itself.
 */
export async function uniqueSlug(
  db: D1Database,
  base: string,
  excludeId?: number,
): Promise<string> {
  const slug = slugify(base);
  let candidate = slug;
  let n = 1;
  while (true) {
    const row = await db
      .prepare(
        `SELECT id FROM products WHERE slug = ?${excludeId ? ' AND id != ?' : ''} LIMIT 1`,
      )
      .bind(...(excludeId ? [candidate, excludeId] : [candidate]))
      .first<{ id: number }>();
    const redirect = row ? null : await db.prepare(
      'SELECT product_id FROM product_slug_redirects WHERE old_slug = ? AND (? IS NULL OR product_id <> ?)',
    ).bind(candidate, excludeId ?? null, excludeId ?? null).first<{ product_id: number }>().catch(() => null);
    if (!row && !redirect) return candidate;
    n += 1;
    candidate = `${slug}-${n}`;
  }
}
