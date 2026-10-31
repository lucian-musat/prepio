import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout, space } from '@prepio/shared';
import { easing, feedbackConfig, useEnter } from './motion';
import { raisedShadow } from './elevation';

export type ActionTone = 'neutral' | 'good' | 'wrong';

type Props = {
  children: ReactNode;
  feedback?: ReactNode;
  tone?: ActionTone;
  raised: boolean;
};

// Mounted only while there is feedback, so the slide-up plays each time feedback appears.
function Feedback({ children }: { children: ReactNode }) {
  const enter = useEnter('feedback', feedbackConfig, easing.standard);
  return <Animated.View style={[styles.slot, enter]}>{children}</Animated.View>;
}

/** Fixed bottom bar holding the screen's primary action(s), with an optional feedback slot above them. */
export default function ActionBar({ children, feedback, tone = 'neutral', raised }: Props) {
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  const { bottom } = useSafeAreaInsets();
  const tinted = tone !== 'neutral';
  return (
    <View
      testID="action-bar"
      style={[
        styles.bar,
        wide && styles.wide,
        { paddingBottom: (wide ? space[4.5] : space[3.5]) + bottom },
        raised && !tinted && styles.raised,
        tone === 'good' && styles.good,
        tone === 'wrong' && styles.wrong,
      ]}
    >
      {feedback ? (
        <Feedback>{feedback}</Feedback>
      ) : null}
      <View style={[styles.slot, styles.row]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: space[3],
    paddingHorizontal: layout.gutter,
    backgroundColor: color.bg,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
    zIndex: 4,
  },
  // Prototype desktop: 14 / 32 / 18.
  wide: { paddingTop: space[3.5], paddingHorizontal: layout.gutterWide },
  raised: { borderTopColor: color.border, boxShadow: raisedShadow('up') },
  good: { backgroundColor: color.successSubtle },
  wrong: { backgroundColor: color.dangerSubtle },
  slot: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: space[2.5] },
});
