import { emailAuthEnabled } from './flags';

afterEach(() => {
  delete process.env.EXPO_PUBLIC_AUTH_EMAIL_ENABLED;
});

it('is on only for the exact string "true"', () => {
  expect(emailAuthEnabled()).toBe(false);
  process.env.EXPO_PUBLIC_AUTH_EMAIL_ENABLED = 'true';
  expect(emailAuthEnabled()).toBe(true);
  process.env.EXPO_PUBLIC_AUTH_EMAIL_ENABLED = '1';
  expect(emailAuthEnabled()).toBe(false);
});
