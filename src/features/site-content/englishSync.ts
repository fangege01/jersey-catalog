import type { Ai, D1Database } from '@cloudflare/workers-types';
import { completeEnglishFields } from '../i18n/english';
import { CACHE_TAG } from '../cache/tags';
import { purgeCacheTags } from '../cache/purge';

type Fields = Record<string, string>;
type SyncState = {
  revision: string;
  remaining: string[];
  phase: 'pending' | 'failed' | 'ready';
  startedAt: number;
};

export function readEnglishSync(value: string | null): SyncState | null {
  if (!value) return null;
  const state: SyncState = JSON.parse(value);
  if (state.phase === 'pending' && Date.now() - state.startedAt > 35000) {
    return { ...state, phase: 'failed' };
  }
  return state;
}

export async function saveSiteCopy(
  context: { waitUntil(promise: Promise<unknown>): void } | undefined,
  ai: Ai | undefined, db: D1Database, keys: { source: string; english: string; sync: string },
  source: Fields, english: Fields, pending: Fields, limits: Record<string, number>,
) {
  const remaining = Object.keys(pending);
  const state: SyncState = {
    revision: crypto.randomUUID(), remaining,
    phase: remaining.length ? 'pending' : 'ready', startedAt: Date.now(),
  };
  const sourceValue = JSON.stringify(source);
  const englishValue = JSON.stringify(english);
  const stateValue = JSON.stringify(state);
  const statement = `INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`;
  await db.batch([
    db.prepare(statement).bind(keys.source, sourceValue),
    db.prepare(statement).bind(keys.english, englishValue),
    db.prepare(statement).bind(keys.sync, stateValue),
  ]);
  if (!remaining.length) return;

  const task = (async () => {
    const translated = await completeEnglishFields(ai, pending, limits);
    const unresolved = remaining.filter(key => !Object.hasOwn(translated, key));
    const nextState = JSON.stringify({ ...state, remaining: unresolved, phase: unresolved.length ? 'failed' : 'ready' });
    const nextEnglish = JSON.stringify({ ...english, ...translated });
    const guardedUpdate = db.prepare(`UPDATE settings SET value=?,updated_at=datetime('now')
      WHERE key=? AND value=?
        AND EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)
        AND EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)`);
    const [result] = await db.batch([
      guardedUpdate.bind(nextEnglish, keys.english, englishValue, keys.source, sourceValue, keys.sync, stateValue),
      guardedUpdate.bind(nextState, keys.sync, stateValue, keys.source, sourceValue, keys.english, nextEnglish),
    ]);
    if (unresolved.length) console.warn('Site copy English sync incomplete', { fields: unresolved, aiBound: !!ai });
    if (result.meta.changes && englishValue !== nextEnglish) {
      await purgeCacheTags([CACHE_TAG.shell, CACHE_TAG.catalog]);
    }
  })().catch(cause => console.error('Site copy English sync could not complete', cause));
  if (context) context.waitUntil(task);
  else await task;
}
