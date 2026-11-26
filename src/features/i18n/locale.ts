import { isTrafficPath } from '../analytics/events';

export const languages = { en: 'English', 'zh-CN': '简体中文' } as const;
export type StoreLocale = keyof typeof languages;
export type LocaleEntity = 'product' | 'category' | 'page';

/** Simplified Chinese is a transitional storefront language. */
export function isIndexableStorefrontLocale(locale: string): boolean {
  return locale !== 'zh-CN';
}

export function translatedPath(path: string, locale: StoreLocale): string {
  return locale === 'zh-CN' && isTrafficPath(path) ? '/zh' + (path === '/' ? '' : path) : path;
}

export function localizedHref(href: string, locale: StoreLocale): string {
  if (locale !== 'zh-CN' || !href.startsWith('/') || href.startsWith('//')) return href;
  const path = href.split(/[?#]/, 1)[0];
  return translatedPath(path, locale) + href.slice(path.length);
}

export function storefrontLanguage(path: string): StoreLocale {
  return /^\/zh(?:-cn)?(?:\/|$)/.test(path) ? 'zh-CN' : 'en';
}

export function originalStorefrontPath(path: string): string {
  return storefrontLanguage(path) === 'zh-CN' ? path.replace(/^\/zh(?:-cn)?/, '') || '/' : path;
}

export function display(locale: StoreLocale | undefined, english: string, chinese: string): string {
  return locale === 'zh-CN' ? chinese : english;
}
