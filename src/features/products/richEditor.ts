import { Editor, Extension } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { richProductValue, safeProductLink } from './richFormat';

const Checklist = Extension.create({
  name: 'productChecklist',
  addGlobalAttributes() {
    return [{
      types: ['bulletList'],
      attributes: {
        checklist: {
          default: false,
          parseHTML: el => el.classList.contains('fxf-checklist'),
          renderHTML: attrs => attrs.checklist ? { class: 'fxf-checklist' } : {},
        },
      },
    }];
  },
});

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
}, {
  bold: marks.strong, italic: marks.em, code: marks.code, link: marks.link,
  strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
  underline: { open: '++', close: '++', mixable: true, expelEnclosingWhitespace: true },
}, { escapeExtraCharacters: /[+~]/gu });

function cleanClipboard(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const parsed = template.content;
  parsed.querySelectorAll('script,style,iframe,object,embed,svg,math,template,img').forEach(el => el.remove());
  parsed.querySelectorAll('a[href]').forEach(el => {
    if (!safeProductLink(el.getAttribute('href') ?? '')) el.removeAttribute('href');
  });
  for (const heading of parsed.querySelectorAll('h1,h4,h5,h6')) {
    const replacement = document.createElement(heading.tagName === 'H1' ? 'h2' : 'h3');
    while (heading.firstChild) replacement.appendChild(heading.firstChild);
    heading.replaceWith(replacement);
  }
  return template.innerHTML;
}

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
  if (initial.content.querySelector('table')) {
    root.querySelector<HTMLElement>('[data-rich-legacy]')?.removeAttribute('hidden');
    return;
  }

  const editor = new Editor({
    element: mount,
    content: initial.innerHTML,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: safeProductLink },
        trailingNode: false,
      }), Checklist, Image.configure({ allowBase64: false }),
    ],
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': root.dataset.richLabel ?? '' },
      transformPastedHTML: cleanClipboard,
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
    }
  }
  editor.on('transaction', updateTools);
  updateTools();
  source.hidden = true;
  shell.hidden = false;

  function bullet(checklist: boolean) {
    if (editor.isActive('bulletList', { checklist })) editor.chain().focus().toggleBulletList().run();
    else if (editor.isActive('bulletList')) editor.chain().focus().updateAttributes('bulletList', { checklist }).run();
    else editor.chain().focus().toggleBulletList().updateAttributes('bulletList', { checklist }).run();
  }

  const actions: Record<string, () => unknown> = {
    bold: () => editor.chain().focus().toggleBold().run(),
    italic: () => editor.chain().focus().toggleItalic().run(),
    underline: () => editor.chain().focus().toggleUnderline().run(),
    h2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    h3: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    paragraph: () => editor.chain().focus().setParagraph().run(),
    clear: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    bullet: () => bullet(false),
    checklist: () => bullet(true),
    ordered: () => editor.chain().focus().toggleOrderedList().run(),
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
