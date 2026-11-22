import { describe, expect, it } from 'vitest';
import { translatedPath, localizedHref, originalStorefrontPath } from './locale';
import { managedWhatsAppHref } from '../storefront/catalogMode';
import { popupDelays } from '../popup/settings';
import { robotsContent, seoControls } from '../seo/controls';

describe('localized storefront', () => {
  it('only rewrites storefront URLs and retains query parameters', () => {
    expect(translatedPath('/', 'zh-CN')).toBe('/zh');
    expect(localizedHref('/products/test?page=2#images', 'zh-CN')).toBe('/zh/products/test?page=2#images');
    expect(originalStorefrontPath('/zh/products/test')).toBe('/products/test');
    expect(localizedHref('/admin/products', 'zh-CN')).toBe('/admin/products');
    expect(localizedHref('//elsewhere.example/products', 'zh-CN')).toBe('//elsewhere.example/products');
  });

  it('rewrites merchant-authored direct WhatsApp links and keeps the message', () => {
    expect(managedWhatsAppHref('https://api.whatsapp.com/send?phone=12025550999&text=hello+there', '12025550122'))
      .toBe('https://wa.me/12025550122?text=hello+there');
    expect(managedWhatsAppHref('https://wa.me/12025550999', null)).toBeNull();
    expect(managedWhatsAppHref('https://chat.whatsapp.com/group', null)).toBe('https://chat.whatsapp.com/group');
  });

  it('only accepts increasing popup timing and uses a separate training group', () => {
    expect(popupDelays([5, 10, 15, 20])).toEqual([5, 10, 15, 20]);
    expect(popupDelays([5, 10, 10, 20])).toBeNull();
    const robots = robotsContent('https://shop.example', seoControls('{"crawlers":{"openai":true,"training":false}}'));
    expect(robots).toContain('User-agent: OAI-SearchBot\nAllow: /\nDisallow: /admin');
    expect(robots).toContain('User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /');
  });
});
