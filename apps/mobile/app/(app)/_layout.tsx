import { Stack } from 'expo-router';
import { color } from '@prepio/shared';

/** The signed-in student's screens (only mounted when the root guard says `ready`). */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Prepio' }} />
      <Stack.Screen name="lesson/[id]" options={{ title: 'Lecție' }} />
    </Stack>
  );
}
