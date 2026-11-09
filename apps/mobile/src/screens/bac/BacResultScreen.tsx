import { AppText, ScreenLayout, goBackOrHome } from '../../ui';

/** Placeholder: the result screen (Task 8) replaces it. */
export default function BacResultScreen() {
  return (
    <ScreenLayout title="Rezultat" onBack={goBackOrHome}>
      <AppText role="body">Rezultat</AppText>
    </ScreenLayout>
  );
}
