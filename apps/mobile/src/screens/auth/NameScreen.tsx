import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, TextField } from '../../ui';
import { useAuth } from '../../auth/AuthProvider';
import { MAX_DISPLAY_NAME_CHARS, updateDisplayName, validateDisplayName } from '../../lib/profile';

const OFFLINE = 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.';
const SAVE_FAILED = 'Numele nu a putut fi salvat. Încearcă din nou.';

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
      setError(OFFLINE);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateDisplayName(userId, name);
      await refreshProfile();
    } catch (e) {
      // Plain Errors carry our Romanian messages; anything else (PostgREST/network objects) gets the generic one.
      setError(e instanceof Error && e.constructor === Error ? e.message : SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout logo actions={<Button flex label="Continuă" onPress={submit} loading={saving} />}>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header">
          Cum te numești?
        </AppText>
        <AppText color="textMuted">Îți spunem pe nume în aplicație. Îl poți schimba mai târziu.</AppText>
        <TextField
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          accessibilityLabel="Numele tău"
          placeholder="Prenumele tău"
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
        <AppText role="caption" color="textMuted">{`Cel mult ${MAX_DISPLAY_NAME_CHARS} de caractere.`}</AppText>
        <AppText role="small" color="primaryStrong" accessibilityRole="link" onPress={signOut} style={styles.signOut}>
          Ieși din cont
        </AppText>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
  signOut: { textDecorationLine: 'underline', marginTop: space[2] },
});
