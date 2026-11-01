import { describe, expect, it } from 'vitest';
import { themeVariablesCss } from './theme';

describe('themeVariablesCss', () => {
  it('maps semantic tokens to bootstrap variables', () => {
    expect(themeVariablesCss).toContain('--bs-primary:#0F766E');
    expect(themeVariablesCss).toContain('--bs-body-bg:#F3FAF7');
    expect(themeVariablesCss).toContain('--bs-link-color:#0A5C55');
    expect(themeVariablesCss).toContain('--bs-border-radius:14px');
    expect(themeVariablesCss).toContain('--prepio-primary-strong:#0A5C55');
    expect(themeVariablesCss).toContain('--prepio-hero-from:#0D9488');
    for (const old of ['#7A1F2B', '#F7F1E3', '#B8893B']) {
      expect(themeVariablesCss).not.toContain(old);
    }
  });
});
