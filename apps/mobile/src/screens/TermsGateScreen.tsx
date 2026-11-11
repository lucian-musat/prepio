import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, TextButton } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import AgeTermsCheckbox from '../components/AgeTermsCheckbox';
import { TERMS_VERSION } from '../lib/legal';
import { acceptTerms } from '../lib/termsConsent';

const SAVE_FAILED = 'Nu am putut salva. Încearcă din nou.';

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
      // The refresh never throws; a profile still without the current terms means the status did not move on.
      const fresh = await refreshProfile();
      if (fresh?.termsVersion !== TERMS_VERSION) setError(SAVE_FAILED);
    } catch (e) {
      console.warn('[terms] accept failed:', e);
      setError(SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout
      logo
      actions={<Button flex label="Continuă" onPress={submit} disabled={!checked || saving} loading={saving} />}
    >
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header">
          Înainte să continui
        </AppText>
        <AppText color="textMuted">
          Prepio este pentru elevii de clasa a XII-a care au cel puțin 16 ani. Ca să folosești aplicația, confirmă
          vârsta și acceptă termenii.
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
        <TextButton label="Ieși din cont" onPress={signOut} disabled={saving} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
});
