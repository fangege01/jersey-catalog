const richPrefix = '<!--fxf-product-rich-text-->';
const leadingChecks = /^[\t \u00a0]*(?:[✅✓✔√][\ufe0e\ufe0f]?[\t \u00a0]*)+/u;

export function checklistPrefixLength(line: string): number {
  return line.match(leadingChecks)?.[0].length ?? 0;
}

export function hasRichProductFormat(value: string | null | undefined): boolean {
  return value?.startsWith(richPrefix) ?? false;
}

export function productMarkdownSource(value: string): string {
  return hasRichProductFormat(value) ? value.slice(richPrefix.length).trimStart() : value;
}

export function richProductValue(markdown: string): string {
  return richPrefix + '\n' + markdown.replace(/\r\n?/gu, '\n').trim();
}

export function safeProductLink(href: string): boolean {
  if (!href || /[\u0000-\u0020\u007f\\]/u.test(href) || href.startsWith('//')) return false;
  if (!/^[a-z][a-z\d+.-]*:/iu.test(href)) return true;
  try {
    const url = new URL(href);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch { return false; }
}
