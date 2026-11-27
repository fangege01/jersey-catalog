import MarkdownIt from 'markdown-it';
import type { MarkdownIt as MarkdownItInstance, Token } from 'markdown-it';
import insert from 'markdown-it-ins';
import sanitize from 'sanitize-html';
import { renderMarkdown, type RenderOptions } from '../pages/markdown.ts';
import { hasRichProductFormat, productMarkdownSource, richProductValue, safeProductLink } from './richFormat.ts';

const checkPrefix = /^\[(?:x|X| )\][ \t]+/u;
export const productChecklist = 'fxf-checklist';

function markChecklists(tokens: Token[]) {
  const lists: Array<{ token: Token; items: Array<Token | undefined> }> = [];
  for (const [index, token] of tokens.entries()) {
    if (token.type === 'bullet_list_open') lists.push({ token, items: [] });
    if (token.type === 'list_item_open') {
      const list = lists.at(-1);
      if (list && token.level === list.token.level + 1) {
        const inline = tokens[index + 2];
        list.items.push(inline?.type === 'inline' ? inline.children?.[0] : undefined);
      }
    }
    if (token.type === 'bullet_list_close') {
      const list = lists.pop();
      if (!list?.items.length || !list.items.every(item => item?.type === 'text' && checkPrefix.test(item.content))) continue;
      list.token.attrSet('class', productChecklist);
      for (const item of list.items) item!.content = item!.content.replace(checkPrefix, '');
    }
  }
}

function configure(instance: MarkdownItInstance, breaks: boolean) {
  instance.set({ html: true, breaks });
  instance.use(insert);
  instance.validateLink = safeProductLink;
  instance.core.ruler.push('product-format', ({ tokens }) => {
    markChecklists(tokens);
    for (const token of tokens) {
      if (token.type === 'heading_open' || token.type === 'heading_close') {
        token.tag = token.tag === 'h1' || token.tag === 'h2' ? 'h2' : 'h3';
      }
    }
  });
}

const h2 = () => ({ tagName: 'h2', attribs: {} });
const h3 = () => ({ tagName: 'h3', attribs: {} });
const safeHtml: sanitize.IOptions = {
  allowedTags: ['p', 'h2', 'h3', 'strong', 'em', 'b', 'i', 'u', 's', 'ins', 'ul', 'ol', 'li', 'a', 'br', 'img',
    'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
  allowedAttributes: {
    a: ['href', 'title'], img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    ul: ['class'], ol: ['start'],
  },
  allowedClasses: { ul: [productChecklist] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    h1: h2, h4: h3, h5: h3, h6: h3,
    ins: 'u', b: 'strong', i: 'em',
    a: (_tag, attrs) => ({ tagName: 'a', attribs: safeProductLink(attrs.href ?? '') ? attrs : {} }),
    img: (_tag, attrs): sanitize.Tag => ({
      tagName: 'img',
      attribs: /^(?:https?:\/\/|\/(?!\/))/iu.test(attrs.src ?? '') && safeProductLink(attrs.src ?? '')
        ? { ...attrs, loading: 'lazy', decoding: 'async' } : { alt: attrs.alt ?? '' },
    }),
  },
};

export function renderProductMarkdown(value: string, options: RenderOptions & { breaks?: boolean } = {}): string {
  return sanitize(renderMarkdown(productMarkdownSource(value), options, md => configure(md, !!options.breaks)), safeHtml);
}

export function renderProductDetailText(value: string, options: RenderOptions & { checklist?: boolean } = {}) {
  if (hasRichProductFormat(value) || !options.checklist || /^(?: {0,3}(?:#{1,6}\s|[-+*]\s|\d+[.)]\s)|\s*<(?:ul|ol|p|h[1-6])\b)/im.test(value)) {
    return renderProductMarkdown(value, { ...options, breaks: !hasRichProductFormat(value) });
  }
  const items = value.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  return items.length ? '<ul class="fxf-checklist">' +
    items.map(line => '<li>' + renderProductMarkdown(line, options) + '</li>').join('') + '</ul>' : '';
}

export function productMarkdownExcerpt(value: string, maxLength = 160): string {
  const html = renderProductMarkdown(value);
  const text = sanitize(html.replace(/<\/(?:p|h[23]|li|td|th|blockquote)>|<br\s*\/?>/giu, ' '), { allowedTags: [], allowedAttributes: {} })
    .replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/giu, (match, number, hex, named) => {
      if (named) return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[named] ?? match;
      const code = number ? Number(number) : parseInt(hex, 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }).replace(/\s+/gu, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export function restoreProductTranslation(source: string, translated: string): string | null {
  if (!hasRichProductFormat(source)) return translated;
  const md = new MarkdownIt();
  configure(md, false);
  const structure = (value: string) => md.parse(productMarkdownSource(value), {}).flatMap(token => {
    const shape = (item: Token) => item.type === 'text' ? '' : [item.type, item.tag, item.attrs];
    return token.type === 'inline' ? [token.type, ...((token.children ?? []).map(shape).filter(Boolean))] : [shape(token)];
  });
  return JSON.stringify(structure(source)) === JSON.stringify(structure(translated)) ? richProductValue(translated) : null;
}
