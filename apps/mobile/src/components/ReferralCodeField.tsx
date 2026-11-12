import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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

const LINK = 'Ai un cod de invitație?';
const PRIVACY = 'Cel care te-a invitat va vedea prenumele și e-mailul tău.';
const INVALID = 'Codul nu este valid.';
const UNREACHABLE = 'Nu am putut verifica codul acum.';
/** Typing pauses this long start the check (the keyboard's submit checks at once). */
const DEBOUNCE_MS = 700;

type Props = { onChange: (code: string | null) => void; disabled?: boolean };
type Verdict = { kind: 'valid'; name: string | null } | { kind: 'invalid' } | { kind: 'unreachable' } | null;

/**
 * "Ai un cod de invitație?" on Welcome: shown only while the referral programme is on. A code that came with the
 * invite link and is valid shows who invited the student; otherwise the link expands to a text field. A valid
 * code is stored on this device (it survives the Google redirect) and reported through `onChange`; anything else
 * reports null. It never blocks signing in.
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

  // Programme on/off, and a code already pending (the invite link).
  useEffect(() => {
    let live = true;
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
    try {
      const res = await lookupReferralCode(code);
      if (mine !== seq.current) return;
      if (res.valid) {
        setVerdict({ kind: 'valid', name: res.inviterFirstName });
        await storePendingCode(code);
        onChangeRef.current(code);
      } else {
        setVerdict({ kind: 'invalid' });
        onChangeRef.current(null);
      }
    } catch {
      if (mine !== seq.current) return;
      setVerdict({ kind: 'unreachable' });
      onChangeRef.current(null);
    }
  }, []);

  const edit = (value: string) => {
    const next = value.toUpperCase();
    setText(next);
    seq.current += 1;
    setVerdict(null);
    // An edited code is no longer the one that was checked.
    void clearPendingCode();
    onChangeRef.current(null);
    clearTimeout(timer.current);
    if (normalizeCode(next)) timer.current = setTimeout(() => void check(next), DEBOUNCE_MS);
  };

  if (!enabled) return null;

  if (fromLink && verdict?.kind === 'valid') {
    return (
      <View style={styles.stack}>
        <Invited name={verdict.name} />
        <AppText role="caption" color="textMuted">
          {PRIVACY}
        </AppText>
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
            accessibilityLabel="Cod de invitație"
            placeholder="Codul de invitație"
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
              {INVALID}
            </AppText>
          ) : null}
          {verdict?.kind === 'unreachable' ? (
            <AppText role="small" color="textMuted">
              {UNREACHABLE}
            </AppText>
          ) : null}
          <AppText role="caption" color="textMuted">
            {PRIVACY}
          </AppText>
        </>
      ) : (
        <AppText
          role="small"
          color="primaryStrong"
          accessibilityRole="link"
          onPress={disabled ? undefined : () => setOpen(true)}
          style={styles.link}
        >
          {LINK}
        </AppText>
      )}
    </View>
  );
}

function Invited({ name }: { name: string | null }) {
  return (
    <AppText role="small" color="success" accessibilityRole="text">
      {name ? `Invitat de ${name} ✓` : 'Invitat ✓'}
    </AppText>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[2] },
  link: { textDecorationLine: 'underline', textAlign: 'center' },
});
