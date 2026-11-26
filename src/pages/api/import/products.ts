import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getConfig } from '../../../config';
import { generatePublicId } from '../../../features/ids/publicId';
import { validateUpload, mediaKeyFor } from '../../../features/media/upload';
import { approvedImageFilename } from '../../../features/media/seoName';
import { readImageDimensions } from '../../../features/media/dimensions';
import { getStorage } from '../../../features/storage';
import { PRODUCT_IMPORT_TOKEN_PATTERN, productImportConfigured } from '../../../features/admin/importConfig';
import { CACHE_TAG, productCacheTags } from '../../../features/cache/tags';
import { purgeCacheTags } from '../../../features/cache/purge';
import { attachPublicationUploads, recordPublicationUploads } from '../../../features/products/publicationUploads';
import { toMinorUnits } from '../../../money';

export const prerender = false;

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_BODY = MAX_IMAGE_BYTES + 256 * 1024;
const SEO_IMAGE_EXTENSIONS = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

function reply(data: object, status: number) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export const HEAD: APIRoute = async () => {
  if (!productImportConfigured(env.PRODUCT_IMPORT_TOKEN)) return new Response(null, { status: 503 });
  const schema = await env.DB.prepare('SELECT p.import_seo_json, i.content_sha256 FROM products p LEFT JOIN product_images i ON i.product_id = p.id LIMIT 1').all().catch(() => null);
  const publishing = schema?.success && await env.DB.prepare('SELECT f.payload_hash, (SELECT state FROM publication_upload_objects LIMIT 1) AS upload_state FROM product_publications f LIMIT 1').all().catch(() => null);
  return new Response(null, { status: schema?.success ? 204 : 503, headers: {
    'cache-control': 'no-store', ...(schema?.success ? { 'x-fxf-image-seo': '1' } : {}), ...(publishing && publishing.success ? { 'x-fxf-publish': '1' } : {}),
  } });
};

function parseImageSeo(raw: FormDataEntryValue | null, count: number) {
  if (raw === null) return null;
  if (typeof raw !== 'string' || raw.length > 40000) throw new Error('图片 SEO 数据量无效');
  const list: unknown = JSON.parse(raw);
  if (!Array.isArray(list) || list.length !== count) throw new Error('图片 SEO 数量与文件不匹配');
  return list.map((value: Record<string, unknown>) => {
    const angle = text(value.angle, 20);
    const sha256 = text(value.sha256, 64);
    if (!['', 'front', 'back', 'detail', 'model', 'lifestyle', 'product'].includes(angle) ||
        !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('图片角度或内容哈希无效');
    return { alt: text(value.alt, 500), title: text(value.title, 500), caption: text(value.caption, 500), angle, sha256, decorative: value.decorative === true };
  });
}

function parseProductSeo(raw: FormDataEntryValue | null) {
  if (raw === null) return null;
  if (typeof raw !== 'string' || raw.length > 16000) throw new Error('商品 SEO 数据量无效');
  const data = JSON.parse(raw) as Record<string, unknown>;
  const seo = { title: text(data.title, 160), metaDescription: text(data.metaDescription, 320),
    intro: text(data.intro, 1000), description: text(data.description, 12000), slug: text(data.slug, 75),
    h1: text(data.h1, 200), keywords: text(data.keywords, 500), ogTitle: text(data.ogTitle ?? '', 160), ogDescription: text(data.ogDescription ?? '', 320) };
  if (!seo.title || !seo.h1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seo.slug)) throw new Error('商品 SEO 标题或 Slug 无效');
  return seo;
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

async function publication(hash: string) {
  return env.DB.prepare(
    'SELECT p.public_id, p.active, f.payload_hash FROM product_import_sources s JOIN products p ON p.id = s.product_id LEFT JOIN product_publications f ON f.product_id = p.id WHERE s.source_hash = ?',
  ).bind(hash).first<{ public_id: string; active: number; payload_hash: string | null }>();
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
  let payloadHash = '';
  const publish = form.get('intent') === 'publish';
  try {
    const duplicate = await existingImport(hash);
    if (duplicate && !publish) return reply({ status: 'skipped', productId: duplicate.public_id }, 200);

    const files = form.getAll('images');
    if (files.length > MAX_IMAGES) return reply({ error: '每件商品最多 20 张图片' }, 413);
    let metadata;
    let productSeo;
    try {
      metadata = parseImageSeo(form.get('imageSeo'), files.length);
      productSeo = parseProductSeo(form.get('productSeo'));
      if (Boolean(metadata) !== Boolean(productSeo)) throw new Error('商品与图片 SEO 必须同时提交');
    }
    catch { return reply({ error: '图片 SEO 资料无效' }, 400); }
    const sku = product.sku.trim().toLowerCase();
    if (publish) {
      if (!sku || !files.length || !productSeo || Object.values(productSeo).some(value => !value) ||
          !metadata || metadata.some(image => !image.title || !image.angle || (!image.decorative && !image.alt))) {
        return reply({ error: '正式发布需要完整商品 SEO、SKU 和图片审核资料' }, 422);
      }
      const names = files.map(file => file instanceof File ? file.name : '');
      const explicitNames = files.flatMap(file => file instanceof File &&
        approvedImageFilename(file.name, SEO_IMAGE_EXTENSIONS.get(file.type) ?? '') ? [file.name] : []);
      const alts = metadata.map(image => image.alt.toLowerCase()).filter(Boolean);
      if (new Set(explicitNames).size !== explicitNames.length || new Set(alts).size !== alts.length) return reply({ error: '图片 SEO 文件名或 ALT 重复' }, 422);
      payloadHash = Array.from(await digest(JSON.stringify([product, productSeo, metadata, names])), byte => byte.toString(16).padStart(2, '0')).join('');
      if (duplicate) {
        const prior = await publication(hash);
        if (prior?.active && prior.payload_hash === payloadHash) return reply({ status: 'published', productId: prior.public_id, imagesAttached: files.length, replay: true }, 200);
        return reply({ error: '该来源已存在，请核对是否重复导入或需要更新现有商品', productId: duplicate.public_id }, 409);
      }
      const previous = await env.DB.prepare('SELECT p.public_id FROM products p LEFT JOIN product_import_sources s ON s.product_id = p.id LEFT JOIN product_publications f ON f.product_id = p.id WHERE lower(trim(s.source_sku)) = ? OR f.sku_key = ? OR p.slug = ? LIMIT 1')
        .bind(sku, sku, productSeo.slug).first<{ public_id: string }>();
      const redirected = await env.DB.prepare('SELECT old_slug FROM product_slug_redirects WHERE old_slug = ?').bind(productSeo.slug).first();
      if (previous || redirected) return reply({ error: 'SKU 或 Slug 已存在，请核对现有商品，系统未覆盖任何资料', productId: previous?.public_id }, 409);
    }
    let total = 0;
    const images = [];
    for (const [position, file] of files.entries()) {
      if (!(file instanceof File) || !file.size || validateUpload(file)) {
        return reply({ error: '图片必须是支持的格式，且每张最多 5 MiB' }, 400);
      }
      total += file.size;
      if (total > MAX_IMAGE_BYTES) return reply({ error: '图片总大小最多 25 MiB' }, 413);
      const bytes = await file.arrayBuffer();
      const dimensions = readImageDimensions(new Uint8Array(bytes));
      if (!dimensions) return reply({ error: '图片内容无法识别' }, 400);
      const seo = metadata?.[position];
      const extension = SEO_IMAGE_EXTENSIONS.get(file.type);
      if (seo) {
        const contentHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          byte => byte.toString(16).padStart(2, '0')).join('');
        if (contentHash !== seo.sha256 || !extension) {
          return reply({ error: 'SEO 图片格式或内容哈希无效' }, 400);
        }
      }
      const named = seo && extension && approvedImageFilename(file.name, extension);
      const key = named ? mediaKeyFor(file).replace(/\.[^.]+$/, '/') + file.name
        : mediaKeyFor(file, productSeo?.slug ?? product.name, position);
      images.push({ file, bytes, dimensions, seo, key });
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
    const slug = publish && productSeo ? productSeo.slug : (productSeo?.slug || slugBase) + '-' + hash.slice(0, 12);
    const description = [product.sku ? 'SKU: ' + product.sku : '', product.description].filter(Boolean).join('\n\n');
    const batch = [
      env.DB.prepare('INSERT INTO products (public_id, name, slug, description, price_cents, currency, stock, active, image_key) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)')
        .bind(productId, product.name, slug, description || null, price, currency, images[0]?.key ?? null),
      env.DB.prepare('INSERT INTO product_import_sources (source_hash, product_id, source_sku) SELECT ?, id, ? FROM products WHERE public_id = ?')
        .bind(hash, product.sku || null, productId),
    ];
    if (productSeo) {
      batch.push(env.DB.prepare('UPDATE products SET import_seo_json = ? WHERE public_id = ?')
        .bind(JSON.stringify(productSeo), productId));
    }
    if (categoryId !== null) {
      batch.push(env.DB.prepare('INSERT INTO product_categories (product_id, category_id) SELECT id, ? FROM products WHERE public_id = ?')
        .bind(categoryId, productId));
    }
    if (publish) await recordPublicationUploads(env.DB, productId, hash, images.map(image => image.key));
    for (const [position, image] of images.entries()) {
      uploaded.push(image.key);
      await storage.put(image.key, image.bytes, image.file.type);
      if (publish) {
        const object = await storage.get(image.key);
        if (!object || object.contentType !== image.file.type) throw new Error('R2 图片验证失败');
        const stored = await new Response(object.body).arrayBuffer();
        const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', stored)), byte => byte.toString(16).padStart(2, '0')).join('');
        if (sha !== image.seo?.sha256) throw new Error('R2 内容校验失败');
      }
      batch.push(
        env.DB.prepare('INSERT INTO media (public_id, image_key, original_name, mime_type, size_bytes, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(generatePublicId('media'), image.key, image.file.name.slice(0, 250), image.file.type,
            image.file.size, image.dimensions.width, image.dimensions.height),
        image.seo
          ? env.DB.prepare('INSERT INTO product_images (public_id, product_id, image_key, position, alt, title, caption, angle, content_sha256) SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM products WHERE public_id = ?')
            .bind(generatePublicId('productImage'), image.key, position, image.seo.alt, image.seo.title || null,
              image.seo.caption || null, image.seo.angle || null, image.seo.sha256, productId)
          : env.DB.prepare('INSERT INTO product_images (public_id, product_id, image_key, position) SELECT ?, id, ?, ? FROM products WHERE public_id = ?')
          .bind(generatePublicId('productImage'), image.key, position, productId),
      );
    }
    if (publish) {
      batch.push(
        env.DB.prepare('INSERT INTO product_publications (product_id, sku_key, payload_hash, image_count) SELECT id, ?, ?, ? FROM products WHERE public_id = ?')
          .bind(sku, payloadHash, images.length, productId),
        env.DB.prepare('UPDATE products SET active = 1 WHERE public_id = ? AND EXISTS (SELECT 1 FROM product_publications f WHERE f.product_id = products.id)')
          .bind(productId),
        attachPublicationUploads(env.DB, productId),
      );
    }
    attemptedBatch = true;
    await env.DB.batch(batch);
    if (publish) await purgeCacheTags([CACHE_TAG.catalog, CACHE_TAG.shell, ...productCacheTags([productId])]).catch(error => console.warn('Publication cache purge failed', error));
    return reply({ status: publish ? 'published' : 'draft', productId, imagesAttached: images.length, warnings }, 201);
  } catch (error) {
    // A lost HTTP reply can follow a committed D1 batch. Confirm ownership
    // before removing uploaded objects, so retries cannot break a saved gallery.
    const recorded = await existingImport(hash).catch(() => undefined);
    if (!attemptedBatch || (recorded !== undefined && recorded?.public_id !== productId)) {
      await Promise.all(uploaded.map((key) => storage.delete(key).catch((cause) => {
        console.error('Draft import image cleanup failed', { key, cause });
      })));
    }
    if (publish) {
      const prior = await publication(hash).catch(() => null);
      if (prior?.active && prior.payload_hash === payloadHash) return reply({ status: 'published', productId: prior.public_id, replay: true }, 200);
      if (recorded || (error instanceof Error && /unique|duplicate|reserved/i.test(error.message))) {
        return reply({ error: 'SKU、来源或 Slug 与现有记录冲突，未覆盖商品', productId: recorded?.public_id }, 409);
      }
      console.error('Product publication failed', { productId, error });
      return reply({ error: '正式发布失败，商品未确认发布，可用同一任务重试' }, 500);
    }
    if (recorded) {
      if (recorded.public_id === productId) return reply({ status: 'draft', productId, imagesAttached: uploaded.length }, 201);
      return reply({ status: 'skipped', productId: recorded.public_id }, 200);
    }
    console.error('Draft import failed', { productId, error });
    return reply({ error: '商品导入失败，可以重试' }, 500);
  }
};
