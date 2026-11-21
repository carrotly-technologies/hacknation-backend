import { parseFlag } from './features.js';

describe('parseFlag', () => {
  it('falls back to the default when unset or empty', () => {
    expect(parseFlag(undefined, true)).toBe(true);
    expect(parseFlag('', true)).toBe(true);
    expect(parseFlag('  ', false)).toBe(false);
  });

  it('reads off values as false', () => {
    for (const v of ['false', 'FALSE', ' False ', '0', 'off', 'no']) {
      expect(parseFlag(v, true)).toBe(false);
    }
  });

  it('reads other values as true', () => {
    for (const v of ['true', 'TRUE', '1', 'on', 'yes']) {
      expect(parseFlag(v, false)).toBe(true);
    }
  });
});
