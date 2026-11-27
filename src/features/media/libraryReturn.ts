import { queryHref, requestedPage } from '../../pagination';
import { mediaCategoryId } from './categories';

export function mediaLibraryReturn(form: FormData, status: { error?: string; success?: string } = {}): string {
  const rawCategory = form.get('filter_category');
  const category = rawCategory === 'uncategorized' ? rawCategory : mediaCategoryId(rawCategory);
  const page = requestedPage(new URLSearchParams({ page: String(form.get('page') ?? '') }));
  return queryHref('/admin/media', { category, page: page > 1 ? page : undefined, ...status });
}
