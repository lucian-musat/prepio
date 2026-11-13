import { Stack } from 'expo-router';
import { color } from '@prepio/shared';
import { AccessProvider } from '../../src/access/AccessProvider';
import { CreditsProvider } from '../../src/credits/CreditsProvider';
import { StreakProvider } from '../../src/streak/StreakProvider';

/** The signed-in student's screens (only mounted when the root guard says `ready`). */
export default function AppLayout() {
  return (
    <CreditsProvider>
      <AccessProvider>
        <StreakProvider>
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
          <Stack.Screen name="bac/index" options={{ title: 'Subiecte BAC' }} />
          <Stack.Screen name="bac/[id]/index" options={{ title: 'Subiect BAC' }} />
          <Stack.Screen name="bac/[id]/rezultat" options={{ title: 'Rezultat BAC' }} />
          <Stack.Screen name="profile" options={{ title: 'Profil' }} />
          <Stack.Screen name="credits" options={{ title: 'Creditele mele' }} />
          <Stack.Screen name="invita" options={{ title: 'Invită colegi' }} />
        </Stack>
        </StreakProvider>
      </AccessProvider>
    </CreditsProvider>
  );
}
