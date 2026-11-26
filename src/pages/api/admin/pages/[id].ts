import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getConfig } from '../../../../config';
import { getPageByPublicId, deletePage } from '../../../../features/pages/db';
import { parsePageForm } from '../../../../features/pages/form';
import { uniquePageSlug } from '../../../../features/pages/slug';
import { savePageBody, saveWarning } from '../../../../features/pages/save';
import { parsePublicId } from '../../../../features/ids/publicId';
import { CACHE_TAG } from '../../../../features/cache/tags';
import { purgeCacheTags } from '../../../../features/cache/purge';
import { saveCopyInEnglish } from '../../../../features/i18n/adminCopy';

export const prerender = false;

// POST /api/admin/pages/:id — save, or delete when `_action=delete`.
// :id is the page_ public ID; numeric row ids are not accepted.
export const POST: APIRoute = async ({ request, params, redirect, locals }) => {
  const publicId = parsePublicId(params.id, 'page');
  const existing = publicId ? await getPageByPublicId(env.DB, publicId) : null;
  if (!existing || !publicId) return new Response('未找到记录。', { status: 404 });
  const id = existing.id;

  const form = await request.formData();

  if (String(form.get('_action')) === 'delete') {
    // Drops the page and its media associations. The files stay in the library.
    await deletePage(env.DB, id);
    await purgeCacheTags([CACHE_TAG.shell]);
    return redirect('/admin/pages', 303);
  }

  const back = (query: string) => redirect(`/admin/pages/${publicId}/edit${query}`, 303);

  const parsed = parsePageForm(form);
  if ('error' in parsed) return back(`?error=${encodeURIComponent(parsed.error)}`);
  const copy = await saveCopyInEnglish(env.DB, env.AI, 'page', { title: parsed.data.title, body: parsed.data.body_markdown },
      { publicId, title: existing.title, body: existing.body_markdown });

  // Keep the slug stable on rename: the form pre-fills the current slug.
  const slugBase = parsed.data.slug || existing.slug || copy.title;
  const slug = await uniquePageSlug(env.DB, slugBase, id);

  const result = await savePageBody(
    env.DB,
    existing,
    { ...parsed.data, title: copy.title, body_markdown: copy.body ?? '', slug },
    { baseUrl: getConfig().images.baseUrl, original: copy.source },
  );
  copy.sync(locals.cfContext, id);

  await purgeCacheTags([CACHE_TAG.shell]);
  const warning = saveWarning(result);
  return back(warning ? `?warning=${encodeURIComponent(warning)}` : '?saved=1');
};
