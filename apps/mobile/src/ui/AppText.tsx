import { Text, type TextProps } from 'react-native';
import { color as colors, typeScale } from '@prepio/shared';
import { type } from './typography';

export type TypeRole = keyof typeof typeScale;

// `role` is the typography role here; RN's ARIA `role` prop is replaced (use accessibilityRole instead).
type Props = Omit<TextProps, 'role'> & { role?: TypeRole; color?: keyof typeof colors };

/** Text in a typography role and a semantic colour. */
export default function AppText({ role = 'body', color = 'text', style, ...rest }: Props) {
  return <Text {...rest} style={[type(role), { color: colors[color] }, style]} />;
}
