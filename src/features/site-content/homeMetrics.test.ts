import { describe, expect, it } from 'vitest';
import { displayHomeMetrics } from './homeMetrics';

describe('home metric display', () => {
  it('renders the same quantity in English even if the saved translation changes the multiplier', () => {
    const items = [
      { value: '50', sourceLabel: '每年产量', sourceSuffix: '万', label: 'Annual production', suffix: 'million' },
      { value: '0.29', sourceLabel: '出货量', sourceSuffix: '亿', label: 'Shipments', suffix: '' },
    ];
    expect(displayHomeMetrics(items, 'zh-CN').map(({ value, suffix }) => [value, suffix]))
      .toEqual([['50', '万'], ['0.29', '亿']]);
    expect(displayHomeMetrics(items, 'en').map(({ value, suffix }) => [value, suffix]))
      .toEqual([['500000', ''], ['29000000', '']]);
  });
});
