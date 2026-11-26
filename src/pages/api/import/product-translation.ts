import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parsePublicId } from '../../../features/ids/publicId';
import { PRODUCT_IMPORT_TOKEN_PATTERN } from '../../../features/admin/importConfig';
import { CACHE_TAG } from '../../../features/cache/tags';
import { purgeCacheTags } from '../../../features/cache/purge';
import {
  parseReviewedTranslation, pilotLocale, productPaths, publishReviewedTranslation, sha256, translationSource,
} from '../../../features/i18n/productPublication';

export const prerender = false;
const limit = 180_000;
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store' } });

async function authorized(request: Request) {
  const expected = env.PRODUCT_TRANSLATION_TOKEN;
  const supplied = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!expected || !supplied || !PRODUCT_IMPORT_TOKEN_PATTERN.test(expected) || !PRODUCT_IMPORT_TOKEN_PATTERN.test(supplied)) return false;
  const [a, b] = await Promise.all([sha256(expected), sha256(supplied)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!await authorized(request)) return reply({ error: '译文接口未授权。' }, 401);
  const productId = parsePublicId(url.searchParams.get('productId'), 'product');
  if (!productId) return reply({ error: '商品标识无效。' }, 400);
  const data = await translationSource(env.DB, productId);
  return data ? reply({ locale: pilotLocale, productId, revision: data.revision, version: data.version, facts: data.facts,
    status: data.revision > 0 ? 'published' : 'unpublished' }) : reply({ error: '未找到具备正式英文发布记录和相册校验信息的商品。' }, 404);
};

async function reviewedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('缺少审核译文。');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.length;
      if (bytes > limit) throw new Error('译文数据超出限制。');
      text += decoder.decode(next.value, { stream: true });
    }
    return parseReviewedTranslation(JSON.parse(text + decoder.decode()));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!await authorized(request)) return reply({ error: '译文接口未授权。' }, 401);
  if (request.headers.get('content-type')?.split(';', 1)[0].trim() !== 'application/json') return reply({ error: '需要 JSON 译文。' }, 415);
  let input;
  try { input = await reviewedBody(request); }
  catch { return reply({ error: '译文格式、人工审核状态或字段不符合要求。' }, 400); }
  try {
    const snapshot = await translationSource(env.DB, input.productId);
    if (!snapshot) return reply({ error: '英文发布记录或相册不可用。' }, 404);
    if (!await publishReviewedTranslation(env.DB, input, snapshot)) return reply({ error: '商品、图片或译文版本已变化，请重新审核。' }, 409);
    await purgeCacheTags([CACHE_TAG.catalog, CACHE_TAG.product(input.productId)]);
    return reply({ status: 'published', productId: input.productId, revision: input.revision + 1,
      path: productPaths(snapshot.source.slug, input.copy.slug)[pilotLocale] });
  } catch (error) {
    if (error instanceof Error && /unique constraint|localized slug reserved/i.test(error.message)) {
      return reply({ error: '该语言的商品网址已被使用。' }, 409);
    }
    console.error('Product translation publication failed', { productId: input.productId, error });
    return reply({ error: '发布未能确认，请重试同一份已审核译文。' }, 500);
  }
};
