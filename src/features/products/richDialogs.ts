import type { Editor } from '@tiptap/core';
import { productMarkdownSource } from './richFormat';

const endpoint = '/api/admin/products/rich-text';
type Template = { id: string; name: string; content: string };

async function request<T>(payload?: Record<string, string>): Promise<T> {
  const response = await fetch(endpoint, payload ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  } : undefined);
  const data = await response.json().catch(() => null) as ({ error?: string } & T) | null;
  if (!response.ok || !data) throw new Error(data?.error || '操作未完成，请刷新页面后重试。');
  return data as T;
}

export function connectRichDialogs(root: HTMLElement, editor: Editor, getContent: () => string) {
  const preview = root.querySelector<HTMLDialogElement>('[data-rich-preview]');
  const article = preview?.querySelector<HTMLElement>('[data-preview-content]');
  const previewStatus = preview?.querySelector<HTMLElement>('[data-preview-status]');
  const library = root.querySelector<HTMLDialogElement>('[data-rich-templates]');
  const select = library?.querySelector('select');
  const name = library?.querySelector('input');
  const content = library?.querySelector('textarea');
  const status = library?.querySelector<HTMLElement>('[data-template-status]');
  if (!preview || !article || !previewStatus || !library || !select || !name || !content || !status) return;
  let templates: Template[] = [];
  let busy = false;

  const loadSelected = () => {
    const template = templates.find(item => item.id === select.value);
    name.value = template?.name ?? '';
    content.value = template?.content ?? '';
  };

  const refresh = async (id = '') => {
    const response = await request<{ templates: Template[] }>();
    templates = response.templates;
    select.replaceChildren(new Option('新建模板', ''), ...templates.map(item => new Option(item.name, item.id)));
    select.value = id;
    loadSelected();
  };

  const runTask = async (task: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    status.textContent = '';
    const buttons = [...library.querySelectorAll<HTMLButtonElement>('[data-template-action]')];
    buttons.forEach(button => { button.disabled = true; });
    try { await task(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : '操作未完成。'; }
    finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
  };

  const render = (source: string) => request<{ html: string }>({ action: 'preview', content: source });
  preview.querySelector('[data-dialog-close]')?.addEventListener('click', () => preview.close());
  library.querySelector('[data-dialog-close]')?.addEventListener('click', () => library.close());
  select.addEventListener('change', loadSelected);
  library.querySelector('[data-template-action="copy"]')?.addEventListener('click', () => {
    content.value = productMarkdownSource(getContent());
    content.focus();
  });
  library.querySelector('[data-template-action="save"]')?.addEventListener('click', () => void runTask(async () => {
    const saved = await request<{ id: string }>({ action: 'save', id: select.value, name: name.value, content: content.value });
    await refresh(saved.id);
    status.textContent = '模板已保存。';
  }));
  library.querySelector('[data-template-action="delete"]')?.addEventListener('click', () => void runTask(async () => {
    if (!select.value) { status.textContent = '请先选择要删除的模板。'; return; }
    if (!window.confirm('确定删除这个模板？')) return;
    await request({ action: 'delete', id: select.value });
    await refresh();
    status.textContent = '模板已删除。';
  }));
  library.querySelector('[data-template-action="insert"]')?.addEventListener('click', () => void runTask(async () => {
    if (!content.value.trim()) { status.textContent = '请先选择模板或填写文案。'; return; }
    const { html } = await render(content.value);
    if (!html.trim()) { status.textContent = '模板没有可插入的内容。'; return; }
    const end = editor.state.selection.to;
    library.close();
    editor.chain().focus().setTextSelection(end).insertContent(html).run();
  }));

  return {
    async preview() {
      article.replaceChildren();
      previewStatus.textContent = '正在加载预览…';
      preview.showModal();
      try {
        const { html } = await render(getContent());
        article.innerHTML = html;
        previewStatus.textContent = html.trim() ? '' : '还没有可预览的内容。';
      } catch {
        previewStatus.textContent = '暂时无法预览，请稍后重试。';
      }
    },
    templates() {
      library.showModal();
      return runTask(() => refresh());
    },
  };
}
