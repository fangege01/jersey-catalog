import type { Ai, D1Database } from '@cloudflare/workers-types';
import { translations, type SourceCopy } from './db';
import { prepareEnglishSave } from './english';
import { syncSiteEnglish } from './englishSettings';
import { purgeCacheTags } from '../cache/purge';
import { CACHE_TAG } from '../cache/tags';
import type { LocaleEntity } from './locale';

export async function saveCopyInEnglish(
  db: D1Database, ai: Ai | undefined, entity: LocaleEntity, source: SourceCopy,
  current?: SourceCopy & { publicId: string },
) {
  const prior = current ? (await translations(db, 'zh-CN', entity, [current.publicId])).get(current.publicId) : undefined;
  const fields = { title: source.title, body: source.body ?? '' };
  const limits = { title: 500, body: 16000 };
  const { fallback, pending } = prepareEnglishSave(fields,
    current && { source: { title: prior?.title ?? current.title, body: prior?.body ?? current.body ?? '' },
      english: { title: current.title, body: current.body ?? '' } }, Object.keys(fields));
  const title = fallback.title || ({ product: 'Football jersey', category: 'Product category', page: 'Page' }[entity]);
  const body = fallback.body || null;
  return {
    title, body,
    source: prior || title !== source.title || body !== source.body ? source : undefined,
    sync(context: { waitUntil(promise: Promise<unknown>): void } | undefined, id: number) {
      syncSiteEnglish(context, ai, pending, limits, async translated => {
        const { table, titleColumn, bodyColumn } = {
          product: { table: 'products', titleColumn: 'name', bodyColumn: 'description' },
          category: { table: 'categories', titleColumn: 'name', bodyColumn: null },
          page: { table: 'pages', titleColumn: 'title', bodyColumn: 'body_markdown' },
        }[entity];
        const bodyChange = bodyColumn ? `, ${bodyColumn}=?` : '';
        const bodyGuard = bodyColumn ? `AND ${bodyColumn} IS ?` : '';
        const result = await db.prepare(`UPDATE ${table} SET ${titleColumn}=?${bodyChange}
          WHERE id=? AND ${titleColumn} IS ? ${bodyGuard} AND EXISTS (
            SELECT 1 FROM storefront_translations s WHERE s.public_id=${table}.public_id AND s.entity=?
              AND s.locale='zh-CN' AND s.revision=0 AND s.title IS ? AND s.body IS ?
          )`).bind(translated.title ?? title, ...(bodyColumn ? [translated.body ?? body ?? (entity === 'page' ? '' : null)] : []),
            id, title, ...(bodyColumn ? [body ?? (entity === 'page' ? '' : null)] : []), entity, source.title, source.body).run();
        if (result.meta.changes) {
          const row = entity === 'product' ? await db.prepare("SELECT public_id FROM products WHERE id=?").bind(id).first<{ public_id: string }>() : null;
          await purgeCacheTags([CACHE_TAG.shell, CACHE_TAG.catalog, ...(row ? [CACHE_TAG.product(row.public_id)] : [])]);
        }
      });
    },
  };
}
