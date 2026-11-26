import { describe, expect, it } from 'vitest';
import { approvedImageFilename, libraryImageLabel, productImageFilename, storedSeoFilename } from './seoName';
import { mediaKeyFor } from './upload';

describe('image SEO filenames', () => {
  it('uses the stored image format and a bounded, descriptive product filename', () => {
    const file = new File(['image'], 'IMG_001.JPG', { type: 'image/webp' });
    const key = mediaKeyFor(file, '2026 México Home Jersey', 1);
    expect(key).toMatch(/^media\/[a-f0-9]{20}\/2026-mexico-home-jersey-photo-2\.webp$/);
    expect(storedSeoFilename(key)).toBe('2026-mexico-home-jersey-photo-2.webp');
    expect(mediaKeyFor(file, '2026 México Home Jersey', 1)).not.toBe(key);
    expect(productImageFilename('abcdefghij '.repeat(20), 'jpg')).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/);
  });

  it('recognizes descriptive library names or uses the supplied purpose', () => {
    expect(libraryImageLabel('Factory Line Photo.JPG', '')).toBe('factory-line-photo');
    expect(libraryImageLabel('IMG_001.JPG', 'Quality control')).toBe('quality-control');
    expect(libraryImageLabel('IMG_001.JPG', '')).toBeUndefined();
    expect(libraryImageLabel('09421f43-06dd-413c-90f6-b8fa725f6777.webp', '')).toBeUndefined();
  });

  it('preserves a descriptive collector filename and replaces generic or unsafe input', () => {
    expect(approvedImageFilename('mexico-home-jersey-front.webp', 'webp')).toBe(true);
    expect(approvedImageFilename('image-001.webp', 'webp')).toBe(false);
    expect(approvedImageFilename('../mexico-home.webp', 'webp')).toBe(false);
    expect(approvedImageFilename('mexico-home.jpg', 'webp')).toBe(false);
  });
});
