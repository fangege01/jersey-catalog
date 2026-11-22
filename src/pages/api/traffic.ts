import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { checkRateLimit } from '../../features/auth/rateLimit';
import { attribution, deviceInfo, isProductPath, isTrafficPath, trafficLabel, TRACKING_PATH } from '../../features/analytics/events';

export const prerender = false;

const MAX_BYTES = 2048;
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function status(code: number) {
  return new Response(null, { status: code, headers: { 'cache-control': 'private, no-store' } });
}

async function readEvent(request: Request): Promise<Record<string, unknown> | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  const data: unknown = JSON.parse(text + decoder.decode());
  return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
}

export const POST: APIRoute = async ({ request, url }) => {
  if (request.headers.get('origin') !== url.origin) return status(403);
  if (request.headers.get('sec-gpc') === '1' || request.headers.get('dnt') === '1') return status(204);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return status(415);
  if (Number(request.headers.get('content-length')) > MAX_BYTES) return status(413);
  const ua = request.headers.get('user-agent') ?? '';
  if (/bot\b|spider|crawler|slurp|headlesschrome/i.test(ua)) return status(204);

  let data;
  try {
    data = await readEvent(request);
  } catch {
    return status(400);
  }
  if (!data || data.consent !== true || typeof data.path !== 'string' || !isTrafficPath(data.path) ||
      typeof data.landing !== 'string' || !isTrafficPath(data.landing) ||
      (data.event !== 'view' && data.event !== 'whatsapp') ||
      typeof data.id !== 'string' || !idPattern.test(data.id) ||
      typeof data.visitor !== 'string' || !idPattern.test(data.visitor) ||
      typeof data.visit !== 'string' || !idPattern.test(data.visit)) return status(400);

  try {
    if (!await checkRateLimit(env.SEARCH_RATE_LIMITER, request, TRACKING_PATH)) return status(429);
    const cfCountry = request.cf?.country;
    const country = typeof cfCountry === 'string' && /^[A-Z]{2}$/.test(cfCountry) ? cfCountry : '';
    const { channel, source } = attribution(data);
    const { device, os, browser } = deviceInfo(ua);
    const kind = data.event === 'whatsapp' ? 'whatsapp_click' :
      isProductPath(data.path) ? 'product_view' : 'page_view';
    await env.DB.prepare(
      'INSERT INTO traffic_events (id, occurred_at, visitor_id, visit_id, kind, path, landing_path, country, channel, source, campaign, content, device, os, browser) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
    ).bind(data.id, Math.floor(Date.now() / 1000), data.visitor, data.visit, kind,
      data.path.replace(/\/$/, '') || '/', data.landing.replace(/\/$/, '') || '/',
      country, channel, source, trafficLabel(data.campaign), trafficLabel(data.content),
      device, os, browser).run();
    return status(204);
  } catch (error) {
    console.error('Traffic event write failed', error instanceof Error ? error.message : 'unknown');
    return status(503);
  }
};
