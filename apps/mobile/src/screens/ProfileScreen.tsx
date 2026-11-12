import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { color, formatAccessDate, space } from '@prepio/shared';
import { AppText, Button, Chip, ScreenLayout, SettingsRow, Surface, TextField, goBackOrHome } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { OFFLINE } from '../lib/api';
import { DeleteAccountConfirm, useAccountDeletion } from '../components/AccountDeletion';
import { MAX_DISPLAY_NAME_CHARS, updateDisplayName, updateLearningMode, validateDisplayName } from '../lib/profile';
import { modeOf, type LearningMode } from '../lib/learningMode';
import LearningModePicker from '../components/LearningModePicker';
import { ownMessage } from '../lib/errorMessage';
import { useCredits } from '../credits/CreditsProvider';
import { useAccess } from '../access/AccessProvider';
import { progressBadge, useReferralSummary } from '../referrals/useReferralSummary';

const SAVE_FAILED = 'Numele nu a putut fi salvat. Încearcă din nou.';
const MODE_SAVE_FAILED = 'Modul nu a putut fi salvat. Încearcă din nou.';
const MODE_SAVED = 'Modul a fost salvat.';
// Saved in the database, but the app still holds the old profile (the refresh failed).
const MODE_SAVED_STALE = 'Modul a fost salvat. Reîncarcă aplicația dacă nu vezi schimbarea.';

// Plain Errors carry our Romanian messages; anything else (PostgREST/network objects) gets the generic one.
const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** The signed-in student's profile: rename, sign out, delete the account (in-app confirm, required by Google Play). */
export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const { balance } = useCredits();
  const { status } = useAccess();
  const referral = useReferralSummary();
  const badge = referral ? progressBadge(referral) : null;
  const planLabel = status.plan === 'trial' ? 'Perioadă de probă' : status.plan === 'expired' ? 'Expirat' : `Acces până la ${formatAccessDate(status.until)}`;
  const [name, setName] = useState(profile?.displayName ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const deletion = useAccountDeletion();
  const { deleting } = deletion;
  const [mode, setMode] = useState<LearningMode>(modeOf(profile));
  const [modeSaving, setModeSaving] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [modeSaved, setModeSaved] = useState<string | null>(null);
  const busy = saving || deleting;
  const unchanged = name.trim() === (profile?.displayName ?? '').trim();
  const email = session?.user.email;
  const provider = (session?.user as { app_metadata?: { provider?: string } } | undefined)?.app_metadata?.provider;
  const account = email ? `${email} · ${provider === 'google' ? 'Google' : 'cod pe email'}` : null;

  // Saves right away (no button); on failure the picker goes back to the stored mode.
  const changeMode = async (next: LearningMode) => {
    if (busy || modeSaving || next === mode) return;
    const previous = mode;
    setModeSaved(null);
    const userId = session?.user.id;
    if (!userId) {
      setModeError(OFFLINE);
      return;
    }
    setModeError(null);
    setMode(next);
    setModeSaving(true);
    try {
      await updateLearningMode(userId, next);
      // The refresh never throws; the picker keeps the saved mode either way (the database has it).
      const fresh = await refreshProfile();
      setModeSaved(fresh?.learningMode === next ? MODE_SAVED : MODE_SAVED_STALE);
    } catch (e) {
      setMode(previous);
      setModeError(ownMessage(e, MODE_SAVE_FAILED));
    } finally {
      setModeSaving(false);
    }
  };

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
          {account ? (
            <AppText role="caption" color="textMuted">
              {account}
            </AppText>
          ) : null}
        </View>
        <Button label="Salvează" onPress={save} loading={saving} disabled={deleting || unchanged} />

        <View style={styles.field}>
          <AppText role="small" color="textMuted">
            Mod de învățare
          </AppText>
          <LearningModePicker value={mode} onChange={changeMode} disabled={modeSaving || deleting} />
          {modeError ? (
            <AppText role="small" color="danger" accessibilityRole="alert">
              {modeError}
            </AppText>
          ) : null}
          {modeSaved ? <AppText role="small" color="success">{modeSaved}</AppText> : null}
        </View>

        <Surface radius="lg" style={styles.group}>
          <SettingsRow label="Accesul meu" value={planLabel} onPress={() => router.push('/abonament')} disabled={busy} />
          <SettingsRow label="Creditele mele" value={String(balance ?? 0)} onPress={() => router.push('/credits')} disabled={busy} divider />
          {referral ? (
            <SettingsRow
              label="Invită colegi"
              accessibilityLabel={badge ? `Invită colegi, ${badge}` : 'Invită colegi'}
              badge={badge ? <Chip label={badge} fg={color.primaryStrong} bg={color.primarySubtle} size="badge" /> : null}
              onPress={() => router.push('/invita')}
              disabled={busy}
              divider
            />
          ) : null}
        </Surface>

        <Button label="Ieși din cont" variant="secondary" onPress={signOut} disabled={busy} />

        {deletion.confirming ? (
          <DeleteAccountConfirm deletion={deletion} />
        ) : (
          <Button label="Șterge contul" variant="secondary" tone="danger" onPress={deletion.ask} disabled={busy} />
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

        <AppText
          role="small"
          color="primaryStrong"
          accessibilityRole="link"
          onPress={() => router.push('/termeni')}
          style={styles.link}
        >
          Termeni de utilizare
        </AppText>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4] },
  field: { gap: space[2] },
  group: { padding: 0, overflow: 'hidden' },
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start' },
});
