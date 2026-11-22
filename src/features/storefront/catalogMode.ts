import type { StoreLocale } from '../i18n/locale';

const PURCHASE_PATHS = [
  '/cart', '/checkout', '/express', '/pay', '/payment-setup',
  '/api/cart', '/api/checkout', '/partials/cart', '/partials/cart-count',
];

export function isPurchasePath(pathname: string): boolean {
  return PURCHASE_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));
}

export function normalizeWhatsAppNumber(input: string): string | null {
  const digits = input.trim().replace(/^\+/, '').replace(/[ ()-]/g, '');
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
}

/** Apply the store number to merchant-authored direct chat links. */
export function managedWhatsAppHref(href: string, number: string | null): string | null {
  if (!URL.canParse(href)) return href;
  const original = new URL(href);
  const directChat = original.protocol === 'https:' && (
    (original.hostname === 'wa.me' && /^\/\+?\d+\/?$/.test(original.pathname)) ||
    (['api.whatsapp.com', 'web.whatsapp.com'].includes(original.hostname) && /^\/send\/?$/.test(original.pathname))
  );
  if (!directChat && !(original.protocol === 'whatsapp:' && original.hostname === 'send')) return href;

  const base = whatsappInquiryUrl(number);
  if (!base) return null;
  const link = new URL(base);
  const message = original.searchParams.get('text');
  if (message) link.searchParams.set('text', message.slice(0, 1200));
  return link.href;
}

export function whatsappInquiryUrl(
  number: string | null | undefined,
  product?: { name: string; url: string },
  variant?: { label: string; sku?: string | null },
  locale?: StoreLocale,
): string | null {
  const digits = normalizeWhatsAppNumber(number ?? '');
  if (!digits) return null;

  const url = new URL('https://wa.me/' + digits);
  if (!product) return url.href;

  const zh = locale === 'zh-CN';
  const lines = [zh ? '你好，我想咨询这件商品。' : 'Hello, I am interested in this product.', '',
    (zh ? '商品：' : 'Product: ') + product.name];
  if (variant) lines.push((zh ? '规格：' : 'Option: ') + variant.label);
  if (variant?.sku) lines.push('SKU: ' + variant.sku);
  lines.push((zh ? '商品链接：' : 'Product URL: ') + product.url, '', zh ? '请提供更多信息。' : 'Please provide more details.');
  url.searchParams.set('text', lines.join('\n'));
  return url.href;
}
