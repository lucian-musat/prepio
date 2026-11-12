import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout } from '../ui';

/** Unknown route (Expo Router `+not-found`). Public: needs no session. */
export default function NotFoundScreen() {
  return (
    <ScreenLayout logo pageTitle="Pagina nu există">
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header" style={styles.centre}>
          Pagina nu există
        </AppText>
        <AppText role="body" color="textMuted" style={styles.centre}>
          Linkul pe care l-ai urmat nu mai e valabil.
        </AppText>
        <Button label="Mergi la început" onPress={() => router.replace('/')} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4], paddingTop: space[6] },
  centre: { textAlign: 'center' },
});
