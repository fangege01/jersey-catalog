import { describe, expect, it } from 'vitest';
import { readInquiry, type ContactInquiry } from './inquiry';

const input = (overrides: Record<string, string> = {}) => new URLSearchParams({
  name: 'Club buyer', email: 'buyer@example.test', country: 'Canada', businessType: 'team_club',
  interest: 'football_jerseys', estimatedQuantity: '50_99', orderType: 'wholesale', ...overrides,
});

describe('contact inquiry validation', () => {
  it('accepts a reply channel and keeps the bilingual inquiry details', () => {
    expect(readInquiry(input({ locale: 'zh-CN', message: '球衣\n尺码' }))).toMatchObject({
      locale: 'zh-CN', interest: 'football_jerseys', message: '球衣\n尺码',
    } satisfies Partial<ContactInquiry>);
    expect(readInquiry(input({ email: '', whatsapp: '+1 (202) 555-0123' }))).not.toBeNull();
  });

  const invalid: Record<string, string>[] = [
    { email: '' }, { email: 'missing-domain' }, { whatsapp: '<script>' }, { country: '' },
    { businessType: 'constructor' }, { interest: 'unknown' }, { estimatedQuantity: '' },
    { orderType: 'checkout' }, { website: 'https://spam.example' }, { message: 'x'.repeat(2001) },
  ];
  it.each(invalid)('rejects invalid input %j', (overrides) => {
    expect(readInquiry(input(overrides))).toBeNull();
  });
});
