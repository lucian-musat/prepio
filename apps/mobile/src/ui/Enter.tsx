import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { easing, staggerConfig, useEnter } from './motion';

type Common = {
  curve?: typeof easing.standard;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

// Either a staggered list position or a custom motion, never both.
type Props = Common &
  (
    | {
        /** Position in a staggered list: fade + rise 12 px after 40 + index × 50 ms (staggerConfig). Default 0. */
        index?: number;
        config?: never;
      }
    | {
        /** Custom enter motion. */
        config: Parameters<typeof useEnter>[0];
        index?: never;
      }
  );

/**
 * View that fades/slides in on mount (see useEnter). Give it a new `key` to replay for new content.
 * Pass `index` for list items (the shared-value replacement for the `enterStagger` Keyframe).
 */
export default function Enter({ config, index = 0, curve = easing.standard, style, testID, children }: Props) {
  const enter = useEnter(config ?? staggerConfig(index), curve);
  return (
    <Animated.View testID={testID} style={[style, enter]}>
      {children}
    </Animated.View>
  );
}
