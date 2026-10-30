import { fontFamily, fontFiles } from './fonts';
import { paperTheme } from './paperTheme';

it('uses 17px / 26 line-height for default and body text', () => {
  for (const key of ['default', 'bodyLarge', 'bodyMedium'] as const) {
    expect(paperTheme.fonts[key]).toMatchObject({ fontSize: 17, lineHeight: 26 });
  }
});

it('references only font families that are loaded, with CSS-safe names', () => {
  const loaded = Object.keys(fontFiles);
  for (const key of ['default', 'bodyLarge', 'bodyMedium', 'labelLarge', 'titleMedium'] as const) {
    expect(loaded).toContain(paperTheme.fonts[key].fontFamily);
  }
  for (const name of Object.values(fontFamily)) {
    expect(loaded).toContain(name);
    expect(name).toMatch(/^[A-Za-z_][A-Za-z0-9_-]*$/);
  }
});
