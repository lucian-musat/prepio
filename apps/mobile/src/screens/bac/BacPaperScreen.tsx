import { useLocalSearchParams } from 'expo-router';
import { AppText, ScreenLayout, goBackOrHome } from '../../ui';

/** Placeholder: the paper screen (Task 8) replaces it. */
export default function BacPaperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScreenLayout title="Subiect BAC" onBack={goBackOrHome}>
      <AppText role="body">{id}</AppText>
    </ScreenLayout>
  );
}
