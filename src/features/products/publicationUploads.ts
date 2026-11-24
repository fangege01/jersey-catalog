import type { D1Database } from '@cloudflare/workers-types';
import type { StorageProvider } from '../storage/provider';

const WAIT_SECONDS = 24 * 60 * 60;
const CLAIM_SECONDS = 15 * 60;
const BATCH_SIZE = 20;

export async function recordPublicationUploads(db: D1Database, task: string, source: string, keys: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const insert = db.prepare('INSERT INTO publication_upload_objects (object_key, task_id, source_hash, started_at, delete_after) VALUES (?, ?, ?, ?, ?)');
  await db.batch(keys.map(key => insert.bind(key, task, source, now, now + WAIT_SECONDS)));
}

export function attachPublicationUploads(db: D1Database, task: string) {
  return db.prepare("UPDATE publication_upload_objects SET state = 'attached' WHERE task_id = ? AND state = 'pending'").bind(task);
}

const noReferences = `
  NOT EXISTS (SELECT 1 FROM media WHERE image_key = object_key)
  AND NOT EXISTS (SELECT 1 FROM products WHERE image_key = object_key OR file_key = object_key)
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE image_key = object_key)
  AND NOT EXISTS (SELECT 1 FROM settings WHERE value = object_key)
`;

export async function sweepPublicationUploads(db: D1Database, storage: Pick<StorageProvider, 'delete'>, now = Math.floor(Date.now() / 1000)) {
  const token = crypto.randomUUID();
  const claimed = await db.prepare(`
    UPDATE publication_upload_objects
    SET state = 'deleting', claim_token = ?, claim_until = ?, attempts = attempts + 1
    WHERE object_key IN (
      SELECT object_key FROM publication_upload_objects
      WHERE delete_after <= ?
        AND (state = 'pending' OR (state = 'deleting' AND claim_until <= ?))
        AND ${noReferences}
      ORDER BY delete_after, object_key LIMIT ?
    )
    RETURNING object_key
  `).bind(token, now + CLAIM_SECONDS, now, now, BATCH_SIZE).all<{ object_key: string }>();

  let deleted = 0;
  for (const { object_key: key } of claimed.results) {
    const liveClaim = await db.prepare(`
      SELECT object_key FROM publication_upload_objects
      WHERE object_key = ? AND state = 'deleting' AND claim_token = ? AND claim_until > unixepoch()
        AND ${noReferences}
    `).bind(key, token).first();
    if (!liveClaim) continue;
    try {
      await storage.delete(key);
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      await db.prepare('UPDATE publication_upload_objects SET last_error = ? WHERE object_key = ? AND claim_token = ?')
        .bind(reason, key, token).run();
      continue;
    }
    await db.prepare("UPDATE publication_upload_objects SET state = 'deleted', deleted_at = unixepoch(), last_error = NULL WHERE object_key = ? AND claim_token = ?")
      .bind(key, token).run();
    deleted++;
  }
  return { claimed: claimed.results.length, deleted };
}
