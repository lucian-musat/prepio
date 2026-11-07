import { Stack } from 'expo-router';
import { color } from '@prepio/shared';

/** A suspended account's only screen. Only mounted when the root guard says `suspended`. */
export default function SuspendedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Screen name="index" options={{ title: 'Cont suspendat' }} />
    </Stack>
  );
}
