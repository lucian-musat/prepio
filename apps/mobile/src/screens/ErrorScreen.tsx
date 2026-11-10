import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout } from '../ui';

/**
 * Root error boundary screen. It renders above AuthProvider, so it must not use auth hooks, and the error
 * text is never shown to the student.
 */
export default function ErrorScreen({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <ScreenLayout logo>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header" style={styles.centre}>
          Ceva n-a mers bine
        </AppText>
        <AppText role="body" color="textMuted" style={styles.centre}>
          A apărut o eroare neașteptată. Am fost anunțați.
        </AppText>
        <Button label="Încearcă din nou" onPress={() => void retry()} />
        <Button label="Mergi la început" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4], paddingTop: space[6] },
  centre: { textAlign: 'center' },
});
