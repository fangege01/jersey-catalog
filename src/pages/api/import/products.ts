import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getConfig } from '../../../config';
import { generatePublicId } from '../../../features/ids/publicId';
import { validateUpload, mediaKeyFor } from '../../../features/media/upload';
import { readImageDimensions } from '../../../features/media/dimensions';
import { getStorage } from '../../../features/storage';
import { PRODUCT_IMPORT_TOKEN_PATTERN, productImportConfigured } from '../../../features/admin/importConfig';
import { toMinorUnits } from '../../../money';

export const prerender = false;

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_BODY = MAX_IMAGE_BYTES + 256 * 1024;

function reply(data: object, status: number) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function matchesToken(supplied: string, expected: string) {
  if (!PRODUCT_IMPORT_TOKEN_PATTERN.test(supplied)) return false;
  const [a, b] = await Promise.all([digest(supplied), digest(expected)]);
  return a.reduce((difference, byte, index) => difference | (byte ^ b[index]), 0) === 0;
}

function text(value: unknown, length: number): string {
  if (typeof value !== 'string' || value.length > length) throw new Error('商品字段缺失或超出长度限制');
  return value.trim();
}

function parseProduct(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.length > 30000) throw new Error('商品资料无效');
  const data = JSON.parse(value) as Record<string, unknown>;
  const source = new URL(text(data.sourceUrl, 2000));
  if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) {
    throw new Error('来源网址无效');
  }
  source.hash = '';
  const name = text(data.name, 250);
  if (!name) throw new Error('商品名称不能为空');
  const price = text(data.price, 24);
  if (price && (!/^\d{1,8}(\.\d{1,3})?$/.test(price) || !Number.isFinite(Number(price)))) {
    throw new Error('来源价格无效');
  }
  const currency = text(data.currency, 3).toLowerCase();
  if (currency && !/^[a-z]{3}$/.test(currency)) throw new Error('来源币种无效');
  return { source: source.href, name, price, currency, sku: text(data.sku, 120),
    description: text(data.description, 24000), category: text(data.sourceCategory, 180) };
}

async function existingImport(hash: string) {
  return env.DB.prepare(
    'SELECT p.public_id FROM product_import_sources s JOIN products p ON p.id = s.product_id WHERE s.source_hash = ?',
  ).bind(hash).first<{ public_id: string }>();
}

export const POST: APIRoute = async ({ request }) => {
  const secret = env.PRODUCT_IMPORT_TOKEN;
  if (!secret || !productImportConfigured(secret)) return reply({ error: '导入接口尚未配置' }, 503);
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || !await matchesToken(authorization.slice(7), secret)) {
    return reply({ error: '导入密钥无效' }, 401);
  }
  const length = Number(request.headers.get('content-length'));
  if (!Number.isSafeInteger(length) || length <= 0) return reply({ error: '缺少上传长度' }, 411);
  if (length > MAX_BODY) return reply({ error: '单件商品的图片总大小超限' }, 413);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) {
    return reply({ error: '仅支持商品资料和图片表单' }, 415);
  }

  let form: FormData;
  let product: ReturnType<typeof parseProduct>;
  try {
    form = await request.formData();
    product = parseProduct(form.get('product'));
  } catch {
    return reply({ error: '商品资料格式无效，请核对标题、来源网址、价格及字段长度' }, 400);
  }
  const hash = Array.from(await digest(product.source), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const storage = getStorage();
  const uploaded: string[] = [];
  const productId = generatePublicId('product');
  let attemptedBatch = false;
  try {
    const duplicate = await existingImport(hash);
    if (duplicate) return reply({ status: 'skipped', productId: duplicate.public_id }, 200);

    const files = form.getAll('images');
    if (files.length > MAX_IMAGES) return reply({ error: '每件商品最多 20 张图片' }, 413);
    let total = 0;
    const images = [];
    for (const file of files) {
      if (!(file instanceof File) || !file.size || validateUpload(file)) {
        return reply({ error: '图片必须是支持的格式，且每张最多 5 MiB' }, 400);
      }
      total += file.size;
      if (total > MAX_IMAGE_BYTES) return reply({ error: '图片总大小最多 25 MiB' }, 413);
      const bytes = await file.arrayBuffer();
      const dimensions = readImageDimensions(new Uint8Array(bytes));
      if (!dimensions) return reply({ error: '图片内容无法识别' }, 400);
      images.push({ file, bytes, dimensions, key: mediaKeyFor(file) });
    }

    const warnings: string[] = [];
    const currency = getConfig().currency;
    const price = product.price && product.currency === currency ? toMinorUnits(Number(product.price), currency) : 0;
    if (!product.price || product.currency !== currency) warnings.push('来源价格缺失或币种不同，请在上架前填写价格。');
    if (!images.length) warnings.push('商品没有图片，请在上架前补齐。');

    const category = product.category ? await env.DB
      .prepare('SELECT id FROM categories WHERE slug = ? OR name COLLATE NOCASE = ? LIMIT 2')
      .bind(product.category, product.category).all<{ id: number }>() : null;
    const categoryId = category?.results.length === 1 ? category.results[0].id : null;
    if (product.category && categoryId === null) warnings.push('未找到唯一匹配的分类，请在上架前选择分类。');

    const slugBase = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75) || 'product';
    const slug = slugBase + '-' + hash.slice(0, 12);
    const description = [product.sku ? 'SKU: ' + product.sku : '', product.description].filter(Boolean).join('\n\n');
    const batch = [
      env.DB.prepare('INSERT INTO products (public_id, name, slug, description, price_cents, currency, stock, active, image_key) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)')
        .bind(productId, product.name, slug, description || null, price, currency, images[0]?.key ?? null),
      env.DB.prepare('INSERT INTO product_import_sources (source_hash, product_id, source_sku) SELECT ?, id, ? FROM products WHERE public_id = ?')
        .bind(hash, product.sku || null, productId),
    ];
    if (categoryId !== null) {
      batch.push(env.DB.prepare('INSERT INTO product_categories (product_id, category_id) SELECT id, ? FROM products WHERE public_id = ?')
        .bind(categoryId, productId));
    }
    for (const [position, image] of images.entries()) {
      uploaded.push(image.key);
      await storage.put(image.key, image.bytes, image.file.type);
      batch.push(
        env.DB.prepare('INSERT INTO media (public_id, image_key, original_name, mime_type, size_bytes, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(generatePublicId('media'), image.key, image.file.name.slice(0, 250), image.file.type,
            image.file.size, image.dimensions.width, image.dimensions.height),
        env.DB.prepare('INSERT INTO product_images (public_id, product_id, image_key, position) SELECT ?, id, ?, ? FROM products WHERE public_id = ?')
          .bind(generatePublicId('productImage'), image.key, position, productId),
      );
    }
    attemptedBatch = true;
    await env.DB.batch(batch);
    return reply({ status: 'draft', productId, imagesAttached: images.length, warnings }, 201);
  } catch (error) {
    // A lost HTTP reply can follow a committed D1 batch. Confirm ownership
    // before removing uploaded objects, so retries cannot break a saved gallery.
    const recorded = await existingImport(hash).catch(() => undefined);
    if (!attemptedBatch || (recorded !== undefined && recorded?.public_id !== productId)) {
      await Promise.all(uploaded.map((key) => storage.delete(key).catch((cause) => {
        console.error('Draft import image cleanup failed', { key, cause });
      })));
    }
    if (recorded) {
      if (recorded.public_id === productId) return reply({ status: 'draft', productId, imagesAttached: uploaded.length }, 201);
      return reply({ status: 'skipped', productId: recorded.public_id }, 200);
    }
    console.error('Draft import failed', { productId, error });
    return reply({ error: '商品导入失败，可以重试' }, 500);
  }
};
