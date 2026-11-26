import type { D1Database } from '@cloudflare/workers-types';
import { getSetting } from '../settings/db';
import { hashPassword, verifyPassword } from './password';

/**
 * The admin login credential: a PBKDF2 hash in D1 (`admin_password_hash`), set
 * through the first-run setup wizard. There is no env password — until one is set
 * the store is in BOOTSTRAP mode (the gate lets you reach /admin/setup to create
 * it; see src/middleware.ts). Cloudflare Access remains the alternative/edge
 * protection. Kept out of the general settings overlay (never in `locals.settings`)
 * — read only here, on protected requests.
 */
const HASH_KEY = 'admin_password_hash';
const RECOVERY_KEY = 'admin_recovery_code_hash';
export const ADMIN_PASSWORD_MIN = 8;
export const ADMIN_PASSWORD_MAX = 128;

/** Store the admin password as a PBKDF2 hash in D1 (empty clears it → bootstrap). */
export async function setAdminPassword(db: D1Database, password: string): Promise<void> {
  await db.batch([
    password ? db.prepare(`INSERT INTO settings (key,value) VALUES (?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`)
      .bind(HASH_KEY, await hashPassword(password))
      : db.prepare('DELETE FROM settings WHERE key=?').bind(HASH_KEY),
    db.prepare('DELETE FROM settings WHERE key=?').bind(RECOVERY_KEY),
  ]);
}

export function validNewAdminPassword(password: string, confirmation: string): boolean {
  return password.length >= ADMIN_PASSWORD_MIN && password.length <= ADMIN_PASSWORD_MAX &&
    password === confirmation && !!password.trim();
}

export async function hasAdminRecoveryCode(db: D1Database): Promise<boolean> {
  return !!(await getSetting(db, RECOVERY_KEY));
}

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

async function recoveryDigest(code: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))));
}

/** Caller must verify the current password. Guard the write against a concurrent rotation. */
export async function createAdminRecoveryCode(db: D1Database, currentHash: string): Promise<string | null> {
  if (!currentHash) return null;
  const code = hex(crypto.getRandomValues(new Uint8Array(24)));
  const result = await db.prepare(`INSERT INTO settings (key,value)
    SELECT ?,? WHERE EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`)
    .bind(RECOVERY_KEY, await recoveryDigest(code), HASH_KEY, currentHash).run();
  return result.meta.changes ? code.match(/.{6}/g)!.join('-') : null;
}

/** The password hash binds admin sessions. Updating it also invalidates every existing session. */
async function replaceAdminPassword(
  db: D1Database, currentHash: string, password: string, codeHash: string | null,
): Promise<boolean> {
  if (!currentHash) return false;
  const newHash = await hashPassword(password);
  const [updated] = await db.batch([
    db.prepare(`UPDATE settings SET value=?,updated_at=datetime('now')
      WHERE key=? AND value=? AND (? IS NULL OR EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?))`)
      .bind(newHash, HASH_KEY, currentHash, codeHash, RECOVERY_KEY, codeHash),
    db.prepare(`DELETE FROM settings WHERE key=?
      AND EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)`).bind(RECOVERY_KEY, HASH_KEY, newHash),
  ]);
  return updated.meta.changes === 1;
}

/** Caller must verify the current password against currentHash. */
export function changeAdminPassword(db: D1Database, currentHash: string, password: string): Promise<boolean> {
  return replaceAdminPassword(db, currentHash, password, null);
}

export async function recoverAdminPassword(db: D1Database, code: string, password: string): Promise<boolean> {
  if (code.length > 100) return false;
  const normalized = code.replace(/[\s-]/g, '').toLowerCase();
  if (!/^[a-f0-9]{48}$/.test(normalized)) return false;
  const digest = await recoveryDigest(normalized);
  const currentHash = await adminPasswordHash(db);
  if (!currentHash || !(await db.prepare('SELECT 1 FROM settings WHERE key=? AND value=?').bind(RECOVERY_KEY, digest).first())) {
    return false;
  }
  return replaceAdminPassword(db, currentHash, password, digest);
}

/** The stored password hash (the session-tag source), or null when none is set. */
export function adminPasswordHash(db: D1Database): Promise<string | null> {
  return getSetting(db, HASH_KEY);
}

export interface AdminCredential {
  /** Whether password login is active (a hash is set in D1). */
  enabled: boolean;
  /** Value the session tag binds to — changing it invalidates sessions. '' if none. */
  tagSource: string;
  /** Verify a typed password (slow PBKDF2 compare). */
  verify(typed: string): Promise<boolean>;
}

export async function adminCredential(db: D1Database): Promise<AdminCredential> {
  const hash = await getSetting(db, HASH_KEY);
  if (hash) {
    return { enabled: true, tagSource: hash, verify: (t) => verifyPassword(t, hash) };
  }
  return { enabled: false, tagSource: '', verify: async () => false };
}
