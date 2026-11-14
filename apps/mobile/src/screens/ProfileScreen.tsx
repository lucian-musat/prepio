import { useState } from 'react';
import { Linking, Platform, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { color, formatAccessDate, space } from '@prepio/shared';
import { AppText, Button, Chip, ScreenLayout, SettingsRow, Surface, TextField, goBackOrHome } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { offlineText } from '../lib/api';
import { DeleteAccountConfirm, useAccountDeletion } from '../components/AccountDeletion';
import { MAX_DISPLAY_NAME_CHARS, updateDisplayName, updateLearningMode, validateDisplayName } from '../lib/profile';
import { modeOf, type LearningMode } from '../lib/learningMode';
import LearningModePicker from '../components/LearningModePicker';
import { ownMessage } from '../lib/errorMessage';
import { useCredits } from '../credits/CreditsProvider';
import { useAccess } from '../access/AccessProvider';
import { useReminders } from '../streak/StreakProvider';
import ReminderTimeSheet, { formatTime } from '../streak/ReminderTimeSheet';
import { progressBadge, useReferralSummary } from '../referrals/useReferralSummary';
import { t } from '../texts/store';

// Plain Errors carry our Romanian messages; anything else (PostgREST/network objects) gets the generic one.
const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** The signed-in student's profile: rename, sign out, delete the account (in-app confirm, required by Google Play). */
export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const { balance } = useCredits();
  const { status } = useAccess();
  const referral = useReferralSummary();
  const badge = referral ? progressBadge(referral) : null;
  const planLabel =
    status.plan === 'trial'
      ? t('access.trial.title')
      : status.plan === 'expired'
        ? t('profile.plan.expired')
        : t('access.full.until', { data: formatAccessDate(status.until) });
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
  const reminders = useReminders();
  const [timeOpen, setTimeOpen] = useState(false);
  const showReminders = Platform.OS !== 'web' && reminders.status !== 'unsupported';
  const reminderDenied = reminders.status === 'denied';
  const reminderBlocked = reminderDenied && !reminders.canAskAgain;
  const switchOn = reminders.settings.enabled && !reminderDenied;
  const busy = saving || deleting;
  const unchanged = name.trim() === (profile?.displayName ?? '').trim();
  const email = session?.user.email;
  const provider = (session?.user as { app_metadata?: { provider?: string } } | undefined)?.app_metadata?.provider;
  const account = email
    ? t('profile.account.line', { email, metoda: provider === 'google' ? t('profile.account.google') : t('profile.account.emailCode') })
    : null;

  // Saves right away (no button); on failure the picker goes back to the stored mode.
  const changeMode = async (next: LearningMode) => {
    if (busy || modeSaving || next === mode) return;
    const previous = mode;
    setModeSaved(null);
    const userId = session?.user.id;
    if (!userId) {
      setModeError(offlineText());
      return;
    }
    setModeError(null);
    setMode(next);
    setModeSaving(true);
    try {
      await updateLearningMode(userId, next);
      // The refresh never throws; the picker keeps the saved mode either way (the database has it).
      const fresh = await refreshProfile();
      // Saved in the database, but the app may still hold the old profile (the refresh failed).
      setModeSaved(fresh?.learningMode === next ? t('profile.mode.saved') : t('profile.mode.savedStale'));
    } catch (e) {
      setMode(previous);
      setModeError(ownMessage(e, t('onboarding.mode.saveFailed')));
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
      setNameError(offlineText());
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      await updateDisplayName(userId, valid.value);
      await refreshProfile();
      setSaved(true);
    } catch (e) {
      setNameError(messageOf(e, t('onboarding.name.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout title={t('profile.title')} onBack={goBackOrHome}>
      <View style={styles.stack}>
        <View style={styles.field}>
          <AppText role="small" color="textMuted">
            {t('profile.name.label')}
          </AppText>
          <TextField
            value={name}
            onChangeText={(value) => {
              setName(value);
              setNameError(null);
              setSaved(false);
            }}
            accessibilityLabel={t('profile.name.label')}
            placeholder={t('onboarding.name.placeholder')}
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
          {saved ? <AppText role="small" color="success">{t('profile.name.saved')}</AppText> : null}
          <AppText role="caption" color="textMuted">{t('onboarding.name.limit', { max: MAX_DISPLAY_NAME_CHARS })}</AppText>
          {account ? (
            <AppText role="caption" color="textMuted">
              {account}
            </AppText>
          ) : null}
        </View>
        <Button label={t('profile.save')} onPress={save} loading={saving} disabled={deleting || unchanged} />

        <View style={styles.field}>
          <AppText role="small" color="textMuted">
            {t('profile.mode.label')}
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
          <SettingsRow label={t('access.screen.title')} value={planLabel} onPress={() => router.push('/abonament')} disabled={busy} />
          <SettingsRow label={t('credits.screen.title')} value={String(balance ?? 0)} onPress={() => router.push('/credits')} disabled={busy} divider />
          {referral ? (
            <SettingsRow
              label={t('invite.screen.title')}
              accessibilityLabel={badge ? t('profile.inviteWithProgress', { progres: badge }) : t('invite.screen.title')}
              badge={badge ? <Chip label={badge} fg={color.primaryStrong} bg={color.primarySubtle} size="badge" /> : null}
              onPress={() => router.push('/invita')}
              disabled={busy}
              divider
            />
          ) : null}
        </Surface>

        {showReminders ? (
          <View style={styles.field}>
            <AppText role="caption" color="textMuted" style={styles.eyebrow}>
              {t('profile.reminder.title')}
            </AppText>
            <Surface radius="lg" style={styles.group}>
              <View style={styles.switchRow}>
                <AppText role="bodyStrong" style={styles.switchLabel}>
                  {t('profile.reminder.switch')}
                </AppText>
                <Switch
                  accessible
                  accessibilityRole="switch"
                  accessibilityLabel={t('profile.reminder.switch')}
                  value={switchOn}
                  accessibilityState={{ checked: switchOn, disabled: busy }}
                  onValueChange={(on) => void reminders.setEnabled(on)}
                  trackColor={{ true: color.primary }}
                  disabled={busy}
                />
              </View>
              <SettingsRow label={t('profile.reminder.time')} value={formatTime(reminders.settings.time)} onPress={() => setTimeOpen(true)} disabled={busy} divider />
            </Surface>
            {reminderBlocked ? (
              <>
                <AppText role="small" color="textMuted">
                  {t('profile.reminder.blocked')}
                </AppText>
                <AppText role="small" color="primaryStrong" accessibilityRole="link" onPress={() => void Linking.openSettings()} style={styles.link}>
                  {t('profile.reminder.openSettings')}
                </AppText>
              </>
            ) : null}
            <AppText role="caption" color="textMuted">
              {t('profile.reminder.note')}
            </AppText>
            <ReminderTimeSheet
              visible={timeOpen}
              current={reminders.settings.time}
              onSelect={(time) => void reminders.setTime(time)}
              onClose={() => setTimeOpen(false)}
            />
          </View>
        ) : null}

        <Button label={t('auth.signOut')} variant="secondary" onPress={signOut} disabled={busy} />

        {deletion.confirming ? (
          <DeleteAccountConfirm deletion={deletion} />
        ) : (
          <Button label={t('profile.deleteAccount')} variant="secondary" tone="danger" onPress={deletion.ask} disabled={busy} />
        )}

        <AppText
          role="small"
          color="primaryStrong"
          accessibilityRole="link"
          onPress={() => router.push('/confidentialitate')}
          style={styles.link}
        >
          {t('profile.privacyLink')}
        </AppText>

        <AppText
          role="small"
          color="primaryStrong"
          accessibilityRole="link"
          onPress={() => router.push('/termeni')}
          style={styles.link}
        >
          {t('profile.termsLink')}
        </AppText>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4] },
  field: { gap: space[2] },
  group: { padding: 0, overflow: 'hidden' },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingVertical: space[2.5], paddingHorizontal: space[4] },
  switchLabel: { flex: 1 },
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start' },
});
