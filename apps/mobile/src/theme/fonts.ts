import { Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';

/**
 * Family names used in styles. They must be CSS-safe identifiers (no spaces, not starting
 * with a digit): react-native-web emits them unquoted, so "Source Sans 3" is silently ignored.
 */
export const fontFamily = {
  headBlack: 'Nunito-Black',
  headExtra: 'Nunito-ExtraBold',
  body: 'NunitoSans',
  bodySemi: 'NunitoSans-SemiBold',
  bodyBold: 'NunitoSans-Bold',
} as const;

/** Passed to useFonts in app/_layout.tsx; keys are the family names above. */
export const fontFiles = {
  [fontFamily.headBlack]: Nunito_900Black,
  [fontFamily.headExtra]: Nunito_800ExtraBold,
  [fontFamily.body]: NunitoSans_400Regular,
  [fontFamily.bodySemi]: NunitoSans_600SemiBold,
  [fontFamily.bodyBold]: NunitoSans_700Bold,
};
