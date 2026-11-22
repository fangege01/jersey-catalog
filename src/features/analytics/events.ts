export const TRACKING_PATH = '/api/traffic';

export const channels = {
  direct: '直接访问 / 未知',
  organic: '自然搜索',
  ai: 'AI 引荐',
  social: '社交媒体',
  paid: '广告推广',
  referral: '其他引荐',
} as const;

export type Channel = keyof typeof channels;
export type EventKind = 'page_view' | 'product_view' | 'whatsapp_click';

import { isInformationPath } from '../site-content/copy';

export function isTrafficPath(path: string): boolean {
  return path.length <= 150 && (
    path === '/' || isInformationPath(path) || /^\/(products|search)\/?$/.test(path) ||
    /^\/(products|categories|pages)\/[a-z0-9][a-z0-9-]*\/?$/.test(path)
  );
}

export function isProductPath(path: string): boolean {
  return path.startsWith('/products/') && path !== '/products/';
}

// Keep campaign labels only. Do not persist full query strings or identifiers in click URLs.
export function trafficLabel(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().slice(0, 80).replace(/[^\p{L}\p{N}_.+ -]/gu, '')
    : '';
}

export function attribution(data: Record<string, unknown>): { channel: Channel; source: string } {
  const source = trafficLabel(data.source).toLowerCase();
  const medium = trafficLabel(data.medium).toLowerCase();
  const referrer = typeof data.referrer === 'string' && /^[a-z0-9.-]{1,120}$/i.test(data.referrer)
    ? data.referrer.toLowerCase()
    : '';
  const isHost = (domain: string) => referrer === domain || referrer.endsWith('.' + domain);
  const search = referrer.match(/^(?:[a-z0-9-]+\.)?(google\.(?:com|[a-z]{2}|(?:co|com)\.[a-z]{2})|bing\.com|duckduckgo\.com|yahoo\.com|baidu\.com)$/);
  if (/^(cpc|ppc|paid[-_ ]?(search|social)?|display|cpm)$/.test(medium) || data.adClick === true) {
    return { channel: 'paid', source: source || referrer || 'ad' };
  }
  if (['chatgpt.com', 'perplexity.ai', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com'].some(isHost) ||
      /^(chatgpt|perplexity|claude|gemini|copilot)$/.test(source)) {
    return { channel: 'ai', source: source || referrer };
  }
  if (medium === 'organic' || search) return { channel: 'organic', source: source || search?.[1] || referrer };
  if (medium === 'social' || /^(facebook|instagram|tiktok|twitter|x)$/.test(source) ||
      ['facebook.com', 'instagram.com', 'tiktok.com', 't.co', 'x.com'].some(isHost)) {
    return { channel: 'social', source: source || referrer || 'social' };
  }
  if (source || referrer) return { channel: 'referral', source: source || referrer };
  return { channel: 'direct', source: '' };
}

export function deviceInfo(userAgent: string) {
  const ua = userAgent.slice(0, 450);
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? '平板' :
    /Mobile|iPhone|Android/i.test(ua) ? '手机' : ua ? '电脑' : '未知';
  const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' :
    /iPhone|iPad/i.test(ua) ? 'iOS' : /Macintosh/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '未知';
  const browser = /Edg[eiA]?\//i.test(ua) ? 'Edge' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' :
    /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : '其他';
  return { device, os, browser };
}
