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
    expect(themeVariablesCss).toContain('--bs-success-text-emphasis:#1A7C49');
    expect(themeVariablesCss).toContain('--bs-danger-text-emphasis:#A54042');
    expect(themeVariablesCss).toContain('--prepio-success-text:#1A7C49');
    expect(themeVariablesCss).toContain('--prepio-danger-text:#A54042');
    expect(themeVariablesCss).toMatch(/--bs-secondary-color-rgb:\d+, \d+, \d+/);
    expect(themeVariablesCss).toMatch(/--bs-secondary-bg-rgb:\d+, \d+, \d+/);
    expect(themeVariablesCss).toMatch(/--bs-tertiary-bg-rgb:\d+, \d+, \d+/);
    for (const v of ['primary', 'success', 'danger', 'warning']) {
      expect(themeVariablesCss).toContain(`--bs-${v}-bg-subtle:`);
      expect(themeVariablesCss).toContain(`--bs-${v}-border-subtle:`);
      expect(themeVariablesCss).toContain(`--bs-${v}-text-emphasis:`);
    }
    expect(themeVariablesCss).toContain('--bs-primary-text-emphasis:#0A5C55');
    expect(themeVariablesCss).toContain('--bs-warning-text-emphasis:#8A6A00');
    expect(themeVariablesCss).toContain('--bs-danger-bg-subtle:#');
    for (const old of ['#7A1F2B', '#F7F1E3', '#B8893B']) {
      expect(themeVariablesCss).not.toContain(old);
    }
  });
});
