import { MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';
import { colors, radius } from '@prepio/shared';
import { fontFamily } from './fonts';


export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: radius,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.bordeaux,
    onPrimary: colors.parchment,
    primaryContainer: colors.parchment,
    onPrimaryContainer: colors.bordeaux,
    secondary: colors.gold,
    onSecondary: colors.ink,
    background: colors.parchment,
    onBackground: colors.ink,
    surface: colors.paper,
    onSurface: colors.ink,
    surfaceVariant: colors.paper,
    onSurfaceVariant: colors.inkMuted,
    outline: colors.border,
    outlineVariant: colors.border,
    error: colors.error,
    elevation: {
      level0: 'transparent',
      level1: colors.paper,
      level2: colors.paper,
      level3: colors.paper,
      level4: colors.paper,
      level5: colors.paper,
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
