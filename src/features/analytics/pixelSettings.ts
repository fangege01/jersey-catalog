export const pixelFields = {
  meta: { label: 'Meta（Facebook）像素 ID', format: /^\d{5,30}$/, placeholder: '123456789012345' },
  ga4: { label: 'Google Analytics 4 衡量 ID', format: /^G-[A-Z0-9]{4,20}$/, placeholder: 'G-XXXXXXXXXX' },
  googleAds: { label: 'Google Ads 转化 ID', format: /^AW-\d{5,20}$/, placeholder: 'AW-123456789' },
  googleAdsLabel: { label: 'Google Ads 转化标签', format: /^[A-Za-z0-9_-]{1,80}$/, placeholder: 'AbCdEfGhijk' },
  tiktok: { label: 'TikTok 像素 ID', format: /^[A-Z0-9]{8,40}$/, placeholder: 'CXXXXXXXXXXXXXXXXXXX' },
} as const;

type PixelKey = keyof typeof pixelFields;
export const pixelKeys = Object.keys(pixelFields) as PixelKey[];
export type AdPixels = Partial<Record<PixelKey, string>>;

export function parseAdPixels(input: unknown): AdPixels {
  if (!input || typeof input !== 'object') return {};
  const entries = input as Record<string, unknown>;
  const pixels: AdPixels = {};
  for (const key of pixelKeys) {
    const candidate = entries[key];
    if (typeof candidate === 'string' && pixelFields[key].format.test(candidate)) pixels[key] = candidate;
  }
  return pixels;
}

export function storedAdPixels(value?: string): AdPixels {
  if (!value) return {};
  try { return parseAdPixels(JSON.parse(value)); } catch { return {}; }
}
