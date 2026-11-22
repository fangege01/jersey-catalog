import { afterEach, describe, expect, it, vi } from 'vitest';
import { startPixels } from './pixels.browser';

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const scripts: string[] = [];
  const win = { dataLayer: [] as IArguments[], fbq: undefined as { queue: unknown[][] } | undefined,
    ttq: undefined as unknown[][] | undefined };
  vi.stubGlobal('window', win);
  vi.stubGlobal('location', { pathname: '/products/test-jersey' });
  vi.stubGlobal('document', {
    createElement: () => ({ src: '' }),
    head: { appendChild: (element: { src: string }) => scripts.push(element.src) },
  });
  return { scripts, win };
}

const configs = {
  ga4: 'G-TEST1234', googleAds: 'AW-123456789', googleAdsLabel: 'test-label',
  meta: '123456789012345', tiktok: 'C123456789',
};

describe('browser pixel adapters', () => {
  it('loads no vendors for empty settings and GA4 only for analysis consent', () => {
    const { scripts, win } = fixture();
    startPixels({}, true, false)();
    expect(scripts).toEqual([]);
    startPixels(configs, false, true)();
    expect(scripts).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-TEST1234']);
    expect(win.dataLayer.map((args) => Array.from(args))).toContainEqual([
      'event', 'whatsapp_click', { send_to: 'G-TEST1234' },
    ]);
  });

  it('queues ads events as contact clicks for configured destinations', () => {
    const { scripts, win } = fixture();
    startPixels(configs, true, true)();
    expect(scripts.map((value) => new URL(value).hostname)).toEqual([
      'www.googletagmanager.com', 'connect.facebook.net', 'analytics.tiktok.com',
    ]);
    expect(win.dataLayer.map((args) => Array.from(args))).toContainEqual([
      'event', 'conversion', { send_to: 'AW-123456789/test-label' },
    ]);
    expect(win.fbq?.queue).toContainEqual(['trackSingle', configs.meta, 'Contact', { contact_channel: 'WhatsApp' }]);
    expect(win.ttq).toContainEqual(['track', 'Contact', { description: 'WhatsApp click' }]);
  });
});
