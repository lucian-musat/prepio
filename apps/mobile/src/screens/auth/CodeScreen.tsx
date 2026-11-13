import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, TextField, goBackOrHome } from '../../ui';
import { EMAIL_AUTH_ERROR, RESEND_COOLDOWN_SECONDS, sendEmailCode, verifyEmailCode } from '../../lib/emailAuth';
import { getPendingEmail, setPendingEmail } from '../../lib/pendingEmail';
import { t } from '../../texts/store';

const CODE_LENGTH = 6;

/** Enters the emailed code. Signing in changes the auth status, which moves the student on; nothing navigates here. */
export default function CodeScreen() {
  // The address comes from the email screen, never from the URL (see pendingEmail).
  const [email] = useState(getPendingEmail);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const cooling = cooldown > 0;
  useEffect(() => {
    if (!cooling) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooling]);

  const verify = async (value: string) => {
    if (verifying) return;
    if (value.length !== CODE_LENGTH) {
      setError(t('auth.code.tooShort', { n: CODE_LENGTH }));
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await verifyEmailCode(email, value);
      setPendingEmail(''); // signed in: a later visit to /code must not offer this address again
    } catch (e) {
      setError(e instanceof Error ? e.message : EMAIL_AUTH_ERROR.wrongCode);
    } finally {
      setVerifying(false);
    }
  };

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === CODE_LENGTH) void verify(digits);
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      await sendEmailCode(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : EMAIL_AUTH_ERROR.network);
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    // Opened directly or in another tab: we don't know where the code went.
    return (
      <ScreenLayout logo onBack={goBackOrHome} actions={<Button flex label={t('auth.code.missingAction')} onPress={() => router.replace('/email')} />}>
        <View style={styles.stack}>
          <AppText role="title" accessibilityRole="header">
            {t('auth.code.title')}
          </AppText>
          <AppText color="textMuted">{t('auth.code.missingBody')}</AppText>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout logo onBack={goBackOrHome} actions={<Button flex label={t('common.continue')} onPress={() => verify(code)} loading={verifying} />}>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header">
          {t('auth.code.title')}
        </AppText>
        <AppText color="textMuted">{t('auth.code.body', { email })}</AppText>
        <TextField
          code
          value={code}
          onChangeText={onChange}
          accessibilityLabel={t('auth.code.fieldLabel')}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={CODE_LENGTH}
          autoFocus
          onSubmitEditing={() => verify(code)}
          invalid={!!error}
        />
        {error ? (
          <AppText role="small" color="danger" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <View style={styles.links}>
          <Button
            variant="secondary"
            label={cooldown > 0 ? t('auth.code.resendIn', { n: cooldown }) : t('auth.code.resend')}
            onPress={resend}
            disabled={cooldown > 0}
            loading={resending}
          />
          <Button variant="secondary" label={t('auth.code.changeEmail')} onPress={() => (router.canGoBack() ? router.back() : goBackOrHome())} />
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
  links: { gap: space[4], marginTop: space[2] },
});
