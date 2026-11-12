import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, TextField, goBackOrHome } from '../../ui';
import { EMAIL_AUTH_ERROR, sendEmailCode } from '../../lib/emailAuth';
import { setPendingEmail } from '../../lib/pendingEmail';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Asks for the student's email and sends them a sign-in code. */
export default function EmailScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (sending) return;
    const value = email.trim();
    if (!EMAIL_SHAPE.test(value)) {
      setError(EMAIL_AUTH_ERROR.invalidEmail);
      return;
    }
    setError(null);
    setSending(true);
    try {
      await sendEmailCode(value);
      setPendingEmail(value);
      router.push('/code');
    } catch (e) {
      setError(e instanceof Error ? e.message : EMAIL_AUTH_ERROR.network);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenLayout logo onBack={goBackOrHome} actions={<Button flex label="Trimite codul" onPress={submit} loading={sending} />}>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header">
          Care e adresa ta de email?
        </AppText>
        <AppText color="textMuted">Îți trimitem un cod de 6 cifre cu care intri în cont. Nu ai nevoie de parolă.</AppText>
        <TextField
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          accessibilityLabel="Adresa de email"
          placeholder="nume@exemplu.ro"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={submit}
          invalid={!!error}
        />
        {error ? (
          <AppText role="small" color="danger" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({ stack: { gap: space[3] } });
