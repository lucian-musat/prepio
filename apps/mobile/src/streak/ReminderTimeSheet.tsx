import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type ReminderTime } from '@prepio/shared';
import { SPLIT_MIN_WIDTH } from '../components/marker/SourcePanel';
import { AppText } from '../ui';

const DIALOG_MAX = 560;
const BACKDROP = 'rgba(15,46,40,0.45)'; // the same backdrop as BuyCreditsSheet



const pad = (n: number) => String(n).padStart(2, '0');
export const formatTime = (t: ReminderTime) => `${pad(t.hour)}:${pad(t.minute)}`;

/** 15:00 to 22:30, every 30 minutes. */
export const REMINDER_TIMES: ReminderTime[] = Array.from({ length: 16 }, (_, i) => ({ hour: 15 + Math.floor(i / 2), minute: (i % 2) * 30 }));

type Props = {
  visible: boolean;
  current: ReminderTime;
  onSelect: (t: ReminderTime) => void;
  onClose: () => void;
};

/** „Ora mementoului”: the list of times; choosing one saves it and closes. A bottom sheet on the phone, centred from 900 px. */
export default function ReminderTimeSheet({ visible, current, onSelect, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dialog = width >= SPLIT_MIN_WIDTH;

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, dialog && styles.rootDialog]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide fereastra" onPress={onClose} style={StyleSheet.absoluteFill} />
        {visible ? (
          <View
            testID="reminder-time-sheet"
            accessibilityViewIsModal
            style={[styles.sheet, dialog ? styles.dialog : { paddingBottom: insets.bottom + space[4] }]}
          >
            {dialog ? null : <View style={styles.grab} />}
            <View style={styles.head}>
              <AppText role="question" accessibilityRole="header">
                Ora mementoului
              </AppText>
            </View>
            <ScrollView>
              {REMINDER_TIMES.map((t) => {
                const label = formatTime(t);
                const selected = t.hour === current.hour && t.minute === current.minute;
                return (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onSelect(t);
                      onClose();
                    }}
                    style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
                  >
                    <AppText role="bodyStrong" color={selected ? 'primaryStrong' : 'text'}>
                      {label}
                    </AppText>
                    {selected ? (
                      <AppText role="bodyStrong" color="primaryStrong">
                        ✓
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: BACKDROP },
  rootDialog: { justifyContent: 'center', alignItems: 'center', padding: space[6] },
  sheet: { maxHeight: '86%', backgroundColor: color.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  dialog: { width: '100%', maxWidth: DIALOG_MAX, borderRadius: radius.xl, paddingBottom: space[2] },
  grab: { width: 42, height: 5, borderRadius: 9, backgroundColor: color.border, alignSelf: 'center', marginTop: space[2], marginBottom: space[1] },
  head: { alignItems: 'center', padding: space[3] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, paddingHorizontal: space[4.5] },
  rowSelected: { backgroundColor: color.primarySubtle },
  pressed: { backgroundColor: color.surfaceMuted },
});
