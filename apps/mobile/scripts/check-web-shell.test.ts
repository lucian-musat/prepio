/// <reference types="node" />
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { color } from '@prepio/shared';

const root = join(__dirname, '..');
const html = () => readFileSync(join(root, 'public/index.html'), 'utf8');
const DESCRIPTION =
  'Prepio te ajută să te pregătești pentru BAC-ul la istorie: lecții scurte, întrebări de verificare și exerciții după modelul subiectelor, cu feedback de la profesorul digital.';

const meta = (attr: 'name' | 'property', key: string) => {
  const m = html().match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`));
  return m?.[1];
};

describe('web shell (public/index.html)', () => {
  it('declares Romanian', () => {
    expect(html()).toMatch(/<html lang="ro">/);
  });

  it('has the description and the share preview tags', () => {
    expect(meta('name', 'description')).toBe(DESCRIPTION);
    expect(meta('property', 'og:title')).toBe('Prepio — pregătire BAC la istorie');
    expect(meta('property', 'og:description')).toBe(DESCRIPTION);
    expect(meta('property', 'og:image')).toBe('https://prepio.ro/og-image.png');
    expect(meta('property', 'og:url')).toBe('https://prepio.ro');
    expect(meta('property', 'og:locale')).toBe('ro_RO');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('has the theme colour and the manifest', () => {
    expect(meta('name', 'theme-color')).toBe(color.primary);
    expect(html()).toContain('<link rel="manifest" href="/manifest.json" />');
  });

  it('has a Romanian noscript text and keeps the Expo root reset', () => {
    expect(html()).toContain('<noscript>Prepio are nevoie de JavaScript ca să funcționeze.</noscript>');
    expect(html()).toContain('<style id="expo-reset">');
    expect(html()).toContain('<div id="root"></div>');
  });

  it('ships the manifest and the share image', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ name: 'Prepio', short_name: 'Prepio', lang: 'ro', theme_color: color.primary, background_color: color.bg });
    expect(existsSync(join(root, 'public/og-image.png'))).toBe(true);
  });
});
