import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { easing, staggerConfig, useEnter } from './motion';

type Props = {
  /** Custom enter motion. Ignored when `index` is given. */
  config?: Parameters<typeof useEnter>[0];
  /** Position in a staggered list: fade + rise 12 px after 40 + index × 50 ms (staggerConfig). */
  index?: number;
  curve?: typeof easing.standard;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

/**
 * View that fades/slides in on mount (see useEnter). Give it a new `key` to replay for new content.
 * Pass `index` for list items (the shared-value replacement for the `enterStagger` Keyframe).
 */
export default function Enter({ config, index, curve = easing.out, style, testID, children }: Props) {
  const enter = useEnter(index !== undefined ? staggerConfig(index) : (config ?? staggerConfig(0)), curve);
  return (
    <Animated.View testID={testID} style={[style, enter]}>
      {children}
    </Animated.View>
  );
}
