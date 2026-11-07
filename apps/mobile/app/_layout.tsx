import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color } from '@prepio/shared';
import { fontFiles } from '../src/theme/fonts';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';

SplashScreen.preventAutoHideAsync();

/**
 * Keeps the splash up until the fonts and the stored session are resolved, then shows exactly one route group:
 * signed out → (auth), suspended → (suspended), signed in without a name or mode → (onboarding), otherwise → (app). A guarded route that becomes
 * unavailable redirects to the first available one, so nothing in (app) is reachable without a session.
 */
function RootNavigator() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const { status } = useAuth();
  const ready = (fontsLoaded || !!fontError) && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Suspended (by an admin): one screen, whatever the name / mode; the server refuses everything else. */}
        <Stack.Protected guard={status === 'suspended'}>
          <Stack.Screen name="(suspended)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'needsName'}>
          <Stack.Screen name="(onboarding)/name" options={{ title: 'Cum te numești?' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'needsMode'}>
          <Stack.Screen name="(onboarding)/mode" options={{ title: 'Cum vrei să înveți?' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'ready'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        {/* Public pages (Google Play needs them reachable signed out): outside every guard. */}
        <Stack.Screen name="confidentialitate" options={{ title: 'Politica de confidențialitate' }} />
        <Stack.Screen name="sterge-cont" options={{ title: 'Ștergerea contului' }} />
        {/* Admin card preview (iframe): needs no session and reads no data, the card arrives by postMessage. */}
        <Stack.Screen name="preview" options={{ title: 'Previzualizare' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    // Gesture detectors (the card stepper swipe) need a root view above them on native.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
