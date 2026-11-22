import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { checkRateLimit } from '../../features/auth/rateLimit';
import { readInquiry } from '../../features/site-content/inquiry';

export const prerender = false;

const PATH = '/api/contact-inquiry';
const MAX_BYTES = 32_768;

export const POST: APIRoute = async ({ request, url }) => {
  const headers = { 'cache-control': 'private, no-store' };
  if (request.headers.get('origin') !== url.origin) return new Response(null, { status: 403, headers });
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    return new Response(null, { status: 415, headers });
  }
  if (Number(request.headers.get('content-length')) > MAX_BYTES) return new Response(null, { status: 413, headers });

  let contact = '/contact';
  function result(state: string) {
    return new Response(null, {
      status: 303,
      headers: { ...headers, location: contact + '?inquiry=' + state + '#contact-inquiry' },
    });
  }

  try {
    const reader = request.body?.getReader();
    if (!reader) return result('invalid');
    const decoder = new TextDecoder();
    let content = '';
    let received = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        await reader.cancel();
        return new Response(null, { status: 413, headers });
      }
      content += decoder.decode(value, { stream: true });
    }
    const params = new URLSearchParams(content + decoder.decode());
    if (params.get('locale') === 'zh-CN') contact = '/zh/contact';
    if (!await checkRateLimit(env.AUTH_RATE_LIMITER, request, PATH)) return result('limited');

    const inquiry = readInquiry(params);
    if (!inquiry) return result('invalid');
    await env.DB.prepare(`
      INSERT INTO contact_inquiries (
        id, received_at, name, company, email, whatsapp, country, business_type, interest,
        estimated_quantity, order_type, message, locale
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), Math.floor(Date.now() / 1000), inquiry.name, inquiry.company,
      inquiry.email, inquiry.whatsapp, inquiry.country, inquiry.businessType, inquiry.interest,
      inquiry.estimatedQuantity, inquiry.orderType, inquiry.message, inquiry.locale).run();
    return result('sent');
  } catch {
    console.error('Contact inquiry write failed');
    return result('unavailable');
  }
};
