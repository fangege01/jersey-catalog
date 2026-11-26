import type { D1Database } from '@cloudflare/workers-types';

export const HOME_SLIDE_LIMIT = 8;
const prefix = 'site_image:home-slide:';
const pattern = /^site_image:home-slide:\d{9}$/u;
const glob = prefix + '*';

export function isHomeSlideKey(key: string): boolean {
  return pattern.test(key);
}

export function homeSlideImageKeys(rows: Array<{ key: string; value: string }>): string[] {
  return rows.filter(row => isHomeSlideKey(row.key)).sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, HOME_SLIDE_LIMIT).map(row => row.value);
}

export async function listHomeSlides(db: D1Database) {
  const { results } = await db.prepare(`SELECT s.key, s.value AS imageKey, m.original_name AS name
    FROM settings s JOIN media m ON m.image_key=s.value WHERE s.key GLOB ? ORDER BY s.key LIMIT ?`)
    .bind(glob, HOME_SLIDE_LIMIT).all<{ key: string; imageKey: string; name: string }>();
  return results;
}

export async function appendHomeSlides(db: D1Database, mediaIds: number[]): Promise<number> {
  // Use settings keys that the existing media deletion guard already protects.
  // Each statement rechecks both the slide cap and the media row in the write.
  const results = await db.batch(mediaIds.map(id => db.prepare(`
    WITH current AS (
      SELECT COUNT(*) AS total, COALESCE(MAX(CAST(substr(key, ?) AS INTEGER)), 0) AS last_position
      FROM settings WHERE key GLOB ?
    )
    INSERT INTO settings (key,value)
    SELECT ? || printf('%09d', current.last_position + 1), m.image_key FROM media m, current
    WHERE m.id=? AND current.total < ?
  `).bind(prefix.length + 1, glob, prefix, id, HOME_SLIDE_LIMIT)));
  return results.reduce((count, row) => count + row.meta.changes, 0);
}

export async function removeHomeSlide(db: D1Database, key: string, imageKey: string): Promise<boolean> {
  if (!isHomeSlideKey(key)) return false;
  const result = await db.prepare('DELETE FROM settings WHERE key=? AND value=?').bind(key, imageKey).run();
  return result.meta.changes === 1;
}

export async function moveHomeSlide(
  db: D1Database, key: string, imageKey: string, direction: -1 | 1,
): Promise<boolean> {
  const slides = await listHomeSlides(db);
  const index = slides.findIndex(slide => slide.key === key && slide.imageKey === imageKey);
  if (index < 0) return false;
  const target = slides[index + direction];
  if (!target) return false;
  const result = await db.prepare(`UPDATE settings SET value=CASE WHEN key=? THEN ? ELSE ? END
    WHERE key IN (?,?) AND 2=(
      SELECT COUNT(*) FROM settings WHERE (key=? AND value=?) OR (key=? AND value=?)
    )`).bind(key, target.imageKey, imageKey, key, target.key, key, imageKey, target.key, target.imageKey).run();
  return result.meta.changes === 2;
}
