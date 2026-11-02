import { Button, AppText, ScreenLayout } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthProvider';

/** Placeholder for "Cum te numești?"; replaced by the real name screen in a later task. */
export default function NamePlaceholder() {
  const { signOut } = useAuth();
  return (
    <ScreenLayout logo actions={<Button flex label="Ieși din cont" onPress={signOut} />}>
      <AppText role="title">Cum te numești?</AppText>
      <AppText color="textMuted">Ecranul pentru nume vine în curând.</AppText>
    </ScreenLayout>
  );
}
