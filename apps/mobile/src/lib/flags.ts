/** Email-code sign-in is shown only when the build opts in (Expo inlines the literal at bundle time). */
export function emailAuthEnabled(): boolean {
  return process.env.EXPO_PUBLIC_AUTH_EMAIL_ENABLED === 'true';
}
