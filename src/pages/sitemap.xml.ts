import type { APIRoute } from 'astro';
import { PUBLIC_CACHE_CONTROL } from '../features/cache/public';
import { env } from 'cloudflare:workers';
import { listCategories } from '../features/categories/db';
import { listPublishedPages } from '../features/pages/db';
import { catalogPath } from '../features/settings/home';
import { informationPages, siteSections } from '../features/site-content/copy';
import { getConfig } from '../config';
import { productImageUrl } from '../features/products/image';
import { publicOrigin } from '../features/http/origin';

export const prerender = false;

/**
 * Every URL the sitemap should list, in order.
 *
 * The catalog is included at whichever address it actually lives at. When the
 * home page has been pointed at a page or product, `/` renders that target and
 * canonicals to it — so listing `/` would put a non-canonical duplicate in the
 * sitemap (the target is already listed on its own URL), while the real catalog
 * at `/products` would be missing entirely.
 *
 * Pure and exported so the rule is testable without standing up a request.
 */
export function sitemapLocs(
  origin: string,
  homePage: string | null | undefined,
  data: {
    categories: { slug: string }[];
    products: { slug: string }[];
    pages: { slug: string }[];
  },
  separateCatalog = false,
): string[] {
  return [
    ...(separateCatalog && !homePage ? [origin + '/'] : []),
    `${origin}${separateCatalog ? '/products' : catalogPath(homePage)}`,
    ...data.categories.map((c) => `${origin}/categories/${c.slug}`),
    ...data.products.map((p) => `${origin}/products/${p.slug}`),
    // Published pages only — drafts must not be discoverable.
    ...data.pages.map((p) => `${origin}/pages/${p.slug}`),
  ];
}

function xmlUrl(url: string): string {
  return url.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// Gallery entries come only from active products, in one query for the sitemap.
export const GET: APIRoute = async ({ url, locals }) => {
  const origin = publicOrigin(url.origin, env.CANONICAL_ORIGIN);
  const [{ results: products }, categories, pages, { results: gallery }] = await Promise.all([
    env.DB.prepare('SELECT slug, image_key FROM products WHERE active = 1 ORDER BY created_at DESC')
      .all<{ slug: string; image_key: string | null }>(),
    listCategories(env.DB),
    listPublishedPages(env.DB),
    env.DB.prepare(`
      SELECT p.slug, i.image_key FROM product_images i JOIN products p ON p.id = i.product_id
      WHERE p.active = 1 ORDER BY p.id, i.position, i.id
    `).all<{ slug: string; image_key: string }>(),
  ]);
  const images = new Map<string, Set<string>>(products.map((product) => [
    product.slug, new Set(product.image_key ? [product.image_key] : []),
  ]));
  for (const image of gallery) images.get(image.slug)?.add(image.image_key);

  const home = locals.settings?.homePage;
  const separateCatalog = import.meta.env.MINSHOP_THEME === 'teal';
  const informationPaths = informationPages.map(section => siteSections[section].url);
  const locs = sitemapLocs(origin, home, { categories, products, pages }, separateCatalog);
  locs.push(...informationPaths.map(path => origin + path));
  const imageBase = getConfig().images.baseUrl;
  const entries = locs.map((loc) => {
    const slug = new URL(loc).pathname.match(/^\/products\/([^/]+)$/)?.[1];
    const keys = slug ? images.get(slug) : undefined;
    const imageTags = [...(keys ?? [])].slice(0, 1000).map((key) => {
      const image = new URL(productImageUrl(key, imageBase), origin).href;
      return `<image:image><image:loc>${xmlUrl(image)}</image:loc></image:image>`;
    });
    return `  <url><loc>${xmlUrl(loc)}</loc>${imageTags.join('')}</url>`;
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': PUBLIC_CACHE_CONTROL,
    },
  });
};
