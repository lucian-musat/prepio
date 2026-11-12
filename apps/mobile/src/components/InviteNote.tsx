import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { color, radius, space } from '@prepio/shared';
import { AppText } from '../ui';

export const INVITE_NOTE_KEY = 'prepio.inviteNoteSeen';

type Props = { finishedCount: number; enabled: boolean };

/**
 * Shown on Home once, after the first finished lesson: a nudge to invite a colleague. Dismissing or opening it is
 * remembered on this device. Unreadable storage keeps it hidden (better silent than shown on every visit).
 */
export default function InviteNote({ finishedCount, enabled }: Props) {
  const [seen, setSeen] = useState<boolean | null>(null); // null: not read yet

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(INVITE_NOTE_KEY).then(
      (v) => live && setSeen(v === '1'),
      () => live && setSeen(true),
    );
    return () => {
      live = false;
    };
  }, []);

  if (!enabled || finishedCount < 1 || seen !== false) return null;

  const markSeen = () => {
    setSeen(true);
    AsyncStorage.setItem(INVITE_NOTE_KEY, '1').catch(() => {}); // not remembered; hidden for this visit anyway
  };

  return (
    <View style={styles.note}>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          markSeen();
          router.push('/invita');
        }}
        style={styles.text}
      >
        <AppText role="small" color="primaryStrong">
          Ai terminat prima lecție. Invită un coleg
        </AppText>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Închide" onPress={markSeen} hitSlop={8} style={styles.close}>
        <AppText role="small" color="textMuted">
          Închide
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: color.primarySubtle,
    borderRadius: radius.lg,
    paddingVertical: space[2.5],
    paddingHorizontal: space[3],
    marginBottom: space[4],
  },
  text: { flex: 1, minHeight: 32, justifyContent: 'center' },
  close: { minHeight: 32, justifyContent: 'center' },
});
