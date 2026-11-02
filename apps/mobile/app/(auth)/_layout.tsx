import { Stack } from 'expo-router';
import { color } from '@prepio/shared';

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
      <Stack.Screen name="index" options={{ title: 'Prepio' }} />
    </Stack>
  );
}
