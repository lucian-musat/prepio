import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, TextField, goBackOrHome } from '../../ui';
import { EMAIL_AUTH_ERROR, RESEND_COOLDOWN_SECONDS, sendEmailCode, verifyEmailCode } from '../../lib/emailAuth';
import { getPendingEmail } from '../../lib/pendingEmail';

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
      setError(`Scrie codul de ${CODE_LENGTH} cifre.`);
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await verifyEmailCode(email, value);
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
      <ScreenLayout logo onBack={goBackOrHome} actions={<Button flex label="Scrie adresa de email" onPress={() => router.replace('/email')} />}>
        <View style={styles.stack}>
          <AppText role="title" accessibilityRole="header">
            Verifică-ți emailul
          </AppText>
          <AppText color="textMuted">Nu mai știm la ce adresă ți-am trimis codul. Scrie-o din nou și îți trimitem altul.</AppText>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout logo onBack={goBackOrHome} actions={<Button flex label="Continuă" onPress={() => verify(code)} loading={verifying} />}>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header">
          Verifică-ți emailul
        </AppText>
        <AppText color="textMuted">{`Ți-am trimis un cod de 6 cifre la ${email}.`}</AppText>
        <TextField
          code
          value={code}
          onChangeText={onChange}
          accessibilityLabel="Codul din email"
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
            label={cooldown > 0 ? `Retrimite în ${cooldown} s` : 'Retrimite codul'}
            onPress={resend}
            disabled={cooldown > 0}
            loading={resending}
          />
          <Button variant="secondary" label="Schimbă adresa" onPress={() => (router.canGoBack() ? router.back() : goBackOrHome())} />
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
  links: { gap: space[4], marginTop: space[2] },
});
