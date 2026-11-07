import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { space } from '@prepio/shared';
import { AppText, Button, Surface } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { deleteAccount, OFFLINE } from '../lib/api';

const DELETE_FAILED = 'Contul nu a putut fi șters. Încearcă din nou.';

// Plain Errors carry our Romanian messages; anything else (PostgREST/network objects) gets the generic one.
const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : DELETE_FAILED);

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
      setError(OFFLINE);
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
        Ștergi contul definitiv? Numele, emailul și tot ce ține de cont se șterg și nu mai pot fi recuperate.
      </AppText>
      {deletion.error ? (
        <AppText role="small" color="danger" accessibilityRole="alert">
          {deletion.error}
        </AppText>
      ) : null}
      <Button label="Da, șterge contul" tone="danger" onPress={deletion.confirm} loading={deletion.deleting} />
      <Button label="Renunță" variant="secondary" onPress={deletion.cancel} disabled={deletion.deleting} />
    </Surface>
  );
}

const styles = StyleSheet.create({ confirm: { gap: space[3] } });
