import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { space } from '@prepio/shared';
import { AppText, TextField } from '../ui';
import {
  clearPendingCode,
  fetchReferralPublicSettings,
  getPendingCode,
  lookupReferralCode,
  normalizeCode,
  storePendingCode,
} from '../lib/referrals';
import { t } from '../texts/store';

/** Typing pauses this long start the check (the keyboard's submit checks at once). */
const DEBOUNCE_MS = 700;

type Props = { onChange: (code: string | null) => void; disabled?: boolean };
type Verdict = { kind: 'valid'; name: string | null } | { kind: 'invalid' } | { kind: 'unreachable' } | null;

/**
 * "Ai un cod de invitație?" on Welcome: shown only while the referral programme is on. A code that came with the
 * invite link and is valid shows who invited the student; otherwise the link expands to a text field. The typed
 * code is reported through `onChange` at once and again after each check (null once found invalid; kept when the
 * check could not run); a valid one is also stored on this device (it survives the Google redirect). It never blocks signing in.
 */
export default function ReferralCodeField({ onChange, disabled = false }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [fromLink, setFromLink] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** Bumped by every edit and check: a lookup that comes back for an older value is dropped. */
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** False once the field is gone: a check that comes back later changes nothing. */
  const mounted = useRef(true);

  // Programme on/off, and a code already pending (the invite link).
  useEffect(() => {
    let live = true;
    mounted.current = true;
    void (async () => {
      let on = false;
      try {
        on = (await fetchReferralPublicSettings()).enabled;
      } catch {
        // Unreadable: the field stays hidden.
      }
      if (!live || !on) return;
      setEnabled(true);
      const pending = await getPendingCode();
      if (!live || !pending) return;
      const mine = ++seq.current;
      try {
        const res = await lookupReferralCode(pending);
        if (!live || mine !== seq.current) return;
        if (res.valid) {
          setFromLink(true);
          setVerdict({ kind: 'valid', name: res.inviterFirstName });
          onChangeRef.current(pending);
          return;
        }
      } catch {
        // Could not check: keep the code for the sign-in (the server decides); the field stays collapsed.
        if (live && mine === seq.current) onChangeRef.current(pending);
        return;
      }
      await clearPendingCode();
    })();
    return () => {
      live = false;
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const check = useCallback(async (raw: string) => {
    clearTimeout(timer.current);
    const code = normalizeCode(raw);
    const mine = ++seq.current;
    if (!code) {
      setVerdict(null);
      return;
    }
    const stale = () => !mounted.current || mine !== seq.current;
    try {
      const res = await lookupReferralCode(code);
      if (stale()) return;
      if (res.valid) {
        setVerdict({ kind: 'valid', name: res.inviterFirstName });
        await storePendingCode(code);
        if (stale()) return;
        onChangeRef.current(code);
      } else {
        setVerdict({ kind: 'invalid' });
        onChangeRef.current(null);
      }
    } catch {
      if (stale()) return;
      // Could not check (offline, rate limit): the code is kept, the server decides on attach.
      setVerdict({ kind: 'unreachable' });
      onChangeRef.current(code);
    }
  }, []);

  const edit = (value: string) => {
    const next = value.toUpperCase();
    setText(next);
    seq.current += 1;
    setVerdict(null);
    // An edited code is no longer the one that was checked; the typed text is still what the student means, so it is
    // reported at once (Welcome stores it on submit) unless a check later finds it invalid.
    void clearPendingCode();
    onChangeRef.current(normalizeCode(next) || null);
    clearTimeout(timer.current);
    if (normalizeCode(next)) timer.current = setTimeout(() => void check(next), DEBOUNCE_MS);
  };

  if (!enabled) return null;

  if (fromLink && verdict?.kind === 'valid') {
    return (
      <View style={styles.stack}>
        <Invited name={verdict.name} />
        <AppText role="caption" color="textMuted">
          {t('auth.referral.privacy')}
        </AppText>
        <HowLink />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {open ? (
        <>
          <TextField
            value={text}
            onChangeText={edit}
            accessibilityLabel={t('auth.referral.codeLabel')}
            placeholder={t('auth.referral.codePlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="done"
            onSubmitEditing={() => void check(text)}
            editable={!disabled}
            invalid={verdict?.kind === 'invalid'}
          />
          {verdict?.kind === 'valid' ? <Invited name={verdict.name} /> : null}
          {verdict?.kind === 'invalid' ? (
            <AppText role="small" color="textMuted">
              {t('auth.referral.invalid')}
            </AppText>
          ) : null}
          {verdict?.kind === 'unreachable' ? (
            <AppText role="small" color="textMuted">
              {t('auth.referral.unreachable')}
            </AppText>
          ) : null}
          <AppText role="caption" color="textMuted">
            {t('auth.referral.privacy')}
          </AppText>
          <HowLink />
        </>
      ) : (
        <AppText
          role="small"
          color="primaryStrong"
          accessibilityRole="link"
          onPress={disabled ? undefined : () => setOpen(true)}
          style={styles.link}
        >
          {t('auth.referral.link')}
        </AppText>
      )}
    </View>
  );
}

function Invited({ name }: { name: string | null }) {
  return (
    <AppText role="small" color="success" accessibilityRole="text">
      {name ? t('auth.referral.invitedBy', { nume: name }) : t('auth.referral.invited')}
    </AppText>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[2] },
  link: { textDecorationLine: 'underline', textAlign: 'center' },
  howLink: { textDecorationLine: 'underline', alignSelf: 'flex-start' },
});

/** Public explainer page: reachable from Welcome, so it must work signed out. */
function HowLink() {
  return (
    <AppText role="small" color="primaryStrong" accessibilityRole="link" onPress={() => router.push('/recomandari')} style={styles.howLink}>
      {t('auth.referral.how')}
    </AppText>
  );
}
