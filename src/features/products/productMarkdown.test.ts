import { describe, expect, it } from 'vitest';
import { productMarkdownExcerpt, renderProductDetailText, renderProductMarkdown, restoreProductTranslation } from './productMarkdown';
import { richProductValue, safeProductLink } from './richFormat';
import { pastedMarkdown } from './richPaste';

describe('product rich text', () => {
  it('renders headings, inline styles and semantic lists including checklists', () => {
    const value = richProductValue([
      '# Legacy title', '### Fit', '**Strong** *Italic* ++Underlined++',
      '- [x] **Adult sizes**\n- [x] Youth sizes', '1. First\n2. Second',
      '- Plain bullet', '[Contact](/contact)',
    ].join('\n\n'));
    const html = renderProductMarkdown(value);
    expect(html).toContain('<h2>Legacy title</h2>');
    expect(html).toContain('<h3>Fit</h3>');
    expect(html).toContain('<strong>Strong</strong> <em>Italic</em> <u>Underlined</u>');
    expect(html).toContain('<ul class="fxf-checklist">');
    expect(html).toContain('<li><strong>Adult sizes</strong></li>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<ul>\n<li>Plain bullet</li>');
    expect(html).toContain('<a href="/contact">Contact</a>');
    expect(html).not.toContain('[x]');
    expect(productMarkdownExcerpt(value, 400)).toContain('Strong Italic Underlined Adult sizes');
  });

  it('keeps original plain-text detail lists and legacy Markdown tables', () => {
    expect(renderProductDetailText('**Adult** XS\nYouth 16–28', { checklist: true }))
      .toMatch(/<ul class="fxf-checklist"><li><p><strong>Adult<\/strong> XS/);
    expect(renderProductMarkdown('| Size | Age |\n| --- | --- |\n| S | Adult |')).toContain('<table>');
    expect(renderProductDetailText(richProductValue('An ordinary paragraph.'), { checklist: true }))
      .toBe('<p>An ordinary paragraph.</p>\n');
  });

  it('strips unsafe raw HTML and refuses dangerous link targets', () => {
    const html = renderProductMarkdown('<h1 onclick="alert(1)">Safe heading</h1>\n\n<script>sideEffect()</script>\n\n' +
      '<a href="jav&#x61;script:alert(1)">Unsafe link</a> <img src="/images/demo.webp" onerror="alert(1)">');
    expect(html).toContain('<h2>Safe heading</h2>');
    expect(html).toContain('<a>Unsafe link</a>');
    expect(html).toContain('<img src="/images/demo.webp" loading="lazy"');
    expect(html).not.toMatch(/onclick|onerror|javascript|sideEffect|<script|<h1/);
    expect(safeProductLink('javascript:alert(1)')).toBe(false);
    expect(safeProductLink('//external.test/x')).toBe(false);
    expect(safeProductLink('https://example.com/sizes')).toBe(true);
    expect(safeProductLink('/contact')).toBe(true);
  });

  it('accepts translated copy when its original structure is preserved', () => {
    const source = richProductValue('## 规格\n\n- [x] **成人尺码**\n- [x] 儿童尺码');
    const result = restoreProductTranslation(source, '## Specifications\n\n- [x] **Adult sizes**\n- [x] Youth sizes');
    expect(result).toBe(richProductValue('## Specifications\n\n- [x] **Adult sizes**\n- [x] Youth sizes'));
    expect(restoreProductTranslation(source, 'Specifications\n\nAdult sizes')).toBeNull();
  });

  it('deduplicates typed symbols on checklist rows while leaving real headings and paragraphs alone', () => {
    const html = renderProductMarkdown('## Sizing\n\n- [x] ✅ **✓✔** √Adult XS\n- [x] ✔ Youth\n\n### Delivery\n\nA ✓ means confirmed.');
    expect(html).toContain('<h2>Sizing</h2>');
    expect(html).toContain('<ul class="fxf-checklist">');
    expect(html).toContain('<li>Youth');
    expect(html).toContain('<h3>Delivery</h3>');
    expect(html).toContain('A ✓ means confirmed.');
    expect(html).not.toMatch(/[✅✔√]/u);
    expect(renderProductDetailText('✓ Adult\n✅✔ Youth', { checklist: true })).not.toMatch(/[✅✓✔√]/u);
  });

  it('recognizes pasted Markdown and leaves ordinary measurements as plain text', () => {
    const html = pastedMarkdown('## Fit\n\n### Sizes\n**Adult** *Youth*\n\n- XS–4XL\n\n1. PayPal\n2. Wire\n\n[Contact](/contact)', '');
    expect(html).toContain('<h2>Fit</h2>');
    expect(html).toContain('<h3>Sizes</h3>');
    expect(html).toContain('<strong>Adult</strong> <em>Youth</em>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<a href="/contact">Contact</a>');
    expect(pastedMarkdown('Width 1.25 mm\nAdult XS–4XL\n100% Polyester', '')).toBeNull();
    expect(pastedMarkdown('**Plain text**', '<p><strong>Formatted copy</strong></p>')).toBeNull();
  });
});
