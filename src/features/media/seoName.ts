import { slugify } from '../products/slug.ts';

const validFilename = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|png|webp)$/u;
const genericStem = /^(?:\d+|[a-f0-9]{16,}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|(?:img|image|pic|photo|dsc|pxl|file|download|screenshot|product)(?:-?\d+)*)$/u;

/** Use product data alone. Never add claims about an unknown image angle or content. */
export function productImageFilename(label: string, extension: string, position?: number): string {
  const name = slugify(label).replace(/-+$/u, '');
  const stem = name === 'product' ? 'football-jersey' : name.replace(/-photo$/u, '');
  return `${stem}-photo${position === undefined ? '' : `-${position + 1}`}.${extension}`;
}

export function approvedImageFilename(name: string, extension: string): boolean {
  return name.length <= 120 && name.endsWith('.' + extension) && validFilename.test(name) &&
    !genericStem.test(name.slice(0, -(extension.length + 1)));
}

export function libraryImageLabel(originalName: string, customLabel: string): string | undefined {
  const stem = slugify(customLabel.trim() || originalName.replace(/\.[^.]+$/u, '')).replace(/-+$/u, '');
  return genericStem.test(stem) ? undefined : stem;
}

export function storedSeoFilename(key: string): string | undefined {
  return /^media\/[a-f0-9]{20}\/([^/]+)$/u.exec(key)?.[1];
}
