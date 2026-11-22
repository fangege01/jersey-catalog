import { describe, expect, it } from 'vitest';
import { isPurchasePath, normalizeWhatsAppNumber, whatsappInquiryUrl } from './catalogMode';

describe('catalog mode', () => {
  it.each(['/cart/', '/checkout', '/express', '/pay/invoice', '/api/cart', '/api/checkout', '/partials/cart-count'])(
    'recognizes the purchase route %s',
    (path) => expect(isPurchasePath(path)).toBe(true),
  );

  it.each(['/api/products', '/products/cart', '/admin/orders', '/checkout-info'])(
    'keeps browsing and administration route %s available',
    (path) => expect(isPurchasePath(path)).toBe(false),
  );

  it('uses one number for both contact and item inquiries', () => {
    const number = '+1 (202) 555-0123';
    expect(normalizeWhatsAppNumber(number)).toBe('12025550123');
    expect(whatsappInquiryUrl(number)).toBe('https://wa.me/12025550123');
    const inquiry = whatsappInquiryUrl(number, { name: 'Home & Away', url: 'https://shop.example/products/home' },
      { label: 'L / Player', sku: 'ARG-L' });
    expect(inquiry).not.toBeNull();
    const parsed = new URL(inquiry!);
    expect(parsed.pathname).toBe('/12025550123');
    expect(parsed.searchParams.get('text')).toContain('Home & Away');
    expect(parsed.searchParams.get('text')).toContain('Option: L / Player');
    expect(parsed.searchParams.get('text')).toContain('SKU: ARG-L');
    expect(parsed.searchParams.get('text')).toContain('https://shop.example/products/home');
  });

  it.each(['', 'javascript:alert(1)', '0123456789', '12345'])(
    'does not publish a button for invalid number %s',
    (number) => expect(whatsappInquiryUrl(number)).toBeNull(),
  );
});
