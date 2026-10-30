import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@prepio/shared';
import { fontFamily, fontFiles } from '../src/theme/fonts';
import { paperTheme } from '../src/theme/paperTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);
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