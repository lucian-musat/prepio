import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { color, hasFullAccess, space } from '@prepio/shared';
import { Spinner } from '../ui';
import { useAccess } from './AccessProvider';

/**
 * Wraps the `/bac/<id>` routes: without full access (a deep link, an old tab) the route is replaced by the list,
 * which shows its locks and opens the paywall on a tap. Decided once on entry, like LessonAccessGuard.
 */
export default function BacAccessGuard({ children }: { children: ReactNode }) {
  const { status, isAdmin, ready } = useAccess();
  const full = isAdmin || hasFullAccess(status);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (allowed || !ready) return;
    if (full) setAllowed(true);
    else router.replace('/bac?paywall=1');
  }, [allowed, ready, full]);

  if (allowed) return <>{children}</>;
  return (
    <View style={styles.wait}>
      <Spinner />
    </View>
  );
}

const styles = StyleSheet.create({
  wait: { flex: 1, alignItems: 'center', paddingTop: space[12], backgroundColor: color.bg },
});
