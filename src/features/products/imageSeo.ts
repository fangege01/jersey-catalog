import type { D1Database } from '@cloudflare/workers-types';
import type { ProductImageRow } from './db.ts';
import { parsePublicId } from '../ids/publicId.ts';

export const imageAliasPattern = /^seo\/(pimg_[a-z0-9]+)\/[a-f0-9]{20}\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:avif|gif|jpe?g|png|webp)$/u;

export function normalizedImageFilename(value: string): string {
  return value.trim().toLowerCase().replace(/\.(?:avif|gif|jpe?g|png|webp)$/u, '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
}

interface ImageSeo {
  filename: string;
  alt: string | null;
  title?: string | null;
  caption?: string | null;
}

export function parseImageSeo(form: FormData): ImageSeo | { error: string } {
  const raw = String(form.get('image_filename') ?? '').trim();
  const filename = normalizedImageFilename(raw);
  if ((raw && !filename) || filename.length > 96) {
    return { error: '图片文件名需包含英文字母或数字，标准化后最多 96 个字符。' };
  }
  return {
    filename,
    alt: String(form.get('alt') ?? '').trim() || null,
    title: form.has('image_title') ? String(form.get('image_title') ?? '').trim() || null : undefined,
    caption: form.has('image_caption') ? String(form.get('image_caption') ?? '').trim() || null : undefined,
  };
}

export function requestedImageAlias(image: ProductImageRow, filename: string): string | null {
  if (!filename) return null;
  const extension = /\.(avif|gif|jpe?g|png|webp)$/iu.exec(image.image_key)?.[1].toLowerCase();
  const publicId = parsePublicId(image.public_id, 'productImage');
  if (!extension || !publicId) return null;
  const name = filename + '.' + extension;
  if (image.seo_alias?.endsWith('/' + name)) return image.seo_alias;
  const version = [...crypto.getRandomValues(new Uint8Array(10))].map(value => value.toString(16).padStart(2, '0')).join('');
  return `seo/${publicId}/${version}/${name}`;
}

export async function saveImageSeo(db: D1Database, image: ProductImageRow, seo: ImageSeo): Promise<string | null> {
  const alias = requestedImageAlias(image, seo.filename);
  if (seo.filename && !alias) return '无法识别原图格式，暂不能自定义这张图片的文件名。';
  const update = db.prepare(`
    UPDATE product_images SET seo_alias=?, alt=?,
      title=CASE WHEN ? THEN ? ELSE title END,
      caption=CASE WHEN ? THEN ? ELSE caption END
    WHERE id=? AND image_key=?
  `).bind(alias, seo.alt, seo.title !== undefined ? 1 : 0, seo.title ?? null,
    seo.caption !== undefined ? 1 : 0, seo.caption ?? null, image.id, image.image_key);
  const claims = alias && alias !== image.seo_alias ? [db.prepare(
    'INSERT INTO product_image_url_aliases (alias_key,image_key) SELECT ?, image_key FROM product_images WHERE id=? AND image_key=?',
  ).bind(alias, image.id, image.image_key)] : [];
  const results = await db.batch([...claims, update]);
  return results.at(-1)?.meta.changes ? null : '图片已更新，请刷新页面后重试。';
}

export function imageAliasPath(alias: string): string {
  return '/images/' + alias;
}
