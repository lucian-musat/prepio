import { ActivityIndicator } from 'react-native';
import { color } from '@prepio/shared';

type Props = { tint?: string; accessibilityLabel?: string };

/** Small loading indicator in the brand colour (RN core; replaces Paper's). */
export default function Spinner({ tint = color.primary, accessibilityLabel = 'Se încarcă' }: Props) {
  return <ActivityIndicator size="small" color={tint} accessibilityLabel={accessibilityLabel} />;
}
