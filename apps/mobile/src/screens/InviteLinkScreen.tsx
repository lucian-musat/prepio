import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { normalizeCode, storePendingCode } from '../lib/referrals';

/**
 * `/invita/<CODE>`, public (signed out too): remembers the code on this device for the sign-in that follows
 * (Welcome shows who invited), then replaces itself with the start page, where the root guard picks the right
 * screen. A student who is already signed in has no use for a code: nothing is stored.
 */
export default function InviteLinkScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { status } = useAuth();
  const [stored, setStored] = useState(false);

  useEffect(() => {
    let live = true;
    const raw = Array.isArray(code) ? code[0] : code;
    const normalized = normalizeCode(raw ?? '');
    void (async () => {
      if (status === 'signedOut' && normalized) await storePendingCode(normalized);
      if (live) setStored(true);
    })();
    return () => {
      live = false;
    };
  }, [code, status]);

  // Only after the write: the redirect must not outrun the storage.
  return stored ? <Redirect href="/" /> : null;
}
