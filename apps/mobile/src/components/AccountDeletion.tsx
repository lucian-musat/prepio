import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { space } from '@prepio/shared';
import { AppText, Button, Surface } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { deleteAccount, offlineText } from '../lib/api';
import { t } from '../texts/store';

// Plain Errors carry our catalog messages; anything else (PostgREST/network objects) gets the server-error one.
const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : t('errors.api.accountDelete.serverError'));

export type AccountDeletion = {
  confirming: boolean;
  deleting: boolean;
  error: string | null;
  /** Shows the confirmation (the screen's own „Șterge contul” button calls it). */
  ask(): void;
  cancel(): void;
  confirm(): Promise<void>;
};

/**
 * Account deletion with an in-app confirmation (required by Google Play): deletes through the API, then signs
 * out, which sends the student back to the welcome screen. Shared by the profile and the suspended screen.
 */
export function useAccountDeletion(): AccountDeletion {
  const { session, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (deleting) return;
    if (!session) {
      setError(offlineText());
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // The status change navigates back to the welcome screen; the screen unmounts, so no state reset.
      await signOut();
    } catch (e) {
      setError(messageOf(e));
      setDeleting(false);
    }
  };

  return {
    confirming,
    deleting,
    error,
    ask: () => setConfirming(true),
    cancel: () => {
      setConfirming(false);
      setError(null);
    },
    confirm,
  };
}

/** The confirmation card shown while `deletion.confirming`. */
export function DeleteAccountConfirm({ deletion }: { deletion: AccountDeletion }) {
  return (
    <Surface style={styles.confirm}>
      <AppText accessibilityRole="alert">
        {t('profile.delete.confirm')}
      </AppText>
      {deletion.error ? (
        <AppText role="small" color="danger" accessibilityRole="alert">
          {deletion.error}
        </AppText>
      ) : null}
      <Button label={t('profile.delete.yes')} tone="danger" onPress={deletion.confirm} loading={deletion.deleting} />
      <Button label={t('profile.delete.cancel')} variant="secondary" onPress={deletion.cancel} disabled={deletion.deleting} />
    </Surface>
  );
}

const styles = StyleSheet.create({ confirm: { gap: space[3] } });
