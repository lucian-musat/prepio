import { Stack } from 'expo-router';
import { color } from '@prepio/shared';
import { AccessProvider } from '../../src/access/AccessProvider';
import { CreditsProvider } from '../../src/credits/CreditsProvider';
import { StreakProvider } from '../../src/streak/StreakProvider';
import { t } from '../../src/texts/store';

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
          <Stack.Screen name="index" options={{ title: t('meta.appName') }} />
          <Stack.Screen name="lesson/[id]/index" options={{ title: t('meta.route.lesson') }} />
          <Stack.Screen name="lesson/[id]/consolidare" options={{ title: t('meta.route.consolidation') }} />
          <Stack.Screen name="bac/index" options={{ title: t('meta.route.bacList') }} />
          <Stack.Screen name="bac/[id]/index" options={{ title: t('meta.route.bacPaper') }} />
          <Stack.Screen name="bac/[id]/rezultat" options={{ title: t('meta.route.bacResult') }} />
          <Stack.Screen name="profile" options={{ title: t('meta.route.profile') }} />
          <Stack.Screen name="credits" options={{ title: t('meta.route.credits') }} />
          <Stack.Screen name="invita" options={{ title: t('meta.route.inviteFriends') }} />
        </Stack>
        </StreakProvider>
      </AccessProvider>
    </CreditsProvider>
  );
}
