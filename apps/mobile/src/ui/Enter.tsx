import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { easing, useEnter } from './motion';

type Props = {
  config: Parameters<typeof useEnter>[0];
  curve?: typeof easing.standard;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

/** View that fades/slides in on mount (see useEnter). Give it a new `key` to replay for new content. */
export default function Enter({ config, curve = easing.out, style, testID, children }: Props) {
  const enter = useEnter(config, curve);
  return (
    <Animated.View testID={testID} style={[style, enter]}>
      {children}
    </Animated.View>
  );
}
