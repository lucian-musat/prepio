import { Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
import { Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';
import { SourceSans3_400Regular, SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3';

/**
 * Family names used in styles. They must be CSS-safe identifiers (no spaces, not starting
 * with a digit): react-native-web emits them unquoted, so "Source Sans 3" is silently ignored.
 * The legacy* keys (Lora / Source Sans) go away when the old screens are migrated.
 */
export const fontFamily = {
  headBlack: 'Nunito-Black',
  headExtra: 'Nunito-ExtraBold',
  body: 'NunitoSans',
  bodySemi: 'NunitoSans-SemiBold',
  bodyBold: 'NunitoSans-Bold',
  legacyHeading: 'Lora',
  legacyHeadingBold: 'Lora-Bold',
  legacyBody: 'SourceSans3',
  legacyBodyBold: 'SourceSans3-Bold',
} as const;

/** Passed to useFonts in app/_layout.tsx; keys are the family names above. */
export const fontFiles = {
  [fontFamily.headBlack]: Nunito_900Black,
  [fontFamily.headExtra]: Nunito_800ExtraBold,
  [fontFamily.body]: NunitoSans_400Regular,
  [fontFamily.bodySemi]: NunitoSans_600SemiBold,
  [fontFamily.bodyBold]: NunitoSans_700Bold,
  [fontFamily.legacyHeading]: Lora_400Regular,
  [fontFamily.legacyHeadingBold]: Lora_700Bold,
  [fontFamily.legacyBody]: SourceSans3_400Regular,
  [fontFamily.legacyBodyBold]: SourceSans3_700Bold,
};
