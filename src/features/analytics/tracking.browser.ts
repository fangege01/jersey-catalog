import { isProductPath, TRACKING_PATH, trafficLabel } from './events';
import { startPixels } from './pixels.browser';
import { storedAdPixels } from './pixelSettings';

type Consent = 'reject' | 'analytics' | 'all';
const CONSENT_KEY = 'minshop:consent:v1';
const VISITOR_KEY = 'minshop:visitor';
const VISIT_KEY = 'minshop:visit';
const MONTHS = 90 * 86400000;
const SESSION_AGE = 30 * 60000;

function get(store: Storage, key: string) {
  try { return store.getItem(key); } catch { return null; }
}
function put(store: Storage, key: string, data: string) {
  try { store.setItem(key, data); } catch { /* Storage can be unavailable. */ }
}
function erase(store: Storage, key: string) {
  try { store.removeItem(key); } catch { /* Storage can be unavailable. */ }
}
function read<T>(store: Storage, key: string): T | null {
  try { return JSON.parse(get(store, key) ?? 'null') as T | null; } catch { return null; }
}

function landingData(path: string) {
  const current = new URL(location.href);
  let referrer = '';
  try {
    const ref = new URL(document.referrer);
    if (ref.origin !== current.origin) referrer = ref.hostname.toLowerCase().slice(0, 120);
  } catch { /* Direct visit. */ }
  return {
    landing: path,
    source: trafficLabel(current.searchParams.get('utm_source')),
    medium: trafficLabel(current.searchParams.get('utm_medium')),
    campaign: trafficLabel(current.searchParams.get('utm_campaign')),
    content: trafficLabel(current.searchParams.get('utm_content')),
    referrer,
    adClick: ['gclid', 'dclid', 'msclkid', 'ttclid', 'wbraid', 'gbraid'].some((key) => current.searchParams.has(key)),
  };
}

function tracker(path: string) {
  const now = Date.now();
  const visitor = read<{ id: string; started: number }>(localStorage, VISITOR_KEY);
  const known = visitor && now - visitor.started < MONTHS ? visitor : { id: crypto.randomUUID(), started: now };
  put(localStorage, VISITOR_KEY, JSON.stringify(known));
  type Visit = ReturnType<typeof landingData> & { id: string; last: number; visitor: string };
  let visit = read<Visit>(sessionStorage, VISIT_KEY);

  return (event: 'view' | 'whatsapp') => {
    const time = Date.now();
    if (!visit || visit.visitor !== known.id || time - visit.last >= SESSION_AGE) {
      visit = { ...landingData(path), id: crypto.randomUUID(), last: time, visitor: known.id };
    }
    visit.last = time;
    put(sessionStorage, VISIT_KEY, JSON.stringify(visit));
    const { id, last: _last, visitor: _visitor, ...attribution } = visit;
    const body = new Blob([JSON.stringify({
      ...attribution, path, id: crypto.randomUUID(), visitor: known.id, visit: id, event, consent: true,
    })], { type: 'application/json' });
    if (!navigator.sendBeacon?.(TRACKING_PATH, body)) {
      void fetch(TRACKING_PATH, { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  };
}

const controls = document.querySelector<HTMLElement>('[data-traffic-controls]');
const panel = controls?.querySelector<HTMLElement>('[data-consent-panel]');
const preferences = controls?.querySelector<HTMLButtonElement>('[data-consent-open]');
const path = controls?.dataset.path;
const privateSignal = navigator.doNotTrack === '1' ||
  (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

if (controls && panel && preferences && path && !privateSignal && typeof crypto.randomUUID === 'function') {
  let saved = read<{ value: Consent; time: number }>(localStorage, CONSENT_KEY);
  if (saved && (Date.now() - saved.time > MONTHS || !['reject', 'analytics', 'all'].includes(saved.value))) saved = null;
  let active: Consent | null = null;
  function activate(choice: Consent) {
    active = choice;
    if (choice === 'reject') return;
    const send = tracker(path!);
    const clickPixels = startPixels(storedAdPixels(controls?.dataset.pixels), choice === 'all', isProductPath(path!));
    send('view');
    document.addEventListener('click', (event) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || !(link.hasAttribute('data-whatsapp-inquiry') || /^https:\/\/wa\.me\/\d+/.test(link.href))) return;
      send('whatsapp');
      clickPixels();
    }, { capture: true });
  }

  preferences.hidden = false;
  if (saved) activate(saved.value);
  else panel.hidden = false;

  preferences.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) panel.querySelector<HTMLElement>('button')?.focus();
  });
  for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-consent]')) {
    button.addEventListener('click', () => {
      const value = button.dataset.consent as Consent;
      put(localStorage, CONSENT_KEY, JSON.stringify({ value, time: Date.now() }));
      if (value === 'reject') {
        erase(localStorage, VISITOR_KEY);
        erase(sessionStorage, VISIT_KEY);
      }
      panel.hidden = true;
      if (active !== null && active !== value) location.reload();
      else if (active === null) activate(value);
    });
  }
}
