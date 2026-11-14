import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bucharestDay, color, radius, space, weekDays, type TextKey } from '@prepio/shared';
import { SPLIT_MIN_WIDTH } from '../components/marker/SourcePanel';
import { dayCount } from '../lib/counts';
import { t } from '../texts/store';
import { AppText, Button, TextButton } from '../ui';
import { useReminders, useStreak } from './StreakProvider';

const DIALOG_MAX = 560;
const BACKDROP = 'rgba(15,46,40,0.45)'; // the same backdrop as BuyCreditsSheet
/** Monday to Sunday: the initial under each dot and the name the screen reader says. */
const DAY_LETTERS: TextKey[] = [
  'streak.weekdayLetter.mon',
  'streak.weekdayLetter.tue',
  'streak.weekdayLetter.wed',
  'streak.weekdayLetter.thu',
  'streak.weekdayLetter.fri',
  'streak.weekdayLetter.sat',
  'streak.weekdayLetter.sun',
];
const DAY_NAMES: TextKey[] = [
  'streak.weekday.mon',
  'streak.weekday.tue',
  'streak.weekday.wed',
  'streak.weekday.thu',
  'streak.weekday.fri',
  'streak.weekday.sat',
  'streak.weekday.sun',
];
const dayLetter = (i: number) => t(DAY_LETTERS[i]!);
const dayName = (i: number) => t(DAY_NAMES[i]!);
const DOT = 36;

/** „Vineri, azi”, „Vineri, azi, ai lucrat”, „Luni, ai lucrat”, or just the name. */
const dayLabel = (name: string, isToday: boolean, worked: boolean) =>
  [name, isToday ? t('streak.sheet.today') : null, worked ? t('streak.sheet.worked') : null].filter(Boolean).join(', ');

type Props = {
  visible: boolean;
  onClose: () => void;
  /** „Rezolvă un exercițiu” (only before working today): the sheet closes, then this runs. */
  onSolve?: () => void;
};

/**
 * The streak details: „🔥 5 zile la rând”, the record, the current week (worked days filled, today dashed until
 * worked), and before working today a hint plus „Rezolvă un exercițiu”. A bottom sheet on the phone, centred from 900 px.
 */
export default function StreakSheet({ visible, onClose, onSolve }: Props) {
  const { summary } = useStreak();
  const reminders = useReminders();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dialog = width >= SPLIT_MIN_WIDTH;
  if (!summary) return null;

  // The summary may be from a previous Bucharest day (app left open past midnight): judge it against today.
  const today = bucharestDay(new Date());
  const worked = new Set(summary.week);
  const doneToday = summary.todayDone && worked.has(today);
  const days = weekDays(today);

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, dialog && styles.rootDialog]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.closeWindow')} onPress={onClose} style={StyleSheet.absoluteFill} />
        {visible ? (
          <View
            testID="streak-sheet"
            accessibilityViewIsModal
            style={[styles.sheet, dialog ? styles.dialog : { paddingBottom: insets.bottom + space[4] }]}
          >
            {dialog ? null : <View style={styles.grab} />}
            <View style={styles.body}>
              <View style={styles.head}>
                <AppText role="question" accessibilityRole="header">
                  {t('streak.sheet.title', { zile: dayCount(summary.current) })}
                </AppText>
                <AppText role="body" color="textMuted">
                  {t('streak.sheet.record', { zile: dayCount(summary.record) })}
                </AppText>
              </View>
              <View style={styles.week}>
                {days.map((d, i) => {
                  const isWorked = worked.has(d);
                  const isToday = d === today;
                  return (
                    <View key={d} accessible accessibilityLabel={dayLabel(dayName(i), isToday, isWorked)} style={styles.dayCol}>
                      <View
                        testID={`streak-day-${d}`}
                        style={[
                          styles.dot,
                          isWorked ? { backgroundColor: color.accent } : isToday ? styles.dotToday : { backgroundColor: color.surfaceMuted },
                        ]}
                      >
                        {isWorked ? (
                          <AppText role="label" style={{ color: color.onAccent }}>
                            ✓
                          </AppText>
                        ) : null}
                      </View>
                      <AppText role="caption" color="textMuted">
                        {dayLetter(i)}
                      </AppText>
                    </View>
                  );
                })}
              </View>
              {doneToday ? null : (
                <AppText role="body" color="textMuted" style={styles.hint}>
                  {t('streak.sheet.hint')}
                </AppText>
              )}
              {!doneToday && onSolve ? (
                <Button
                  label={t('streak.sheet.solve')}
                  onPress={() => {
                    onClose();
                    onSolve();
                  }}
                />
              ) : null}
              {Platform.OS !== 'web' && reminders.status !== 'unsupported' ? (
                <TextButton
                  label={t('streak.sheet.settings')}
                  onPress={() => {
                    onClose();
                    router.push('/profile');
                  }}
                />
              ) : null}
            </View>
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
  body: { padding: space[4.5], paddingTop: space[2], gap: space[3] },
  head: { alignItems: 'center', gap: space[1] },
  week: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[1] },
  dayCol: { alignItems: 'center', gap: space[1] },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  dotToday: { borderWidth: 2, borderStyle: 'dashed', borderColor: color.primary },
  hint: { textAlign: 'center' },
});
