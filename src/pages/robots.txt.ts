import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { publicOrigin } from '../features/http/origin';
import { robotsContent, seoControls } from '../features/seo/controls';

export const prerender = false;

export const GET: APIRoute = ({ url, locals }) => {
  const origin = publicOrigin(url.origin, env.CANONICAL_ORIGIN);
  return new Response(robotsContent(origin, seoControls(locals.settings?.seoControls)), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
