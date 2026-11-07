import { StyleSheet, View } from 'react-native';
import { border, color, radius, space } from '@prepio/shared';
import { AppText, Button, Icon, ScreenLayout, Surface, TextButton } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { CONTACT_EMAIL } from '../lib/legal';
import { fontFamily } from '../theme/fonts';
import { DeleteAccountConfirm, useAccountDeletion } from '../components/AccountDeletion';

const LOCK_TILE = space[8] * 2; // 64 px
const LOCK_GLYPH = space[8];

/**
 * The only screen of a suspended account (root guard `suspended`): why, whom to write to, and the two ways out —
 * sign out, or delete the account (same confirmation as the profile).
 */
export default function SuspendedScreen() {
  const { profile, signOut } = useAuth();
  const deletion = useAccountDeletion();

  return (
    <ScreenLayout logo>
      <View style={styles.stack}>
        <View style={styles.lock} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icon name="lock" size={LOCK_GLYPH} tint={color.danger} />
        </View>
        <AppText role="title" accessibilityRole="header" style={styles.centre}>
          Contul tău a fost suspendat
        </AppText>
        <Surface style={styles.reason}>
          <AppText role="body">
            <AppText role="body" style={styles.strong}>
              Motiv:
            </AppText> {profile?.suspendedReason ?? ''}
          </AppText>
        </Surface>
        <AppText role="small" color="textMuted" style={styles.centre}>
          {`Dacă crezi că e o greșeală, scrie-ne la ${CONTACT_EMAIL}.`}
        </AppText>
        <Button label="Ieși din cont" variant="secondary" onPress={signOut} disabled={deletion.deleting} />
        {deletion.confirming ? (
          <DeleteAccountConfirm deletion={deletion} />
        ) : (
          <TextButton label="Șterge contul" tone="danger" onPress={deletion.ask} />
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4], paddingTop: space[6] },
  lock: {
    alignSelf: 'center',
    width: LOCK_TILE,
    height: LOCK_TILE,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: { textAlign: 'center' },
  reason: { gap: space[1] },
  // Bold inline in the body line (a different role would change the nested line height).
  strong: { fontFamily: fontFamily.bodyBold },
});
