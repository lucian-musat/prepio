import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, Surface, TextField, goBackOrHome } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { deleteAccount } from '../lib/api';
import { MAX_DISPLAY_NAME_CHARS, updateDisplayName, validateDisplayName } from '../lib/profile';

const OFFLINE = 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.';
const SAVE_FAILED = 'Numele nu a putut fi salvat. Încearcă din nou.';
const DELETE_FAILED = 'Contul nu a putut fi șters. Încearcă din nou.';

// Plain Errors carry our Romanian messages; anything else (PostgREST/network objects) gets the generic one.
const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** The signed-in student's profile: rename, sign out, delete the account (in-app confirm, required by Google Play). */
export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const busy = saving || deleting;

  const save = async () => {
    if (busy) return;
    setSaved(false);
    const valid = validateDisplayName(name);
    if (!valid.ok) {
      setNameError(valid.message);
      return;
    }
    const userId = session?.user.id;
    if (!userId) {
      setNameError(OFFLINE);
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      await updateDisplayName(userId, valid.value);
      await refreshProfile();
      setSaved(true);
    } catch (e) {
      setNameError(messageOf(e, SAVE_FAILED));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    if (!session) {
      setDeleteError(OFFLINE);
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // The status change navigates back to the welcome screen; the screen unmounts, so no state reset.
      await signOut();
    } catch (e) {
      setDeleteError(messageOf(e, DELETE_FAILED));
      setDeleting(false);
    }
  };

  return (
    <ScreenLayout title="Profilul tău" onBack={goBackOrHome}>
      <View style={styles.stack}>
        <View style={styles.field}>
          <AppText role="small" color="textMuted">
            Nume
          </AppText>
          <TextField
            value={name}
            onChangeText={(t) => {
              setName(t);
              setNameError(null);
              setSaved(false);
            }}
            accessibilityLabel="Nume"
            placeholder="Prenumele tău"
            autoComplete="given-name"
            textContentType="givenName"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
            invalid={!!nameError}
          />
          {nameError ? (
            <AppText role="small" color="danger" accessibilityRole="alert">
              {nameError}
            </AppText>
          ) : null}
          {saved ? <AppText role="small" color="success">Numele a fost salvat.</AppText> : null}
          <AppText role="caption" color="textMuted">{`Cel mult ${MAX_DISPLAY_NAME_CHARS} de caractere.`}</AppText>
        </View>
        <Button label="Salvează" onPress={save} loading={saving} disabled={deleting} />

        <Button label="Ieși din cont" variant="secondary" onPress={signOut} disabled={busy} />

        {confirming ? (
          <Surface style={styles.confirm}>
            <AppText accessibilityRole="alert">
              Ștergi contul definitiv? Numele, emailul și tot ce ține de cont se șterg și nu mai pot fi recuperate.
            </AppText>
            {deleteError ? (
              <AppText role="small" color="danger" accessibilityRole="alert">
                {deleteError}
              </AppText>
            ) : null}
            <Button label="Da, șterge contul" tone="danger" onPress={remove} loading={deleting} />
            <Button
              label="Renunță"
              variant="secondary"
              onPress={() => {
                setConfirming(false);
                setDeleteError(null);
              }}
              disabled={deleting}
            />
          </Surface>
        ) : (
          <Button label="Șterge contul" variant="secondary" tone="danger" onPress={() => setConfirming(true)} disabled={busy} />
        )}

        <AppText
          role="small"
          color="primaryStrong"
          accessibilityRole="link"
          onPress={() => router.push('/confidentialitate')}
          style={styles.link}
        >
          Politica de confidențialitate
        </AppText>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4] },
  field: { gap: space[2] },
  confirm: { gap: space[3] },
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start' },
});
