import { Stack } from 'expo-router';
import { color } from '@prepio/shared';
import { AccessProvider } from '../../src/access/AccessProvider';
import { CreditsProvider } from '../../src/credits/CreditsProvider';

/** The signed-in student's screens (only mounted when the root guard says `ready`). */
export default function AppLayout() {
  return (
    <CreditsProvider>
      <AccessProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Prepio' }} />
          <Stack.Screen name="lesson/[id]/index" options={{ title: 'Lecție' }} />
          <Stack.Screen name="lesson/[id]/consolidare" options={{ title: 'Consolidare' }} />
          <Stack.Screen name="profile" options={{ title: 'Profil' }} />
          <Stack.Screen name="credits" options={{ title: 'Creditele mele' }} />
        </Stack>
      </AccessProvider>
    </CreditsProvider>
  );
}
