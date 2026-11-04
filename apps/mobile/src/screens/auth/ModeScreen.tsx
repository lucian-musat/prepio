import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout } from '../../ui';
import { useAuth } from '../../auth/AuthProvider';
import LearningModePicker from '../../components/LearningModePicker';
import { DEFAULT_MODE, type LearningMode } from '../../lib/learningMode';
import { updateLearningMode } from '../../lib/profile';

const OFFLINE = 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.';
const SAVE_FAILED = 'Modul nu a putut fi salvat. Încearcă din nou.';

/** "Cum vrei să înveți?" shown once, after the name. Saving flips the status to ready (AuthProvider). */
export default function ModeScreen() {
  const { session, refreshProfile, signOut } = useAuth();
  const [mode, setMode] = useState<LearningMode>(DEFAULT_MODE);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    const userId = session?.user.id;
    if (!userId) {
      setError(OFFLINE);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateLearningMode(userId, mode);
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
          Cum vrei să înveți?
        </AppText>
        <AppText color="textMuted">Poți schimba oricând din Profil.</AppText>
        <LearningModePicker
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          disabled={saving}
        />
        {error ? (
          <AppText role="small" color="danger" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
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
