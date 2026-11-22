import { describe, expect, it } from 'vitest';
import { attribution, isTrafficPath, trafficLabel } from './events';
import { parseAdPixels, storedAdPixels } from './pixelSettings';
import { readTrafficFilters } from './report';
import { trafficPeriod } from './period';

describe('traffic collection', () => {
  it('only collects allowlisted public storefront paths', () => {
    expect(isTrafficPath('/products/argentina-home')).toBe(true);
    expect(isTrafficPath('/admin/traffic')).toBe(false);
    expect(isTrafficPath('/products/argentina-home?token=secret')).toBe(false);
  });

  it('uses paid signals before referrals and distinguishes organic and AI sources', () => {
    expect(attribution({ referrer: 'www.bing.com' }).channel).toBe('organic');
    expect(attribution({ referrer: 'www.bing.com', adClick: true }).channel).toBe('paid');
    expect(attribution({ referrer: 'chatgpt.com' }).channel).toBe('ai');
    expect(attribution({ referrer: 'chatgpt.com.example.net' }).channel).toBe('referral');
    expect(attribution({}).channel).toBe('direct');
  });

  it('uses UTC periods and bounds dashboard filters', () => {
    const period = trafficPeriod(new URLSearchParams('days=7'), 'UTC', Date.UTC(2026, 10, 22, 3));
    expect(new Date(period.start * 1000).toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(readTrafficFilters(new URLSearchParams('country=US&channel=paid&source=google'))).toMatchObject({
      country: 'US', channel: 'paid', source: 'google',
    });
    expect(trafficLabel('a?b=c&d=e')).toBe('abcde');
  });

  it('validates IDs before any external script can be loaded', () => {
    expect(parseAdPixels({ meta: '123456789012345', googleAds: 'AW-123456789', ga4: 'G-TEST1234',
      tiktok: 'CTXTEST123456', googleAdsLabel: 'xy_A-1' })).toEqual({
      meta: '123456789012345', googleAds: 'AW-123456789', ga4: 'G-TEST1234',
      tiktok: 'CTXTEST123456', googleAdsLabel: 'xy_A-1',
    });
    expect(parseAdPixels({ meta: '<script>', ga4: 'javascript:' })).toEqual({});
    expect(storedAdPixels('{')).toEqual({});
  });
});
