import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout } from '../ui';
import { captureError } from '../lib/sentry';
import { t } from '../texts/store';

/**
 * Root error boundary screen. It renders above AuthProvider, so it must not use auth hooks, and the error
 * text is never shown to the student (it goes to Sentry when that is configured).
 */
export default function ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  // Reported once per error (a retry that fails again mounts the screen with the new error).
  useEffect(() => {
    captureError(error, { handled: false });
  }, [error]);

  return (
    <ScreenLayout logo>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header" style={styles.centre}>
          {t('errors.crash.title')}
        </AppText>
        <AppText role="body" color="textMuted" style={styles.centre}>
          {t('errors.crash.body')}
        </AppText>
        <Button label={t('common.retry')} onPress={() => void retry()} />
        <Button label={t('common.goHome')} variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4], paddingTop: space[6] },
  centre: { textAlign: 'center' },
});
