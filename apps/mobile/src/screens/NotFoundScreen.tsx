import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout } from '../ui';
import { t } from '../texts/store';

/** Unknown route (Expo Router `+not-found`). Public: needs no session. */
export default function NotFoundScreen() {
  return (
    <ScreenLayout logo pageTitle={t('errors.notFound.title')}>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header" style={styles.centre}>
          {t('errors.notFound.title')}
        </AppText>
        <AppText role="body" color="textMuted" style={styles.centre}>
          {t('errors.notFound.body')}
        </AppText>
        <Button label={t('common.goHome')} onPress={() => router.replace('/')} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[4], paddingTop: space[6] },
  centre: { textAlign: 'center' },
});
