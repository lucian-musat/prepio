import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it.each([
    [0, '0 cuvinte'], [1, '1 cuvânt'], [2, '2 cuvinte'], [19, '19 cuvinte'], [20, '20 de cuvinte'],
    [100, '100 de cuvinte'], [105, '105 cuvinte'], [119, '119 cuvinte'], [120, '120 de cuvinte'], [1234, '1234 de cuvinte'],
  ])('%i', (n, expected) => expect(plural(n, 'cuvânt', 'cuvinte')).toBe(expected));
});
