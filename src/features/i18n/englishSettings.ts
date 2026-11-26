import type { Ai, D1Database } from '@cloudflare/workers-types';
import { completeEnglishSave } from './english';
import { CACHE_TAG } from '../cache/tags';
import { purgeCacheTags } from '../cache/purge';

type Context = { waitUntil(promise: Promise<unknown>): void } | undefined;
type Fields = Record<string, string>;

export function syncSiteEnglish(context: Context, ai: Ai | undefined, pending: Fields,
  limits: Record<string, number>, publish: (translated: Fields) => Promise<unknown>,
  failed?: () => Promise<unknown>) {
  if (!Object.keys(pending).length) return;
  const task = completeEnglishSave(ai, pending, limits).then(publish).catch(async cause => {
    console.warn('Storefront English sync failed', cause instanceof Error ? cause.name : 'Unknown error');
    if (failed) await failed();
  }).catch(cause => console.error('Could not record English sync state', cause));
  context?.waitUntil(task);
}

/** Only update the English copy covered by this save. A newer edit wins. */
export function syncEnglishSetting(
  context: Context, ai: Ai | undefined, db: D1Database, pending: Fields, limits: Record<string, number>,
  key: string, expected: string, value: (translated: Fields) => string,
  source?: { key: string; expected: string },
) {
  syncSiteEnglish(context, ai, pending, limits, async translated => {
    const base = db.prepare(`UPDATE settings SET value=?,updated_at=datetime('now')
      WHERE key=? AND value=? AND (? IS NULL OR EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?))`);
    const result = await base.bind(value(translated), key, expected, source?.key ?? null,
      source?.key ?? null, source?.expected ?? null).run();
    if (result.meta.changes) await purgeCacheTags([CACHE_TAG.shell, CACHE_TAG.catalog]);
  });
}

export function refreshStorefront(context: Context) {
  const task = purgeCacheTags([CACHE_TAG.shell, CACHE_TAG.catalog])
    .catch(cause => console.error('Storefront cache refresh failed after save', cause));
  context?.waitUntil(task);
}
