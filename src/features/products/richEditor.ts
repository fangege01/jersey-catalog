import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { DOMSerializer } from '@tiptap/pm/model';
import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { richProductValue, safeProductLink } from './richFormat';
import { Checklist, toggleChecklist } from './richChecklist';
import { cleanClipboard, pastedMarkdown } from './richPaste';
import { connectRichDialogs } from './richDialogs';

const nodes = defaultMarkdownSerializer.nodes;
const marks = defaultMarkdownSerializer.marks;
const toMarkdown = new MarkdownSerializer({
  blockquote: nodes.blockquote, codeBlock: nodes.code_block,
  heading: nodes.heading, horizontalRule: nodes.horizontal_rule,
  paragraph: nodes.paragraph, image: nodes.image, hardBreak: nodes.hard_break, text: nodes.text,
  listItem: nodes.list_item,
  bulletList(state, node) {
    const marker = node.attrs.checklist ? '- [x] ' : '- ';
    state.renderList(node, ' '.repeat(marker.length), () => marker);
  },
  orderedList(state, node) {
    const start = Number(node.attrs.start) || 1;
    const width = String(start + node.childCount - 1).length;
    state.renderList(node, ' '.repeat(width + 2), index => String(start + index).padStart(width) + '. ');
  },
  table(state, node) {
    const element = DOMSerializer.fromSchema(node.type.schema).serializeNode(node) as HTMLElement;
    element.removeAttribute('style');
    element.querySelectorAll('colgroup').forEach(columns => columns.remove());
    state.write(element.outerHTML);
    state.closeBlock(node);
  },
}, {
  bold: marks.strong, italic: marks.em, code: marks.code, link: marks.link,
  strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
  underline: { open: '++', close: '++', mixable: true, expelEnclosingWhitespace: true },
}, { escapeExtraCharacters: /[+~]/gu });

function connect(root: HTMLElement) {
  const source = root.querySelector('textarea');
  const initial = root.querySelector('template');
  const shell = root.querySelector<HTMLElement>('[data-rich-shell]');
  const mount = root.querySelector<HTMLElement>('[data-rich-surface]');
  const dialog = root.querySelector('dialog');
  const url = dialog?.querySelector('input');
  const error = dialog?.querySelector<HTMLElement>('[data-link-error]');
  const tools = [...root.querySelectorAll<HTMLButtonElement>('[data-rich-action]')];
  if (!source || !initial || !shell || !mount || !dialog || !url || !error) return;

  const editor = new Editor({
    element: mount,
    content: initial.innerHTML,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: safeProductLink },
        trailingNode: false,
      }), Checklist, Image.configure({ allowBase64: false }), TableKit.configure({ table: { resizable: false } }),
    ],
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': root.dataset.richLabel ?? '' },
      transformPastedHTML: cleanClipboard,
      handlePaste: (view, event) => {
        if (!event.clipboardData) return false;
        const html = pastedMarkdown(event.clipboardData.getData('text/plain'), event.clipboardData.getData('text/html'));
        return html ? view.pasteHTML(html) : false;
      },
    },
    onUpdate: ({ editor }) => {
      source.value = richProductValue(toMarkdown.serialize(editor.state.doc));
    },
  });

  function updateTools() {
    const active: Record<string, boolean> = {
      bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'),
      h2: editor.isActive('heading', { level: 2 }), h3: editor.isActive('heading', { level: 3 }),
      paragraph: editor.isActive('paragraph') && !editor.isActive('listItem'),
      bullet: editor.isActive('bulletList', { checklist: false }),
      checklist: editor.isActive('bulletList', { checklist: true }),
      ordered: editor.isActive('orderedList'), link: editor.isActive('link'),
    };
    for (const button of tools) {
      const action = button.dataset.richAction!;
      if (action in active) button.setAttribute('aria-pressed', String(active[action]));
      if (action === 'undo') button.disabled = !editor.can().undo();
      if (action === 'redo') button.disabled = !editor.can().redo();
      if (button.hasAttribute('data-table-only')) button.hidden = !editor.isActive('table');
    }
  }
  editor.on('transaction', updateTools);
  updateTools();
  source.hidden = true;
  shell.hidden = false;

  function heading(level: 2 | 3) {
    const chain = editor.chain().focus();
    if (editor.isActive('bulletList', { checklist: true })) return chain.clearNodes().setHeading({ level }).run();
    return chain.toggleHeading({ level }).run();
  }

  const dialogs = connectRichDialogs(root, editor, () => richProductValue(toMarkdown.serialize(editor.state.doc)));
  const actions: Record<string, () => unknown> = {
    bold: () => editor.chain().focus().toggleBold().run(),
    italic: () => editor.chain().focus().toggleItalic().run(),
    underline: () => editor.chain().focus().toggleUnderline().run(),
    h2: () => heading(2),
    h3: () => heading(3),
    paragraph: () => editor.chain().focus().setParagraph().run(),
    clear: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    bullet: () => editor.isActive('bulletList', { checklist: true })
      ? editor.chain().focus().updateAttributes('bulletList', { checklist: false }).run()
      : editor.chain().focus().toggleBulletList().run(),
    checklist: () => editor.chain().focus().command(toggleChecklist).run(),
    ordered: () => editor.chain().focus().toggleOrderedList().run(),
    table: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    addRow: () => editor.chain().focus().addRowAfter().run(),
    deleteRow: () => editor.chain().focus().deleteRow().run(),
    addColumn: () => editor.chain().focus().addColumnAfter().run(),
    deleteColumn: () => editor.chain().focus().deleteColumn().run(),
    deleteTable: () => editor.chain().focus().deleteTable().run(),
    preview: () => dialogs?.preview(),
    templates: () => dialogs?.templates(),
    undo: () => editor.chain().focus().undo().run(),
    redo: () => editor.chain().focus().redo().run(),
    link: () => {
      url.value = editor.getAttributes('link').href ?? '';
      error.hidden = true;
      dialog.showModal();
      url.focus();
    },
  };
  for (const button of tools) {
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => actions[button.dataset.richAction!]?.());
  }
  const saveLink = () => {
    const href = url.value.trim();
    if (href && !safeProductLink(href)) {
      error.hidden = false;
      return;
    }
    dialog.close();
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive('link')) {
      const from = editor.state.selection.from;
      editor.chain().focus().insertContent({ type: 'text', text: href })
        .setTextSelection({ from, to: from + href.length }).setLink({ href }).run();
    } else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };
  dialog.querySelector('[data-link-apply]')?.addEventListener('click', saveLink);
  dialog.querySelector('[data-link-cancel]')?.addEventListener('click', () => { dialog.close(); editor.commands.focus(); });
  url.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); saveLink(); }
  });
}

export function installProductRichEditors() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-product-rich-editor]')) connect(root);
}
