import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, TextField } from '../../ui';
import { useAuth } from '../../auth/AuthProvider';
import { MAX_DISPLAY_NAME_CHARS, updateDisplayName, validateDisplayName } from '../../lib/profile';
import { ownMessage } from '../../lib/errorMessage';
import { t } from '../../texts/store';


/** "Cum te numești?" shown once, right after the first sign-in. Saving flips the status to ready (AuthProvider). */
export default function NameScreen() {
  const { session, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    const valid = validateDisplayName(name);
    if (!valid.ok) {
      setError(valid.message);
      return;
    }
    const userId = session?.user.id;
    if (!userId) {
      setError(t('errors.offline'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateDisplayName(userId, name);
      await refreshProfile();
    } catch (e) {
      setError(ownMessage(e, t('onboarding.name.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout logo actions={<Button flex label={t('common.continue')} onPress={submit} loading={saving} />}>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header">
          {t('onboarding.name.title')}
        </AppText>
        <AppText color="textMuted">{t('onboarding.name.body')}</AppText>
        <TextField
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          accessibilityLabel={t('onboarding.name.fieldLabel')}
          placeholder={t('onboarding.name.placeholder')}
          autoComplete="given-name"
          textContentType="givenName"
          autoCapitalize="words"
          returnKeyType="done"
          autoFocus
          onSubmitEditing={submit}
          invalid={!!error}
        />
        {error ? (
          <AppText role="small" color="danger" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <AppText role="caption" color="textMuted">{t('onboarding.name.limit', { max: MAX_DISPLAY_NAME_CHARS })}</AppText>
        <AppText role="small" color="primaryStrong" accessibilityRole="link" onPress={signOut} style={styles.signOut}>
          {t('auth.signOut')}
        </AppText>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
  signOut: { textDecorationLine: 'underline', marginTop: space[2] },
});
