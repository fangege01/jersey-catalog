import MarkdownIt from 'markdown-it';
import { configureProductMarkdown } from './productMarkdownRules';
import { safeProductLink } from './richFormat';

const markdown = new MarkdownIt();
configureProductMarkdown(markdown, { html: false, breaks: true });

export function cleanClipboard(html: string): string {
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
  for (const el of parsed.querySelectorAll<HTMLElement>('[style]')) {
    const tags = [
      (el.style.fontWeight === 'bold' || Number(el.style.fontWeight) >= 600) && 'strong',
      el.style.fontStyle === 'italic' && 'em',
      (el.style.textDecorationLine || el.style.textDecoration).includes('underline') && 'u',
    ];
    el.removeAttribute('style');
    let container = el;
    for (const tag of tags) {
      if (!tag || container.closest('strong,b,em,i,u')?.tagName.toLowerCase() === tag) continue;
      const wrapper = document.createElement(tag);
      while (container.firstChild) wrapper.appendChild(container.firstChild);
      container.appendChild(wrapper);
      container = wrapper;
    }
  }
  for (const el of parsed.querySelectorAll('[class],[id]')) {
    el.removeAttribute('id');
    if (el.matches('ul.fxf-checklist')) el.setAttribute('class', 'fxf-checklist');
    else el.removeAttribute('class');
  }
  const text = document.createTreeWalker(parsed, NodeFilter.SHOW_TEXT);
  for (let node = text.nextNode(); node; node = text.nextNode()) {
    if (!node.parentElement?.closest('pre,code')) node.nodeValue = node.nodeValue?.replace(/[\u200b\ufeff]/gu, '').replace(/[ \u00a0]{2,}/gu, ' ') ?? null;
  }
  return template.innerHTML;
}

export function pastedMarkdown(text: string, html: string): string | null {
  if (!text.trim() || /<(?:h[1-6]|strong|b|em|i|u|ul|ol|li|table|a)\b/i.test(html)) return null;
  const explicit = /^(?: {0,3}#{1,3}[ \t]+\S| {0,3}[-*+][ \t]+\S)|(?:\*\*|__)[^\s*][^\r\n]*?(?:\*\*|__)|(?:^|[ \t])[\*_][^\s*_][^\r\n]*?[\*_](?=[\s.,:;!?)\]]|$)|\[[^\]\r\n]+\]\([^)\r\n]+\)|^.*\|\s*:?-{3,}/mu.test(text);
  const numbered = (text.match(/^ {0,3}\d{1,3}[.)][ \t]+\S/gmu) ?? []).length > 1;
  return explicit || numbered ? markdown.render(text) : null;
}
