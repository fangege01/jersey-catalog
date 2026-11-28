import type { D1Database } from '@cloudflare/workers-types';
import { parsePublicId } from '../ids/publicId';
import { getCategoriesByPublicIds } from './db';

export interface ProductTaxonomy {
  catalog_category_id?: number | null;
  team?: string | null;
  product_type?: string | null;
  sleeve_type?: string | null;
  product_tags?: string | null;
}

export function readProductTags(value: string | null | undefined): string[] {
  try {
    const tags: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

export async function parseProductTaxonomy(db: D1Database, form: FormData):
  Promise<{ data: ProductTaxonomy } | { error: string }> {
  if (!form.has('primary_category')) return { data: {} };
  const read = (key: string) => String(form.get(key) ?? '').trim();
  const rootValue = read('primary_category');
  const childValue = read('subcategory');
  const root = parsePublicId(rootValue, 'category');
  const child = parsePublicId(childValue, 'category');
  if ((rootValue && !root) || (childValue && (!child || !root))) return { error: '请选择有效的主要分类和子分类。' };
  const categories = await getCategoriesByPublicIds(db, [root, child].filter((id): id is string => !!id));
  const primary = categories.find((category) => category.public_id === root);
  const subcategory = categories.find((category) => category.public_id === child);
  if ((root && (!primary || primary.parent_id !== null)) ||
      (child && (!subcategory || subcategory.parent_id !== primary?.id))) {
    return { error: '子分类必须属于所选主要分类。' };
  }
  const team = read('team');
  const product_type = read('product_type');
  const sleeve_type = read('sleeve_type');
  const tags = [...new Set(read('product_tags').split(/[,，\r\n]+/).map((tag) => tag.trim()).filter(Boolean))];
  if ([team, product_type, sleeve_type].some((value) => value.length > 80) ||
      tags.length > 20 || tags.some((tag) => tag.length > 60)) {
    return { error: '商品属性最多 80 字符。最多保存 20 个标签，每个标签最多 60 字符。' };
  }
  return { data: {
    catalog_category_id: subcategory?.id ?? primary?.id ?? null,
    team: team || null, product_type: product_type || null, sleeve_type: sleeve_type || null,
    product_tags: tags.length ? JSON.stringify(tags) : null,
  } };
}
