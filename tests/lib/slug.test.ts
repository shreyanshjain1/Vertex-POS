import { slugify } from '../../lib/slug';

describe('lib/slug', () => {
  it('normalizes mixed punctuation into a stable slug', () => {
    expect(slugify('  Premium 12\" POS / Bundle -- New!  ')).toBe('premium-12-pos-bundle-new');
  });

  it('caps the slug length at 80 characters', () => {
    const input = 'x'.repeat(120);
    expect(slugify(input)).toHaveLength(80);
  });
});
