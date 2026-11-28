import type { MarkdownIt as MarkdownItInstance, Token } from 'markdown-it';
import insert from 'markdown-it-ins';
import { checklistPrefixLength, safeProductLink } from './richFormat.ts';

const taskPrefix = /^\[[xX ]\](?:[ \t]+|$)/u;
export const productChecklist = 'fxf-checklist';

function stripInlineChecks(inline: Token) {
  let line: Token[] = [];
  let atStart = true;
  const strip = () => {
    let remaining = checklistPrefixLength(line.map(token => token.content).join(''));
    for (const token of line) {
      const count = Math.min(remaining, token.content.length);
      token.content = token.content.slice(count);
      remaining -= count;
    }
    line = [];
  };
  for (const token of inline.children ?? []) {
    if (token.type === 'softbreak' || token.type === 'hardbreak') {
      strip();
      atStart = true;
    } else if (atStart && token.type === 'text') line.push(token);
    else if (atStart && !token.nesting) {
      strip();
      atStart = false;
    }
  }
  strip();
}

function markChecklists(tokens: Token[]) {
  const lists: Array<{ token: Token; items: Array<Token | undefined> }> = [];
  for (const [index, token] of tokens.entries()) {
    if (token.type === 'bullet_list_open') lists.push({ token, items: [] });
    if (token.type === 'list_item_open') {
      const list = lists.at(-1);
      if (list && token.level === list.token.level + 1) {
        const inline = tokens[index + 2];
        list.items.push(inline?.type === 'inline' ? inline : undefined);
      }
    }
    if (token.type !== 'bullet_list_close') continue;
    const list = lists.pop();
    if (!list?.items.length || !list.items.every(item => taskPrefix.test(item?.children?.[0]?.content ?? ''))) continue;
    list.token.attrSet('class', productChecklist);
    for (const item of list.items) {
      const first = item!.children![0];
      first.content = first.content.replace(taskPrefix, '');
      stripInlineChecks(item!);
    }
  }
}

export function configureProductMarkdown(instance: MarkdownItInstance, options: { html: boolean; breaks: boolean }) {
  instance.set(options);
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
