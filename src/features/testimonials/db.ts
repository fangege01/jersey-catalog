import type { Ai, D1Database } from '@cloudflare/workers-types';
import { getMediaByPublicId } from '../media/db';
import { parsePublicId } from '../ids/publicId';
import { prepareEnglishSave } from '../i18n/english';
import { refreshStorefront, syncSiteEnglish } from '../i18n/englishSettings';

export const DEFAULT_TESTIMONIAL_SETTINGS = { enabled: false, title: 'Customer reviews', intro: '', sourceTitle: '客户评价', sourceIntro: '' };

export function testimonialSettings(value?: string) {
  if (!value) return DEFAULT_TESTIMONIAL_SETTINGS;
  try {
    const data = JSON.parse(value);
    const title = typeof data?.title === 'string' ? data.title.slice(0, 100) || DEFAULT_TESTIMONIAL_SETTINGS.title : DEFAULT_TESTIMONIAL_SETTINGS.title;
    const intro = typeof data?.intro === 'string' ? data.intro.slice(0, 500) : '';
    return {
      enabled: data?.enabled === true,
      title, intro,
      sourceTitle: typeof data?.sourceTitle === 'string' ? data.sourceTitle : title === DEFAULT_TESTIMONIAL_SETTINGS.title ? DEFAULT_TESTIMONIAL_SETTINGS.sourceTitle : title,
      sourceIntro: typeof data?.sourceIntro === 'string' ? data.sourceIntro : intro,
    };
  } catch {
    return DEFAULT_TESTIMONIAL_SETTINGS;
  }
}

export interface Testimonial {
  id: string;
  name: string;
  attribution: string;
  quote: string;
  sourceQuote: string | null;
  sourceAttribution: string | null;
  rating: number | null;
  published: number;
  avatarKey: string | null;
  avatarPublicId: string | null;
}

const COLUMNS = 't.id, t.name, t.attribution, t.quote, t.source_quote AS sourceQuote, t.source_attribution AS sourceAttribution, CASE WHEN t.rating_recorded = 1 THEN t.rating END AS rating, t.published, media.image_key AS avatarKey, media.public_id AS avatarPublicId';
const FROM = 'FROM customer_testimonials t LEFT JOIN media ON media.id = t.avatar_media_id';
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export class TestimonialInputError extends Error {}

export function testimonialId(value: unknown): string | null {
  return typeof value === 'string' && idPattern.test(value) ? value : null;
}

export function reviewText(form: FormData, key: string, length: number, required = false): string {
  const raw = form.get(key);
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (typeof raw !== 'string' || value.length > length || (required && !value)) {
    throw new TestimonialInputError('请填写必填字段，并检查文字长度。');
  }
  return value;
}

export async function listTestimonials(db: D1Database, offset: number) {
  const { results } = await db.prepare(`SELECT ${COLUMNS} ${FROM} ORDER BY t.position, t.id LIMIT 21 OFFSET ?`)
    .bind(offset).all<Testimonial>();
  return { items: results.slice(0, 20), more: results.length > 20 };
}

export function getTestimonial(db: D1Database, id: string) {
  return db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE t.id = ?`).bind(id).first<Testimonial>();
}

export async function publicTestimonials(db: D1Database) {
  const { results } = await db.prepare(`SELECT ${COLUMNS} ${FROM}
    WHERE t.published = 1 ORDER BY t.position,t.id LIMIT 12`).all<Testimonial>();
  return results;
}

export async function saveTestimonial(db: D1Database, form: FormData, id: string | null, ai?: Ai,
  context?: { waitUntil(promise: Promise<unknown>): void }) {
  const name = reviewText(form, 'name', 100, true);
  const attribution = reviewText(form, 'attribution', 120);
  const quote = reviewText(form, 'quote', 1200, true);
  const rating = form.get('rating');
  const score = typeof rating === 'string' ? rating.trim() : null;
  if (score === null || (score && !/^(?:[1-4](?:\.[0-9])?|5(?:\.0)?)$/.test(score))) {
    throw new TestimonialInputError('评分须在 1 到 5 分之间，最多一位小数，例如 4.9。留空表示未评分。');
  }
  const published = form.get('published') === '1' ? 1 : 0;
  const avatar = reviewText(form, 'avatar', 26);
  const mediaId = parsePublicId(avatar, 'media');
  const media = mediaId ? await getMediaByPublicId(db, mediaId) : null;
  if (avatar && !media) throw new TestimonialInputError('头像素材已不存在，请重新选择。');
  const existing = id ? await getTestimonial(db, id) : null;
  if (id && !existing) throw new TestimonialInputError('这条评价已不存在。');
  const source = { attribution, quote };
  const limits = { attribution: 120, quote: 1200 };
  const { fallback, pending } = prepareEnglishSave(source, existing ? {
    source: { attribution: existing.sourceAttribution ?? existing.attribution, quote: existing.sourceQuote ?? existing.quote },
    english: { attribution: existing.attribution, quote: existing.quote },
  } : undefined, Object.keys(source));
  const reviewId = id ?? crypto.randomUUID();
  // Keep the existing required rating column compatible with older rows.
  const values = [name, fallback.attribution, fallback.quote, attribution, quote, Number(score || '1'), Number(Boolean(score)), published, media?.id ?? null] as const;
  if (id) {
    const result = await db.prepare(`UPDATE customer_testimonials
      SET name = ?, attribution = ?, quote = ?, source_attribution = ?, source_quote = ?, rating = ?, rating_recorded = ?, published = ?, avatar_media_id = ? WHERE id = ?`)
      .bind(...values, id).run();
    if (result.meta.changes !== 1) throw new TestimonialInputError('这条评价已不存在。');
  } else {
    await db.prepare(`INSERT INTO customer_testimonials (name, attribution, quote, source_attribution, source_quote, rating, rating_recorded, published, avatar_media_id, id, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM customer_testimonials))`)
      .bind(...values, reviewId).run();
  }
  syncSiteEnglish(context, ai, pending, limits, async translated => {
    const updated = { ...fallback, ...translated };
    const result = await db.prepare(`UPDATE customer_testimonials SET attribution=?,quote=?
      WHERE id=? AND source_attribution IS ? AND source_quote IS ? AND attribution IS ? AND quote IS ?`)
      .bind(updated.attribution, updated.quote, reviewId, attribution, quote, fallback.attribution, fallback.quote).run();
    if (result.meta.changes) refreshStorefront(context);
  });
}

export async function moveTestimonial(db: D1Database, id: string, up: boolean) {
  // Swap the nearest pair in a single statement so two edits cannot leave half a swap.
  await db.prepare(`WITH current AS MATERIALIZED (
      SELECT position FROM customer_testimonials WHERE id = ?1
    ), neighbor AS MATERIALIZED (
      SELECT id, position FROM customer_testimonials
      WHERE position ${up ? '<' : '>'} (SELECT position FROM current)
      ORDER BY position ${up ? 'DESC' : 'ASC'} LIMIT 1
    )
    UPDATE customer_testimonials SET position = CASE WHEN id = ?1 THEN (SELECT position FROM neighbor)
      ELSE (SELECT position FROM current) END
    WHERE EXISTS (SELECT 1 FROM neighbor) AND id IN (?1, (SELECT id FROM neighbor))`).bind(id).run();
}

export async function deleteTestimonial(db: D1Database, id: string) {
  await db.prepare('DELETE FROM customer_testimonials WHERE id = ?').bind(id).run();
}
