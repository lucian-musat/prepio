import { MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';
import { legacyColors, legacyRadius } from '@prepio/shared';
import { fontFamily } from './fonts';


export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: legacyRadius,
  colors: {
    ...MD3LightTheme.colors,
    primary: legacyColors.bordeaux,
    onPrimary: legacyColors.parchment,
    primaryContainer: legacyColors.parchment,
    onPrimaryContainer: legacyColors.bordeaux,
    secondary: legacyColors.gold,
    onSecondary: legacyColors.ink,
    background: legacyColors.parchment,
    onBackground: legacyColors.ink,
    surface: legacyColors.paper,
    onSurface: legacyColors.ink,
    surfaceVariant: legacyColors.paper,
    onSurfaceVariant: legacyColors.inkMuted,
    outline: legacyColors.border,
    outlineVariant: legacyColors.border,
    error: legacyColors.error,
    elevation: {
      level0: 'transparent',
      level1: legacyColors.paper,
      level2: legacyColors.paper,
      level3: legacyColors.paper,
      level4: legacyColors.paper,
      level5: legacyColors.paper,
    },
  },
  fonts: configureFonts({
    config: {
      ...Object.fromEntries(Object.entries(MD3LightTheme.fonts).map(([k, v]) => [k, { ...v, fontFamily: fontFamily.body }])),
      default: { ...MD3LightTheme.fonts.default, fontFamily: fontFamily.body, fontSize: 17, lineHeight: 26 },
      bodyLarge: { ...MD3LightTheme.fonts.bodyLarge, fontFamily: fontFamily.body, fontSize: 17, lineHeight: 26 },
      bodyMedium: { ...MD3LightTheme.fonts.bodyMedium, fontFamily: fontFamily.body, fontSize: 17, lineHeight: 26 },
      titleLarge: { ...MD3LightTheme.fonts.titleLarge, fontFamily: fontFamily.headingBold, fontWeight: '400', fontSize: 24, lineHeight: 32 },
      titleMedium: { ...MD3LightTheme.fonts.titleMedium, fontFamily: fontFamily.headingBold, fontWeight: '400', fontSize: 19, lineHeight: 26 },
      headlineSmall: { ...MD3LightTheme.fonts.headlineSmall, fontFamily: fontFamily.headingBold, fontWeight: '400', fontSize: 22, lineHeight: 30 },
      labelLarge: { ...MD3LightTheme.fonts.labelLarge, fontFamily: fontFamily.bodyBold, fontWeight: '400' },
    },
  }),
};
