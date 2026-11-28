import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getConfig } from '../../../config';
import {
  createProduct,
  getProduct,
  listProductImages,
  syncPrimaryImage,
  setProductFile,
} from '../../../features/products/db';
import { setProductCategories, getCategoriesByPublicIds } from '../../../features/categories/db';
import { parsePublicId } from '../../../features/ids/publicId';
import { indexProduct } from '../../../features/search';
import { parseProductForm } from '../../../features/products/form';
import { parseProductDetailSections, prepareProductDetailSections } from '../../../features/products/detailSections';
import { zonesRequireWeight } from '../../../features/shipping/calculator';
import { shippingFor } from '../../../features/shipping/effective';
import { adminProductSlug } from '../../../features/products/slug';
import { isProductSlugConflict, productSeoFields } from '../../../features/products/seo';
import { parseImageSeo, saveImageSeo } from '../../../features/products/imageSeo';
import { validateImage } from '../../../features/products/image';
import { optimizeUpload } from '../../../features/products/imageOptimize';
import { uploadMedia } from '../../../features/media/upload';
import { attachMediaToProduct, getMediaByPublicId, deleteMediaRecord } from '../../../features/media/db';
import { getStorage, getFileStorage } from '../../../features/storage';
import { uploadDigitalFile, validateDigitalFile } from '../../../features/products/digitalFile.ts';
import { productAttachmentsEnabled } from '../../../features/digitalDelivery/rollout.ts';
import { CACHE_TAG } from '../../../features/cache/tags';
import { purgeCacheTags } from '../../../features/cache/purge';
import { saveCopyInEnglish } from '../../../features/i18n/adminCopy';
import { parseProductTaxonomy } from '../../../features/categories/productTaxonomy';
import { applyVariantForm, validateVariantWeights } from '../../../features/products/variants';
import { productEditorResponse } from '../../../features/products/editorResponse';

export const prerender = false;

const MAX_GALLERY = 30;
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

// POST /api/admin/products — create a product and its gallery/options.
export const POST: APIRoute = async ({ request, locals }) => {
  const fail = (msg: string) => productEditorResponse(request, `/admin/products/new?error=${encodeURIComponent(msg)}`, msg);
  const form = await request.formData();
  // The store's display unit, plus whether a blank weight would make this product
  // unsellable (every enabled zone prices by weight). Both come from settings the
  // request already loaded.
  const weightUnit = locals.settings?.weightUnit ?? 'g';
  const catalogOnly = getConfig().features.catalogOnly;
  const parsed = parseProductForm(form, {
    catalogOnly,
    unit: weightUnit,
    requireWeight: zonesRequireWeight(shippingFor(locals.settings).config),
  });
  if ('error' in parsed) return fail(parsed.error);
  const taxonomy = await parseProductTaxonomy(env.DB, form);
  if ('error' in taxonomy) return fail(taxonomy.error);
  const sections = parseProductDetailSections(form);
  if ('error' in sections) return fail(sections.error);
  const badWeight = validateVariantWeights(form, weightUnit);
  if (badWeight) return fail(badWeight);
  if (['v_id', 'e_id', 'v_remove', 'e_remove'].some((key) => form.getAll(key).some((id) => Boolean(String(id).trim())))) {
    return fail('新增商品不能引用其他商品的规格或附加选项。');
  }
  const gallery = [];
  const order = form.getAll('gallery_order').map(String);
  const legacyImage = form.get('image');
  if (order.length === 0 && legacyImage instanceof File && legacyImage.size > 0) order.push('legacy');
  if (order.length === 0) {
    const files = form.getAll('images').filter((file): file is File => file instanceof File && file.size > 0);
    for (const [index, file] of files.entries()) {
      const id = 'file-' + index;
      order.push(id);
      form.set('gallery_file_' + id, file);
    }
  }
  if (order.length > MAX_GALLERY || new Set(order).size !== order.length ||
      order.some((id) => !/^[a-z0-9-]{1,48}$/.test(id))) return fail('相册顺序无效，最多可添加 30 张图片。');
  const selectedMedia = new Set<number>();
  let totalBytes = 0;
  for (const id of order) {
    const legacy = id === 'legacy';
    const raw = legacy ? legacyImage : form.get('gallery_file_' + id);
    const file = raw instanceof File && raw.size > 0 ? raw : null;
    const mediaPublicId = parsePublicId(form.get('gallery_media_' + id), 'media');
    const media = mediaPublicId ? await getMediaByPublicId(env.DB, mediaPublicId) : null;
    if ((!file && !media) || (file && media) || (media && selectedMedia.has(media.id))) {
      return fail('有图片不存在或重复，请检查商品相册。');
    }
    if (media) selectedMedia.add(media.id);
    if (file) {
      const invalid = validateImage(file);
      if (invalid) return fail(invalid);
      totalBytes += file.size;
      if (totalBytes > MAX_UPLOAD_BYTES) return fail('本次商品图片合计不能超过 60 MB。');
    }
    const metadata = legacy ? form : new FormData();
    if (!legacy) {
      metadata.set('image_filename', String(form.get('gallery_filename_' + id) ?? ''));
      metadata.set('alt', String(form.get('gallery_alt_' + id) ?? ''));
    }
    const seo = parseImageSeo(metadata);
    if ('error' in seo) return fail(seo.error);
    gallery.push({ id, file, media, seo });
  }
  const variantImageRefs = form.getAll('v_image').map(String);
  if (variantImageRefs.some((key) => key && !order.includes(key))) return fail('有规格图片已不存在，请重新选择。');
  const copy = await saveCopyInEnglish(env.DB, env.AI, 'product', { title: parsed.data.name, body: parsed.data.description });
  const url = await adminProductSlug(env.DB, String(form.get('slug') ?? ''), copy.title);
  if ('error' in url) return fail(url.error);
  const details = prepareProductDetailSections(env.DB, env.AI, sections.source);

  const deliverable = productAttachmentsEnabled(catalogOnly) ? form.get('deliverable') : null;
  if (deliverable instanceof File && deliverable.size > 0) {
    const fileError = validateDigitalFile(deliverable);
    if (fileError) return fail(fileError);
  }

  // image_key starts null and is derived from the gallery by syncPrimaryImage.
  // Writing the uploaded key here directly would be an UNGUARDED reference: the
  // media row is unreferenced until the attach lands, so a concurrent library
  // delete could leave the product pointing at an object that no longer exists.
  let productId: number;
  try {
    productId = await createProduct(env.DB, { ...parsed.data, ...taxonomy.data, ...productSeoFields(form), active: 0, name: copy.title,
      description: copy.body, image_key: null, slug: url.slug, detail_sections: details?.value }, copy.source);
  } catch (error) {
    if (isProductSlugConflict(error)) return fail('此商品网址已使用，请换一个网址或留空重试。');
    throw error;
  }
  // D1 and R2 cannot share a transaction. Stage the product offline, then
  // publish only after all guarded claims and related rows have succeeded.
  let deliverableKey: string | undefined;
  const uploadedMediaIds: number[] = [];
  const storage = getStorage();
  class InvalidGallery extends Error {}
  try {
    const keys: string[] = [];
    for (const [index, entry] of gallery.entries()) {
      const media = entry.file
        ? await uploadMedia(env.DB, storage, await optimizeUpload(entry.file), entry.file.name, copy.title,
          gallery.length > 1 ? index : undefined)
        : entry.media!;
      if (entry.file) uploadedMediaIds.push(media.id);
      const attached = await attachMediaToProduct(env.DB, productId, media.id, entry.seo.alt ?? copy.title);
      if (!attached.ok) throw new InvalidGallery(attached.error);
      keys.push(attached.imageKey);
    }
    const images = new Map((await listProductImages(env.DB, productId)).map((image) => [image.image_key, image]));
    const imageIds = new Map<string, number>();
    for (const [index, entry] of gallery.entries()) {
      const image = images.get(keys[index]);
      if (!image) throw new InvalidGallery('未找到上传的图片。');
      imageIds.set(entry.id, image.id);
      if (entry.seo.filename || entry.seo.title || entry.seo.caption) {
        const seoError = await saveImageSeo(env.DB, image, { ...entry.seo, alt: entry.seo.alt ?? copy.title });
        if (seoError) throw new InvalidGallery(seoError);
      }
    }
    if (keys.length) await syncPrimaryImage(env.DB, productId);
    const categoryPublicIds = form.getAll('category').map((value) => parsePublicId(value, 'category'))
      .filter((value): value is string => value !== null);
    const categoryIds = (await getCategoriesByPublicIds(env.DB, categoryPublicIds)).map((category) => category.id);
    if (taxonomy.data.catalog_category_id) categoryIds.push(taxonomy.data.catalog_category_id);
    if (categoryIds.length) await setProductCategories(env.DB, productId, [...new Set(categoryIds)]);
    form.delete('v_image');
    for (const key of variantImageRefs) form.append('v_image', String(imageIds.get(key) ?? ''));
    const options = await applyVariantForm(env.DB, productId, form, parsed.data.currency, weightUnit, catalogOnly);
    if (options.error) throw new InvalidGallery(options.error);
    if (deliverable instanceof File && deliverable.size > 0) {
      const uploaded = await uploadDigitalFile(getFileStorage(), deliverable);
      deliverableKey = uploaded.key;
      await setProductFile(env.DB, productId, uploaded);
    }
    await env.DB.prepare('UPDATE products SET active = ? WHERE id = ?').bind(parsed.data.active, productId).run();
  } catch (failure) {
    try {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM storefront_translations WHERE entity = ? AND public_id = (SELECT public_id FROM products WHERE id = ?)').bind('product', productId),
        env.DB.prepare('DELETE FROM product_image_url_aliases WHERE alias_key IN (SELECT seo_alias FROM product_images WHERE product_id = ?)').bind(productId),
        ...['product_variants', 'product_extras', 'product_images', 'product_categories']
          .map((table) => env.DB.prepare(`DELETE FROM ${table} WHERE product_id = ?`).bind(productId)),
        env.DB.prepare('DELETE FROM products WHERE id = ?').bind(productId),
      ]);
      for (const mediaId of uploadedMediaIds) {
        const key = await deleteMediaRecord(env.DB, mediaId);
        if (key) await storage.delete(key);
      }
      if (deliverableKey) await getFileStorage().delete(deliverableKey);
    } catch (cleanup) {
      console.error('Product creation cleanup failed', productId, cleanup);
    }
    if (failure instanceof InvalidGallery) return fail(failure.message);
    console.error('Product creation failed', productId, failure);
    return fail('商品未完成创建，请重试。');
  }

  // Keep the semantic-search index in sync (no-op unless vector search is on).
  // Never let an indexing hiccup block the create.
  const created = await getProduct(env.DB, productId);
  copy.sync(locals.cfContext, productId);
  details?.sync(locals.cfContext, productId, created?.public_id);
  try {
    if (created) await indexProduct(created);
  } catch (err) {
    console.error('Search index (create) failed:', err);
  }

  await purgeCacheTags([
    CACHE_TAG.catalog,
    ...(created?.public_id ? [CACHE_TAG.product(created.public_id)] : []),
  ]);
  return productEditorResponse(request, request.headers.get('accept')?.includes('application/json') && created?.public_id
    ? `/admin/products/${created.public_id}/edit?created=1` : '/admin/products');
};
