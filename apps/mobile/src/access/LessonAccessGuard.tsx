import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { color, space } from '@prepio/shared';
import { Spinner } from '../ui';
import { useAccess } from './AccessProvider';

/**
 * Wraps the `/lesson/<id>` and `/lesson/<id>/consolidare` routes: a lesson outside the plan (a deep link, an old
 * tab) replaces the route with Home and its paywall sheet (`/?paywall=<id>`) instead of an empty screen.
 * The decision is taken once per lesson, on entry: access ending while the student is inside does not throw them
 * out (their typed answer stays; the server answers 403 / 42501 and the screen shows the sheet).
 */
export default function LessonAccessGuard({ children }: { children: ReactNode }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canOpen, ready } = useAccess();
  const [allowed, setAllowed] = useState<string | null>(null);
  const decided = allowed === id;

  useEffect(() => {
    if (decided || !ready || !id) return;
    if (canOpen(id)) setAllowed(id);
    else router.replace(`/?paywall=${encodeURIComponent(id)}`);
  }, [decided, ready, id, canOpen]);

  if (decided || !id) return <>{children}</>;
  return (
    <View style={styles.wait}>
      <Spinner />
    </View>
  );
}

const styles = StyleSheet.create({
  wait: { flex: 1, alignItems: 'center', paddingTop: space[12], backgroundColor: color.bg },
});
