import { AppText, ScreenLayout } from '../../src/ui';

/** Placeholder welcome screen; replaced by the real one (Google + email code) in a later task. */
export default function WelcomePlaceholder() {
  return (
    <ScreenLayout logo>
      <AppText role="title">Bun venit la Prepio</AppText>
      <AppText color="textMuted">Autentificarea vine în curând.</AppText>
    </ScreenLayout>
  );
}
