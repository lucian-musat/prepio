import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, Enter, ScreenLayout } from '../../ui';
import { signInWithGoogle } from '../../auth/google';
import { emailAuthEnabled } from '../../lib/flags';
import { TERMS_VERSION } from '../../lib/legal';
import { clearConsent, getStoredConsent, storeConsent } from '../../lib/termsConsent';
import AgeTermsCheckbox, { CONSENT_HINT } from '../../components/AgeTermsCheckbox';
import AuthHero from './AuthHero';

const TITLE = 'Bun venit la Prepio';
const SUBTITLE = 'Pregătește-te pentru BAC cu lecții scurte și exerciții. Intră sau creează-ți cont ca să începi.';

/**
 * First screen for a signed-out student: the required 14+/terms checkbox, then Google, and email code when the
 * build enables it. The consent is stored on this device (it survives the web OAuth redirect) and recorded on the
 * account right after the sign-in (AuthProvider), so a new student goes straight to the name.
 */
export default function WelcomeScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const touched = useRef(false);

  // Back on Welcome with a consent given on this device minutes ago (getStoredConsent drops a stale one).
  useEffect(() => {
    let live = true;
    void getStoredConsent().then((v) => {
      if (live && !touched.current && v === TERMS_VERSION) setConsented(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const toggle = (next: boolean) => {
    touched.current = true;
    setConsented(next);
    void (next ? storeConsent(TERMS_VERSION) : clearConsent());
  };

  const google = async () => {
    if (pending || !consented) return;
    setPending(true);
    setError(null);
    try {
      // Written before leaving the page (web redirect), whatever happened to the earlier write.
      await storeConsent(TERMS_VERSION);
      // 'ok' needs nothing here: the status change swaps the route group. 'cancelled' is silent, but the consent
      // stored for it goes (a later sign-in, maybe by someone else, must not inherit it); the next press stores it again.
      if ((await signInWithGoogle()) === 'cancelled') await clearConsent();
    } catch (e) {
      await clearConsent();
      setError(e instanceof Error ? e.message : 'Nu am putut face autentificarea. Încearcă din nou.');
    } finally {
      setPending(false);
    }
  };

  const email = () => {
    if (pending || !consented) return;
    void storeConsent(TERMS_VERSION);
    router.push('/email');
  };

  return (
    <ScreenLayout logo>
      <View style={styles.stack}>
        <Enter index={0}>
          <AuthHero title={TITLE} body={SUBTITLE} />
        </Enter>
        <Enter index={1}>
          <AgeTermsCheckbox checked={consented} onChange={toggle} disabled={pending} />
        </Enter>
        <Enter index={2} style={styles.buttons}>
          <Button
            label="Continuă cu Google"
            onPress={google}
            disabled={pending || !consented}
            loading={pending}
            accessibilityHint={consented ? undefined : CONSENT_HINT}
          />
          {emailAuthEnabled() ? (
            <Button
              label="Continuă cu email"
              variant="secondary"
              onPress={email}
              disabled={pending || !consented}
              accessibilityHint={consented ? undefined : CONSENT_HINT}
            />
          ) : null}
          {error ? (
            <AppText role="small" color="danger" accessibilityRole="alert" style={styles.center}>
              {error}
            </AppText>
          ) : null}
        </Enter>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[5], paddingTop: space[1] },
  buttons: { gap: space[4] },
  center: { textAlign: 'center' },
});
