import type { D1Database } from '@cloudflare/workers-types';
import { parsePublicId } from '../ids/publicId';
import { readProductDetailSections } from '../products/detailSections';

export const pilotLocale = 'zh-CN';
export const pilotPrefix = '/zh-cn';

const fields = {
  name: 250, slug: 75, h1: 200, intro: 1000, description: 12000,
  quoteNote: 1800, specifications: 1800, shippingPayment: 1800,
} as const;

export type ProductTranslationCopy = Record<keyof typeof fields, string>;
export interface LocalizedProduct {
  public_id: string;
  english_slug: string;
  slug: string;
  publication_json: string;
  sku: string | null;
}

export function productPaths(englishSlug: string, chineseSlug?: string) {
  return {
    en: '/products/' + englishSlug,
    ...(chineseSlug && { [pilotLocale]: pilotPrefix + '/products/' + chineseSlug }),
  };
}

const published = `
  SELECT p.public_id, p.slug AS english_slug, t.slug, t.publication_json, f.sku_key AS sku
  FROM storefront_translations t JOIN products p ON p.public_id=t.public_id
  JOIN languages l ON l.locale=t.locale AND l.is_enabled=1
  LEFT JOIN product_publications f ON f.product_id=p.id
  WHERE p.active=1 AND t.entity='product' AND t.locale=? AND t.revision>0
  AND t.slug IS NOT NULL AND t.publication_json IS NOT NULL
`;

export function publishedProductTranslation(db: D1Database, slug: string, by: 'english' | 'localized') {
  const field = by === 'english' ? 'p.slug' : 't.slug';
  return db.prepare(published + ` AND ${field}=?`).bind(pilotLocale, slug).first<LocalizedProduct>();
}

export function redirectedProductTranslation(db: D1Database, slug: string) {
  return db.prepare(published + ` AND EXISTS (
    SELECT 1 FROM storefront_translation_redirects r
    WHERE r.locale=t.locale AND r.entity=t.entity AND r.old_slug=? AND r.public_id=t.public_id
  )`).bind(pilotLocale, slug).first<LocalizedProduct>();
}

export async function localizedImages(db: D1Database, publicId: string) {
  const result = await db.prepare(`
    SELECT i.id, t.alt_text
    FROM product_image_translations t JOIN product_images i ON i.id=t.image_id
    JOIN products p ON p.id=i.product_id
    WHERE p.public_id=? AND t.locale=? AND t.image_key=i.image_key AND t.content_sha256 IS i.content_sha256
  `).bind(publicId, pilotLocale).all<{ id: number; alt_text: string }>();
  return new Map(result.results.map(row => [row.id, row]));
}

interface SourceProduct {
  id: number;
  name: string;
  description: string | null;
  sku: string;
  slug: string;
  import_seo_json: string;
  detail_sections: string | null;
  revision: number;
  publication_json: string | null;
}
interface SourceImage {
  public_id: string;
  image_key: string;
  content_sha256: string;
  alt: string | null;
  title: string | null;
  caption: string | null;
}

export async function translationSource(db: D1Database, publicId: string) {
  const [products, gallery] = await db.batch([
    db.prepare(`SELECT p.id, p.name, p.description, f.sku_key AS sku, p.slug, p.import_seo_json, p.detail_sections,
      COALESCE(t.revision,0) AS revision, t.publication_json
      FROM products p JOIN product_publications f ON f.product_id=p.id
      JOIN languages l ON l.locale=? AND l.is_enabled=1
      LEFT JOIN storefront_translations t ON t.public_id=p.public_id AND t.locale=l.locale AND t.entity='product'
      WHERE p.public_id=? AND p.active=1`).bind(pilotLocale, publicId),
    db.prepare(`SELECT i.public_id, i.image_key, i.content_sha256, i.alt, i.title, i.caption FROM product_images i
      JOIN products p ON p.id=i.product_id WHERE p.public_id=? ORDER BY i.position,i.id LIMIT 21`).bind(publicId),
  ]);
  const source = products.results[0] as unknown as SourceProduct | undefined;
  const images = gallery.results as unknown as SourceImage[];
  if (!source || !images.length || images.length > 20 ||
      images.some(row => !parsePublicId(row.public_id, 'productImage') || !/^[a-f0-9]{64}$/.test(row.content_sha256))) return null;
  const seo: unknown = JSON.parse(source.import_seo_json);
  const facts = { name: source.name, description: source.description, sku: source.sku, slug: source.slug, seo,
    sections: readProductDetailSections(source.detail_sections).english,
    images: images.map(row => ({ id: row.public_id, hash: row.content_sha256, alt: row.alt, title: row.title, caption: row.caption })) };
  const version = await sha256(JSON.stringify(facts));
  return { source, images, facts, version, revision: source.revision };
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('译文格式不正确。');
  return value as Record<string, unknown>;
}

function string(value: unknown, limit: number, required = true) {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new Error('译文字段缺失或超长。');
  return value.trim();
}

export function parseReviewedTranslation(raw: unknown) {
  const input = object(raw);
  const productId = parsePublicId(input.productId, 'product');
  const revision = input.revision;
  const version = string(input.version, 64);
  if (!productId || input.locale !== pilotLocale || input.reviewed !== true || typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) || revision < 0 || !/^[a-f0-9]{64}$/.test(version)) throw new Error('需要有效的商品、来源版本和人工审核。');
  const content = object(input.copy);
  const copy = Object.fromEntries(Object.entries(fields).map(([key, limit]) =>
    [key, string(content[key], limit, !['quoteNote', 'specifications', 'shippingPayment'].includes(key))],
  )) as ProductTranslationCopy;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(copy.slug)) throw new Error('中文网址标识须使用小写字母、数字及连字符。');
  if (!Array.isArray(input.images) || !input.images.length || input.images.length > 20) throw new Error('图片译文数量不正确。');
  const images = input.images.map(value => {
    const row = object(value);
    const id = parsePublicId(row.id, 'productImage');
    const hash = string(row.hash, 64);
    if (!id || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('图片标识或内容哈希无效。');
    return { id, hash, alt: string(row.alt, 500) };
  });
  if (new Set(images.map(image => image.id)).size !== images.length) throw new Error('图片译文重复。');
  return { productId, revision, version, sku: string(input.sku, 120), copy, images };
}

export async function publishReviewedTranslation(
  db: D1Database,
  input: ReturnType<typeof parseReviewedTranslation>,
  snapshot: NonNullable<Awaited<ReturnType<typeof translationSource>>>,
) {
  const { source, version, images } = snapshot;
  const { productId, revision, copy } = input;
  if (source.sku !== input.sku || version !== input.version ||
      images.length !== input.images.length ||
      images.some(row => !input.images.some(image => image.id === row.public_id && image.hash === row.content_sha256))) return false;

  // The batch is atomic. A mismatched source or revision leaves the current translation
  // and all of its image metadata intact. The unique write ID fences every image update.
  const writeId = await sha256(JSON.stringify(input));
  if (source.revision === revision + 1 && source.publication_json &&
      JSON.parse(source.publication_json).writeId === writeId) return true;
  if (source.revision !== revision) return false;
  const publication = JSON.stringify({ copy, writeId });
  const gallery = JSON.stringify(images.map(({ public_id, image_key, content_sha256, alt, title, caption }) =>
    [public_id, image_key, content_sha256, alt, title, caption]));
  const upsert = db.prepare(`
    INSERT INTO storefront_translations (locale,entity,public_id,title,body,slug,publication_json,revision,updated_at)
    SELECT ?,'product',p.public_id,?,?,?,?,?,datetime('now') FROM products p
    JOIN product_publications f ON f.product_id=p.id JOIN languages l ON l.locale=? AND l.is_enabled=1
    WHERE p.public_id=? AND p.active=1 AND p.name=? AND p.slug=? AND p.description IS ?
      AND p.import_seo_json=? AND p.detail_sections IS ? AND f.sku_key=?
      AND COALESCE((SELECT revision FROM storefront_translations WHERE locale=l.locale AND entity='product' AND public_id=p.public_id),0)=?
      AND (SELECT COUNT(*) FROM product_images WHERE product_id=p.id)=?
      AND NOT EXISTS (SELECT 1 FROM json_each(?) j WHERE NOT EXISTS (
        SELECT 1 FROM product_images i WHERE i.product_id=p.id AND i.public_id=json_extract(j.value,'$[0]')
          AND i.image_key=json_extract(j.value,'$[1]') AND i.content_sha256=json_extract(j.value,'$[2]')
          AND i.alt IS json_extract(j.value,'$[3]') AND i.title IS json_extract(j.value,'$[4]') AND i.caption IS json_extract(j.value,'$[5]')
      ))
    ON CONFLICT(locale,entity,public_id) DO UPDATE SET title=excluded.title,body=excluded.body,slug=excluded.slug,
      publication_json=excluded.publication_json,revision=excluded.revision,updated_at=excluded.updated_at
    WHERE storefront_translations.revision=?
    RETURNING revision
  `).bind(pilotLocale, copy.name, copy.description, copy.slug, publication, revision + 1, pilotLocale,
    productId, source.name, source.slug, source.description, source.import_seo_json, source.detail_sections, source.sku,
    revision, images.length, gallery, revision);
  const statements = input.images.map(image => db.prepare(`
    INSERT INTO product_image_translations (image_id,locale,image_key,content_sha256,alt_text,image_title,caption)
    SELECT i.id,t.locale,i.image_key,i.content_sha256,?,'',''
    FROM product_images i JOIN products p ON p.id=i.product_id
    JOIN storefront_translations t ON t.public_id=p.public_id AND t.locale=? AND t.entity='product'
    WHERE p.public_id=? AND i.public_id=? AND json_extract(t.publication_json,'$.writeId')=?
    ON CONFLICT(image_id,locale) DO UPDATE SET image_key=excluded.image_key,content_sha256=excluded.content_sha256,
      alt_text=excluded.alt_text
  `).bind(image.alt, pilotLocale, productId, image.id, writeId));
  const [result] = await db.batch([upsert, ...statements]);
  return result.results.length === 1;
}
