import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
import { SourceSans3_400Regular, SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@prepio/shared';
import { fontFamily, paperTheme } from '../src/theme/paperTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fontFamily.heading]: Lora_400Regular,
    [fontFamily.headingBold]: Lora_700Bold,
    [fontFamily.body]: SourceSans3_400Regular,
    [fontFamily.bodyBold]: SourceSans3_700Bold,
  });
  const ready = loaded || !!error;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bordeaux },
            headerTintColor: colors.parchment,
            headerTitleStyle: { fontFamily: fontFamily.headingBold },
            contentStyle: { backgroundColor: colors.parchment },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Prepio' }} />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  );
}