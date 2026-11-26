import { describe, expect, it, vi } from 'vitest';
import type { Ai } from '@cloudflare/workers-types';
import { completeEnglishSave, englishCopy, prepareEnglishSave } from './english';

describe('single-source storefront editing', () => {
  const limits = { title: 100, body: 500 };

  it('prepares a save without a provider and retries a failed unchanged field', () => {
    const source = { title: '最新球衣', body: 'Sizes S to XL' };
    const english = { title: 'Previous jerseys', body: 'Old sizes' };
    const expected = { fallback: { ...source, title: english.title }, pending: { title: source.title } };
    expect(prepareEnglishSave(source, { source: { ...source, title: '旧球衣' }, english })).toEqual(expected);
    expect(prepareEnglishSave(source, { source, english }, ['title'])).toEqual(expected);
  });

  it('publishes a validated fallback translation when the primary provider fails', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('Provider unavailable'))
      .mockResolvedValueOnce({ translated_text: 'Choose from 26 jerseys.' });
    const ai = { run } as unknown as Ai;
    await expect(completeEnglishSave(ai, { body: '有26款球衣可选。' }, limits))
      .resolves.toEqual({ body: 'Choose from 26 jerseys.' });
    expect(run).toHaveBeenLastCalledWith('@cf/meta/m2m100-1.2b', {
      text: '有26款球衣可选。', source_lang: 'zh', target_lang: 'en',
    });
    run.mockRejectedValueOnce(new Error('Provider unavailable'))
      .mockResolvedValueOnce({ translated_text: 'Choose from 25 jerseys.' });
    await expect(completeEnglishSave(ai, { body: '有26款球衣可选。' }, limits)).rejects.toThrow('数字或链接');
  });

  it('preserves submitted English exactly without requiring a provider', async () => {
    const source = { title: '2026 FXF Away Jersey — XL', body: '## Sizing\n- EUR 19.95' };
    expect(await englishCopy(undefined, source, limits)).toEqual(source);
  });

  it('keeps saved English for unchanged Chinese fields and translates only edits', async () => {
    const run = vi.fn().mockResolvedValue({ response: JSON.stringify({ body: 'See [the jersey](/products/away) for 39 USD.' }) });
    const source = { title: '我们的工厂', body: '查看[球衣](/products/away)，39美元。' };
    const result = await englishCopy({ run } as unknown as Ai, source, limits,
      { source: { title: source.title, body: '' }, english: { title: 'Our factory', body: '' } });
    expect(result).toEqual({ title: 'Our factory', body: 'See [the jersey](/products/away) for 39 USD.' });
    expect(run.mock.calls[0][1].messages[1].content).not.toContain('"title"');
  });

  it('rejects missing bindings and translations that change prices or links', async () => {
    const source = { body: '查看[球衣](/products/away)，39美元。' };
    await expect(englishCopy(undefined, source, limits)).rejects.toThrow('自动翻译暂不可用');
    const run = vi.fn().mockResolvedValue({ response: { body: 'See [the jersey](/products/home) for 49 USD.' } });
    await expect(englishCopy({ run } as unknown as Ai, source, limits)).rejects.toThrow('英文翻译未完成');
  });
});
