import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, goBackOrHome } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import EmailLink from '../components/EmailLink';
import { t } from '../texts/store';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText role="section" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Item({ children }: { children: string }) {
  return (
    <View style={styles.item}>
      <AppText role="body" color="textMuted">
        •
      </AppText>
      <AppText role="body" style={styles.itemText}>
        {children}
      </AppText>
    </View>
  );
}

/**
 * Public explanation of account deletion (reachable signed out, as Google Play requires). The primary action
 * depends on the session: signed out → sign in; signed in → the profile, where the account is deleted.
 */
export default function DeleteAccountInfoScreen() {
  const { status } = useAuth();
  const signedOut = status === 'signedOut';
  const ready = status === 'ready';

  return (
    <ScreenLayout
      title={t('pages.deleteAccount.title')}
      onBack={goBackOrHome}
      actions={
        signedOut ? (
          <Button label={t('pages.deleteAccount.signIn')} flex onPress={() => router.push('/')} />
        ) : ready ? (
          <Button label={t('pages.deleteAccount.goToProfile')} flex onPress={() => router.push('/profile')} />
        ) : (
          <Button label={t('common.continue')} flex onPress={() => router.push('/')} />
        )
      }
    >
      <View style={styles.stack}>
        <AppText role="lead" color="textMuted">
          {t('pages.deleteAccount.lead')}
        </AppText>

        <Section title={t('pages.deleteAccount.removed.title')}>
          <Item>{t('pages.deleteAccount.removed.name')}</Item>
          <Item>{t('pages.deleteAccount.removed.login')}</Item>
          <Item>{t('pages.deleteAccount.removed.progress')}</Item>
          <Item>{t('pages.deleteAccount.removed.credits')}</Item>
          <Item>{t('pages.deleteAccount.removed.history')}</Item>
          <Item>{t('pages.deleteAccount.removed.inviteCode')}</Item>
        </Section>

        <Section title={t('pages.deleteAccount.kept.title')}>
          <AppText role="body">{t('pages.deleteAccount.kept.content')}</AppText>
          <AppText role="body">{t('pages.deleteAccount.kept.fingerprint')}</AppText>
          <AppText role="body">{t('pages.deleteAccount.kept.referral')}</AppText>
        </Section>

        <Section title={t('pages.deleteAccount.how.title')}>
          <AppText role="body">
            {signedOut
              ? t('pages.deleteAccount.how.signedOut')
              : ready
                ? t('pages.deleteAccount.how.ready')
                : t('pages.deleteAccount.how.needsName')}
          </AppText>
          <AppText role="body">
            {t('pages.deleteAccount.contact.prefix')} <EmailLink />
            {t('pages.deleteAccount.contact.suffix')}
          </AppText>
        </Section>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[5] },
  section: { gap: space[2] },
  item: { flexDirection: 'row', gap: space[2] },
  itemText: { flex: 1 },
});
