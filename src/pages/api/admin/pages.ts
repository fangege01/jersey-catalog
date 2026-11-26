import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createDraft, getPage } from '../../../features/pages/db';
import { uniquePageSlug } from '../../../features/pages/slug';
import { saveCopyInEnglish } from '../../../features/i18n/adminCopy';

export const prerender = false;

// POST /api/admin/pages — create an unpublished draft, then send the author to
// the editor. Two steps on purpose: attaching media needs a page id, so the
// editor only opens once the row exists.
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  if (!title) {
    return redirect(`/admin/pages/new?error=${encodeURIComponent('请填写标题。')}`, 303);
  }

  const copy = await saveCopyInEnglish(env.DB, env.AI, 'page', { title, body: null });
  const slugBase = String(form.get('slug') ?? '').trim() || copy.title;
  const slug = await uniquePageSlug(env.DB, slugBase);
  // The editor URL uses the page_ public ID — one read-back after the insert.
  const id = await createDraft(env.DB, copy.title, slug, copy.source);
  copy.sync(locals.cfContext, id);
  const created = await getPage(env.DB, id);
  return redirect(`/admin/pages/${created?.public_id}/edit`, 303);
};
