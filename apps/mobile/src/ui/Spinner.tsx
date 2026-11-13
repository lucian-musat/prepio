import { ActivityIndicator } from 'react-native';
import { color } from '@prepio/shared';
import { t } from '../texts/store';

type Props = { tint?: string; accessibilityLabel?: string };

/** Small loading indicator in the brand colour (RN core; replaces Paper's). */
export default function Spinner({ tint = color.primary, accessibilityLabel }: Props) {
  return <ActivityIndicator size="small" color={tint} accessibilityLabel={accessibilityLabel ?? t('common.loading')} />;
}
