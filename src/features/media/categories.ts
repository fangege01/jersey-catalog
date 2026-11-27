import type { D1Database } from '@cloudflare/workers-types';

export interface MediaCategory { id: string; name: string }

export function mediaCategoryId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value) ? value : null;
}

export async function listMediaCategories(db: D1Database): Promise<MediaCategory[]> {
  const { results } = await db.prepare('SELECT id,name FROM media_categories ORDER BY name,id').all<MediaCategory>();
  return results;
}

export async function saveMediaCategory(db: D1Database, name: string, id?: string): Promise<string | null> {
  const normalized = name.trim();
  if (!normalized || normalized.length > 60) return null;
  const newId = id ?? crypto.randomUUID();
  const statement = id
    ? db.prepare('UPDATE media_categories SET name=? WHERE id=?')
    : db.prepare('INSERT INTO media_categories(name,id) VALUES (?,?)');
  const result = await statement.bind(normalized,newId).run();
  return result.meta.changes === 1 ? newId : null;
}

export async function removeMediaCategory(db: D1Database, id: string): Promise<boolean> {
  const removed = await db.prepare('DELETE FROM media_categories WHERE id=? RETURNING id').bind(id).first();
  return removed !== null;
}

export async function assignMediaCategory(db: D1Database, ids: string[], category: string | null): Promise<number> {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.prepare(`UPDATE media SET category_id=? WHERE public_id IN (${placeholders})
    AND (? IS NULL OR EXISTS (SELECT 1 FROM media_categories WHERE id=?))`)
    .bind(category,...ids,category,category).run();
  return result.meta.changes;
}
