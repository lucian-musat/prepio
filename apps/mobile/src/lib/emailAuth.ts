import { getSupabase } from './supabase';
import { t } from '../texts/store';

/** The sign-in error texts (read at use time, so admin overrides apply). A network failure is the shared offline text. */
export const EMAIL_AUTH_ERROR = {
  get invalidEmail() {
    return t('errors.auth.invalidEmail');
  },
  get wrongCode() {
    return t('errors.auth.wrongCode');
  },
  get rateLimit() {
    return t('errors.auth.rateLimit');
  },
  get network() {
    return t('errors.offline');
  },
};
/** Seconds before the student may ask for another code. */
export const RESEND_COOLDOWN_SECONDS = 60;

type AuthLikeError = { name?: string; code?: string; status?: number };

function isNetworkError(e: AuthLikeError): boolean {
  // supabase-js reports an unreachable server as AuthRetryableFetchError (status 0); a raw fetch failure is a TypeError.
  return e.name === 'AuthRetryableFetchError' || e.name === 'TypeError' || e.status === 0;
}

function isRateLimit(e: AuthLikeError): boolean {
  return e.status === 429 || (e.code?.includes('rate_limit') ?? false);
}

function toMessage(e: unknown, fallback: string): string {
  const err = (e ?? {}) as AuthLikeError;
  if (isNetworkError(err)) return EMAIL_AUTH_ERROR.network;
  if (isRateLimit(err)) return EMAIL_AUTH_ERROR.rateLimit;
  if (err.code === 'email_address_invalid' || err.code === 'validation_failed') return EMAIL_AUTH_ERROR.invalidEmail;
  return fallback;
}

/** Emails a 6-digit sign-in code (creating the account on first use). Throws an Error with a Romanian message. */
export async function sendEmailCode(email: string): Promise<void> {
  try {
    const { error } = await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  } catch (e) {
    // Anything unrecognised while sending is most likely connectivity.
    throw new Error(toMessage(e, EMAIL_AUTH_ERROR.network));
  }
}

/** Exchanges the emailed code for a session (AuthProvider reacts to it). Throws an Error with a Romanian message. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  try {
    const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
  } catch (e) {
    throw new Error(toMessage(e, EMAIL_AUTH_ERROR.wrongCode));
  }
}
