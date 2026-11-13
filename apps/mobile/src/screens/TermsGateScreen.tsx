import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, TextButton } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import AgeTermsCheckbox, { consentHint } from '../components/AgeTermsCheckbox';
import { CONTACT_EMAIL, TERMS_VERSION } from '../lib/legal';
import { acceptTerms, clearConsent, isTermsVersionMismatch } from '../lib/termsConsent';
import { t } from '../texts/store';


/**
 * Terms gate (root guard `needsTerms`), before the name and mode: a signed-in student who never accepted the
 * current terms (an older account, a sign-in whose stored consent was lost, or new terms). Accepting refreshes
 * the profile, which moves the status on (AuthProvider); a student who doesn't accept can sign out.
 */
export default function TermsGateScreen() {
  const { refreshProfile, signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving || !checked) return;
    setError(null);
    setSaving(true);
    try {
      await acceptTerms();
      // Recorded on the account: a consent still stored from Welcome is no longer needed.
      await clearConsent();
      // The refresh never throws; a profile still without the current terms means the status did not move on.
      const fresh = await refreshProfile();
      if (fresh?.termsVersion !== TERMS_VERSION) setError(t('onboarding.terms.saveFailed'));
    } catch (e) {
      console.warn('[terms] accept failed:', e);
      setError(isTermsVersionMismatch(e) ? t('onboarding.terms.outdated', { email: CONTACT_EMAIL }) : t('onboarding.terms.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout
      logo
      actions={
        <Button
          flex
          label={t('common.continue')}
          onPress={submit}
          disabled={!checked || saving}
          loading={saving}
          accessibilityHint={checked ? undefined : consentHint()}
        />
      }
    >
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header">
          {t('onboarding.terms.title')}
        </AppText>
        <AppText color="textMuted">
          {t('onboarding.terms.body')}
        </AppText>
        <AgeTermsCheckbox
          checked={checked}
          onChange={(next) => {
            setChecked(next);
            setError(null);
          }}
          disabled={saving}
        />
        {error ? (
          <AppText role="small" color="danger" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <TextButton label={t('auth.signOut')} onPress={signOut} disabled={saving} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
});
