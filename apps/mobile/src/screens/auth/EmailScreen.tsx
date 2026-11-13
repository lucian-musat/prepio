import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, Button, ScreenLayout, TextField, goBackOrHome } from '../../ui';
import { EMAIL_AUTH_ERROR, sendEmailCode } from '../../lib/emailAuth';
import { setPendingEmail } from '../../lib/pendingEmail';
import { t } from '../../texts/store';

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
    <ScreenLayout logo onBack={goBackOrHome} actions={<Button flex label={t('auth.email.submit')} onPress={submit} loading={sending} />}>
      <View style={styles.stack}>
        <AppText role="title" accessibilityRole="header">
          {t('auth.email.title')}
        </AppText>
        <AppText color="textMuted">{t('auth.email.body')}</AppText>
        <TextField
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
          }}
          accessibilityLabel={t('auth.email.fieldLabel')}
          placeholder={t('auth.email.placeholder')}
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
