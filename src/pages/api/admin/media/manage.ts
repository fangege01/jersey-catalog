import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteMediaRecords, MEDIA_PAGE_SIZE } from '../../../../features/media/db';
import { assignMediaCategory, mediaCategoryId, removeMediaCategory, saveMediaCategory } from '../../../../features/media/categories';
import { mediaLibraryReturn } from '../../../../features/media/libraryReturn';
import { parsePublicId } from '../../../../features/ids/publicId';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const success = (text: string) => redirect(mediaLibraryReturn(form, { success: text }), 303);
  const error = (text: string) => redirect(mediaLibraryReturn(form, { error: text }), 303);
  const action = form.get('action');
  try {
    if (action === 'create-category' || action === 'rename-category' || action === 'remove-category') {
      const id = mediaCategoryId(form.get('category_id'));
      if (action !== 'create-category' && !id) return error('分类无效。');
      if (action === 'remove-category') {
        if (!id || !(await removeMediaCategory(env.DB, id))) return error('分类已不存在。');
        return success('分类已删除，原分类内的图片已转为未分类。');
      }
      const name = String(form.get('name') ?? '');
      if (!name.trim() || name.trim().length > 60) return error('请输入分类名称，最多 60 字。');
      const saved = await saveMediaCategory(env.DB, name, id ?? undefined);
      return saved ? success(action === 'create-category' ? '分类已创建。' : '分类名称已更新。') : error('分类已不存在。');
    }

    if (action !== 'delete' && action !== 'assign') return error('无法识别此操作。');
    const selected = form.getAll('selected');
    if (!selected.length || selected.length > MEDIA_PAGE_SIZE) return error(`请选择 1 至 ${MEDIA_PAGE_SIZE} 张图片。`);
    const ids = selected.map(value => parsePublicId(value, 'media'));
    if (ids.some(id => id === null)) return error('选中的图片包含无效记录。');
    const mediaIds = [...new Set(ids.filter(id => id !== null))];
    if (action === 'assign') {
      const target = form.get('target_category');
      const category = mediaCategoryId(target);
      if (!category && target !== 'uncategorized') return error('请选择要移入的分类。');
      const moved = await assignMediaCategory(env.DB, mediaIds, category);
      return moved ? success(`已更新 ${moved} 张图片的分类。`) : error('图片或目标分类已不存在。');
    }
    const keys = await deleteMediaRecords(env.DB, mediaIds);
    const skipped = mediaIds.length - keys.length;
    if (!keys.length) return error('所选图片仍被引用或已不存在。请查看图片卡片上的引用位置。');
    try {
      // Delete rows with the shared reference guard before removing their R2 objects.
      await env.BUCKET.delete(keys);
    } catch (cause) {
      console.error('Could not delete removed media objects', cause);
      return error(`已从素材库移除 ${keys.length} 张，存储清理未完成。`);
    }
    return success(`已删除 ${keys.length} 张图片。${skipped ? `另有 ${skipped} 张仍被引用或已不存在。` : ''}`);
  } catch (cause) {
    if (cause instanceof Error && /UNIQUE constraint failed.*media_categories\.name/i.test(cause.message)) {
      return error('已存在同名分类。');
    }
    console.error('Could not manage media library', cause);
    return error('素材库操作未完成，请刷新后重试。');
  }
};
