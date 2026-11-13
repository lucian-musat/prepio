import { applyOverrides, resetTexts } from '../texts/store';
import { getSupabase } from './supabase';
import { sendEmailCode, verifyEmailCode, EMAIL_AUTH_ERROR } from './emailAuth';

jest.mock('./supabase', () => ({ getSupabase: jest.fn() }));

let auth: Record<'signInWithOtp' | 'verifyOtp', jest.Mock>;

beforeEach(() => {
  auth = {
    signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
  };
  (getSupabase as jest.Mock).mockReturnValue({ auth });
});

const authError = (over: Record<string, unknown>) => Object.assign(new Error('x'), over);

it('sends the code and creates the user on first sign-in', async () => {
  await sendEmailCode('ana@example.com');
  expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'ana@example.com', options: { shouldCreateUser: true } });
});

it('verifies the 6-digit code as an email OTP', async () => {
  await verifyEmailCode('ana@example.com', '123456');
  expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'ana@example.com', token: '123456', type: 'email' });
});

it.each([
  [{ code: 'email_address_invalid', status: 400 }, EMAIL_AUTH_ERROR.invalidEmail],
  [{ code: 'validation_failed', status: 422 }, EMAIL_AUTH_ERROR.invalidEmail],
  [{ code: 'over_email_send_rate_limit', status: 429 }, EMAIL_AUTH_ERROR.rateLimit],
  [{ status: 429 }, EMAIL_AUTH_ERROR.rateLimit],
  [{ name: 'AuthRetryableFetchError', status: 0 }, EMAIL_AUTH_ERROR.network],
])('maps a send error %j', async (over, message) => {
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: authError(over) });
  await expect(sendEmailCode('ana@example.com')).rejects.toThrow(message);
});

it.each([
  [{ code: 'otp_expired', status: 403 }, EMAIL_AUTH_ERROR.wrongCode],
  [{ status: 400 }, EMAIL_AUTH_ERROR.wrongCode],
  [{ code: 'over_request_rate_limit', status: 429 }, EMAIL_AUTH_ERROR.rateLimit],
  [{ name: 'AuthRetryableFetchError', status: 0 }, EMAIL_AUTH_ERROR.network],
])('maps a verify error %j', async (over, message) => {
  auth.verifyOtp.mockResolvedValue({ data: {}, error: authError(over) });
  await expect(verifyEmailCode('ana@example.com', '000000')).rejects.toThrow(message);
});

it('maps a thrown fetch failure to the network message', async () => {
  auth.signInWithOtp.mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(sendEmailCode('ana@example.com')).rejects.toThrow(EMAIL_AUTH_ERROR.network);
});

describe('texts wiring', () => {
  afterEach(resetTexts);
  it('uses an admin override of the wrong-code message', async () => {
    applyOverrides({ 'errors.auth.wrongCode': '[override]' });
    auth.verifyOtp.mockResolvedValue({ data: {}, error: authError({ code: 'otp_expired', status: 403 }) });
    await expect(verifyEmailCode('ana@example.com', '000000')).rejects.toThrow('[override]');
  });
});
