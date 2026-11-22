import type { AdPixels } from './pixelSettings';

type PixelCall = (...args: unknown[]) => void;
type MetaQueue = PixelCall & { callMethod?: PixelCall; queue: unknown[][]; push: PixelCall; loaded: boolean; version: string };
type TikTokEvents = unknown[][] & {
  [name: string]: unknown;
  page: PixelCall;
  track: PixelCall;
};
type TikTokQueue = TikTokEvents & {
  methods: string[];
  setAndDefer: (target: TikTokEvents, name: string) => void;
  instance: (id: string) => TikTokEvents;
  _i: Record<string, TikTokEvents & { _u?: string }>;
  _t: Record<string, number>;
  _o: Record<string, object>;
};
type PixelWindow = Window & {
  dataLayer?: unknown[];
  gtag?: PixelCall;
  fbq?: MetaQueue;
  _fbq?: MetaQueue;
  TiktokAnalyticsObject?: string;
  ttq?: TikTokQueue;
};

function script(src: string) {
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = src;
  document.head.appendChild(tag);
}

export function startPixels(config: AdPixels, ads: boolean, product: boolean) {
  const win = window as PixelWindow;
  const ga = config.ga4;
  const ad = ads ? config.googleAds : undefined;
  const meta = ads ? config.meta : undefined;
  const tikTok = ads ? config.tiktok : undefined;
  const googleId = ga ?? ad;
  if (googleId) {
    win.dataLayer ??= [];
    win.gtag ??= function () { win.dataLayer?.push(arguments); };
    win.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: ads ? 'granted' : 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    win.gtag('js', new Date());
    if (ga) win.gtag('config', ga, { allow_google_signals: ads, send_page_view: true });
    if (ad) win.gtag('config', ad, { send_page_view: false });
    script('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(googleId));
    if (ga && product) win.gtag('event', 'view_item', { send_to: ga, items: [{ item_id: location.pathname }] });
  }
  if (meta) {
    if (!win.fbq) {
      const queue = function (...args: unknown[]) {
        if (queue.callMethod) queue.callMethod(...args);
        else queue.queue.push(args);
      } as MetaQueue;
      queue.queue = [];
      queue.push = queue;
      queue.loaded = true;
      queue.version = '2.0';
      win.fbq = win._fbq = queue;
      script('https://connect.facebook.net/en_US/fbevents.js');
    }
    win.fbq('init', meta);
    win.fbq('trackSingle', meta, 'PageView');
    if (product) win.fbq('trackSingle', meta, 'ViewContent', { content_ids: [location.pathname] });
  }
  if (tikTok) {
    win.TiktokAnalyticsObject = 'ttq';
    const queue: TikTokQueue = win.ttq ??= Object.assign([] as unknown[][], { _i: {}, _t: {}, _o: {} }) as unknown as TikTokQueue;
    queue.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready',
      'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    queue.setAndDefer = (target, name) => {
      target[name] = (...args: unknown[]) => target.push([name, ...args]);
    };
    queue.instance = (id) => {
      const instance = queue._i[id] ??= [] as unknown as TikTokEvents;
      for (const method of queue.methods) queue.setAndDefer(instance, method);
      return instance;
    };
    for (const method of queue.methods) queue.setAndDefer(queue, method);
    const base = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    Object.assign(queue.instance(tikTok), { _u: base });
    queue._t[tikTok] = Date.now();
    queue._o[tikTok] = {};
    queue.page();
    if (product) queue.track('ViewContent', { contents: [{ content_id: location.pathname }] });
    script(base + '?sdkid=' + encodeURIComponent(tikTok) + '&lib=ttq');
  }

  return () => {
    if (ga) win.gtag?.('event', 'whatsapp_click', { send_to: ga });
    if (ad && config.googleAdsLabel) {
      win.gtag?.('event', 'conversion', { send_to: ad + '/' + config.googleAdsLabel });
    }
    if (meta) win.fbq?.('trackSingle', meta, 'Contact', { contact_channel: 'WhatsApp' });
    if (tikTok) win.ttq?.track('Contact', { description: 'WhatsApp click' });
  };
}
