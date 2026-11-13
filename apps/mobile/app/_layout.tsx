import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { color } from '@prepio/shared';
import { fontFiles } from '../src/theme/fonts';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import ErrorScreen from '../src/screens/ErrorScreen';
import { initSentry } from '../src/lib/sentry';
import { useTextsBoot } from '../src/texts/useTextsBoot';
import { hideBootLoader } from '../src/texts/bootLoader';

// Before anything renders, so start-up errors are reported too. Off (returns false) without a DSN.
const sentryEnabled = initSentry();

SplashScreen.preventAutoHideAsync();

/** Root error boundary: renders above the providers, so ErrorScreen uses no auth. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  // A start-up error must not stay hidden behind the splash / web boot loader.
  useEffect(() => {
    SplashScreen.hideAsync();
    hideBootLoader();
  }, []);
  return <ErrorScreen {...props} />;
}

/**
 * Keeps the splash (web: the boot loader of public/index.html) up until the fonts, the stored session and the UI
 * texts (device cache, else the network for at most 1.5 s, else the defaults) are resolved, then shows exactly one
 * route group:
 * signed out → (auth), suspended → (suspended), signed in without the current terms, a name or a mode → (onboarding),
 * otherwise → (app). A guarded route that becomes
 * unavailable redirects to the first available one, so nothing in (app) is reachable without a session.
 */
function RootNavigator() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const { status } = useAuth();
  const textsReady = useTextsBoot();
  const ready = (fontsLoaded || !!fontError) && status !== 'loading' && textsReady;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    hideBootLoader();
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
        {/* Terms gate (14+ and parental consent, the current terms), before the name and mode. */}
        <Stack.Protected guard={status === 'needsTerms'}>
          <Stack.Screen name="(onboarding)/terms" options={{ title: 'Înainte să continui' }} />
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
        <Stack.Screen name="termeni" options={{ title: 'Termeni de utilizare' }} />
        <Stack.Screen name="sterge-cont" options={{ title: 'Ștergerea contului' }} />
        {/* Invite link: stores the code, then replaces to "/" (the guard picks the screen); a signed-out visitor must reach it. */}
        <Stack.Screen name="invita/[code]" options={{ title: 'Invitație' }} />
        {/* Referral rules page (linked from the invite screen and the Welcome code field): public like the legal pages. */}
        <Stack.Screen name="recomandari" options={{ title: 'Cum funcționează recomandările' }} />
        {/* Admin card preview (iframe): needs no session and reads no data, the card arrives by postMessage. */}
        <Stack.Screen name="preview" options={{ title: 'Previzualizare' }} />
      </Stack>
    </>
  );
}

function RootLayout() {
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

// Sentry.wrap adds the touch-event and app-start instrumentation; without a DSN the plain layout is exported.
export default sentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;
