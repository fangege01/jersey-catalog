import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getConfig } from '../../../../config';
import { renderProductMarkdown } from '../../../../features/products/productMarkdown';
import { managedWhatsAppHref } from '../../../../features/storefront/catalogMode';
import { productMarkdownSource } from '../../../../features/products/richFormat';

const idPattern = /^[0-9a-f-]{36}$/u;
const maxContent = 24_000;
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'private, no-store' } });
const error = (message: string, status = 400) => json({ error: message }, status);

export const GET: APIRoute = async () => {
  const { results } = await env.DB.prepare('SELECT id, name, content FROM product_rich_templates ORDER BY updated_at DESC, name, id')
    .all<{ id: string; name: string; content: string }>();
  return json({ templates: results });
};

export const POST: APIRoute = async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > maxContent * 3) return error('请求内容过长。', 413);
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return error('请求格式不正确。');
    body = input as Record<string, unknown>;
  } catch { return error('请求格式不正确。'); }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (content.length > maxContent) return error('文案过长，请缩短后重试。');
  if (body.action === 'preview') {
    const cfg = getConfig();
    return json({ html: renderProductMarkdown(content, {
      baseUrl: cfg.images.baseUrl,
      resolveLink: cfg.features.catalogOnly ? href => managedWhatsAppHref(href, locals.settings?.whatsappNumber ?? null) : undefined,
    }) });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (id && !idPattern.test(id)) return error('模板标识不正确。');
  if (body.action === 'delete' && id) {
    const result = await env.DB.prepare('DELETE FROM product_rich_templates WHERE id=?').bind(id).run();
    return result.meta.changes ? json({ id }) : error('模板已不存在。', 404);
  }
  if (body.action !== 'save') return error('无法识别的操作。');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80 || !productMarkdownSource(content).trim()) return error('请填写模板名称和文案，名称最多 80 个字符。');
  const markdown = productMarkdownSource(content);
  if (id) {
    const result = await env.DB.prepare("UPDATE product_rich_templates SET name=?, content=?, updated_at=datetime('now') WHERE id=?")
      .bind(name, markdown, id).run();
    return result.meta.changes ? json({ id }) : error('模板已不存在。', 404);
  }
  const newId = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO product_rich_templates (id,name,content) VALUES (?,?,?)').bind(newId, name, markdown).run();
  return json({ id: newId }, 201);
};
