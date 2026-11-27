import { productMarkdownExcerpt } from './productMarkdown.ts';
import type { Product } from './db.ts';

export function productSeoFields(form: FormData) {
  return {
    seo_title: form.has('seo_title') ? String(form.get('seo_title') ?? '').trim() || null : undefined,
    meta_description: form.has('meta_description') ? String(form.get('meta_description') ?? '').trim() || null : undefined,
  };
}

export function isProductSlugConflict(error: unknown): boolean {
  return /UNIQUE constraint failed: products\.slug|Product slug is reserved/i.test(String(error));
}
interface ImportedProductSeo {
  title?: string;
  metaDescription?: string;
  h1?: string;
  intro?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
}

export function importedProductSeo(product: Product): ImportedProductSeo | null {
  if (!product.import_seo_json) return null;
  try { return JSON.parse(product.import_seo_json); }
  catch { return null; }
}

export function defaultProductMeta(description: string | null): string | null {
  return description ? productMarkdownExcerpt(description, 160) || null : null;
}
