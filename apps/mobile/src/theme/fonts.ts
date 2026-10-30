import { Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
import { SourceSans3_400Regular, SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3';

/**
 * Family names used in styles. They must be CSS-safe identifiers (no spaces, not starting
 * with a digit): react-native-web emits them unquoted, so "Source Sans 3" is silently ignored.
 */
export const fontFamily = {
  heading: 'Lora',
  headingBold: 'Lora-Bold',
  body: 'SourceSans3',
  bodyBold: 'SourceSans3-Bold',
} as const;

/** Passed to `useFonts` in app/_layout.tsx; keys are the family names above. */
export const fontFiles = {
  [fontFamily.heading]: Lora_400Regular,
  [fontFamily.headingBold]: Lora_700Bold,
  [fontFamily.body]: SourceSans3_400Regular,
  [fontFamily.bodyBold]: SourceSans3_700Bold,
};
