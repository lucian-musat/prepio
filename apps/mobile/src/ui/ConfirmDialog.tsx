import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { color, layout, space } from '@prepio/shared';
import AppText from './AppText';
import Button from './Button';
import Surface from './Surface';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// The theme's text colour at 50 % over the screen.
const SCRIM = `${color.text}80`;

/**
 * Centred in-app confirmation (works the same on web and native, unlike Alert). Tapping outside the card or
 * the Android back button cancels.
 */
export default function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel = 'Anulează', onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Închide" style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Surface style={styles.card}>
          <AppText role="section" accessibilityRole="header">
            {title}
          </AppText>
          <AppText role="small" color="textMuted">
            {message}
          </AppText>
          <View style={styles.buttons}>
            <Button label={confirmLabel} onPress={onConfirm} />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: layout.gutter, backgroundColor: SCRIM },
  card: { width: '100%', maxWidth: 420, gap: space[3] },
  buttons: { gap: space[2.5], marginTop: space[2] },
});
