import { Stack } from 'expo-router';
import { color } from '@prepio/shared';
import { t } from '../../src/texts/store';

/** A suspended account's only screen. Only mounted when the root guard says `suspended`. */
export default function SuspendedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Screen name="index" options={{ title: t('meta.route.suspended') }} />
    </Stack>
  );
}
