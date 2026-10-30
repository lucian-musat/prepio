import { describe, expect, it } from 'vitest';
import { assertLocalSupabase } from './localSupabase';

describe('assertLocalSupabase', () => {
  it('accepts 127.0.0.1 and localhost', () => {
    expect(() => assertLocalSupabase('int tests', ['http://127.0.0.1:54321'])).not.toThrow();
    expect(() => assertLocalSupabase('int tests', ['http://localhost:54321', 'http://127.0.0.1:54321'])).not.toThrow();
  });

  it('ignores unset URLs unless one is required', () => {
    expect(() => assertLocalSupabase('int tests', [undefined, ''])).not.toThrow();
    expect(() => assertLocalSupabase('e2e', [undefined], { required: true })).toThrow(/e2e refuses to run.*not set/);
  });

  it('refuses a cloud or otherwise non-local URL', () => {
    expect(() => assertLocalSupabase('int tests', ['https://abcd.supabase.co'])).toThrow(
      /int tests refuses to run against https:\/\/abcd\.supabase\.co.*127\.0\.0\.1 or localhost/,
    );
    expect(() => assertLocalSupabase('int tests', ['http://127.0.0.1:54321', 'https://x.supabase.co'])).toThrow();
    expect(() => assertLocalSupabase('int tests', ['http://localhost.evil.example'])).toThrow();
    expect(() => assertLocalSupabase('int tests', ['not a url'])).toThrow();
  });
});
