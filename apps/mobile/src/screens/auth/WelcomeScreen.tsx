import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, Enter, ScreenLayout } from '../../ui';
import { signInWithGoogle } from '../../auth/google';
import { emailAuthEnabled } from '../../lib/flags';
import AuthHero from './AuthHero';

const TITLE = 'Bun venit la Prepio';
const SUBTITLE = 'Pregătește-te pentru BAC cu lecții scurte și exerciții. Intră sau creează-ți cont ca să începi.';

/** First screen for a signed-out student: Google, and email code when the build enables it. */
export default function WelcomeScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      // 'ok' needs nothing here: the status change swaps the route group. 'cancelled' is silent.
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nu am putut face autentificarea. Încearcă din nou.');
    } finally {
      setPending(false);
    }
  };

  return (
    <ScreenLayout logo>
      <View style={styles.stack}>
        <Enter index={0}>
          <AuthHero title={TITLE} body={SUBTITLE} />
        </Enter>
        <Enter index={1} style={styles.buttons}>
          <Button label="Continuă cu Google" onPress={google} disabled={pending} loading={pending} />
          {emailAuthEnabled() ? (
            <Button label="Continuă cu email" variant="secondary" onPress={() => router.push('/email')} disabled={pending} />
          ) : null}
          {error ? (
            <AppText role="small" color="danger" accessibilityRole="alert" style={styles.center}>
              {error}
            </AppText>
          ) : null}
        </Enter>
        <Enter index={2}>
          <AppText role="caption" color="textMuted" style={styles.center}>
            {'Continuând, ești de acord cu '}
            <AppText
              role="caption"
              color="primaryStrong"
              accessibilityRole="link"
              onPress={() => router.push('/confidentialitate' as never)}
              style={styles.link}
            >
              Politica de confidențialitate
            </AppText>
            .
          </AppText>
        </Enter>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[5], paddingTop: space[1] },
  buttons: { gap: space[4] },
  center: { textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
});
