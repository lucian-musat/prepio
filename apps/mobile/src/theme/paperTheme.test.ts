import { paperTheme } from './paperTheme';

it('uses 17px / 26 line-height for default and body text', () => {
  for (const key of ['default', 'bodyLarge', 'bodyMedium'] as const) {
    expect(paperTheme.fonts[key]).toMatchObject({ fontSize: 17, lineHeight: 26, fontFamily: 'Source Sans 3' });
  }
});
