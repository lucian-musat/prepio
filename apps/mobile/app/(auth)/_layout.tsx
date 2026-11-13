import { Stack } from 'expo-router';
import { color } from '@prepio/shared';
import { t } from '../../src/texts/store';

/** Signed-out screens (welcome, email code). Only mounted when the root guard says `signedOut`. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ title: t('meta.appName') }} />
      <Stack.Screen name="email" options={{ title: t('meta.route.email') }} />
      <Stack.Screen name="code" options={{ title: t('meta.route.code') }} />
    </Stack>
  );
}
