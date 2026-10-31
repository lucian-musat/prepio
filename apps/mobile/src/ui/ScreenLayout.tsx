import { useCallback, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, layout, space } from '@prepio/shared';
import TopBar from './TopBar';
import ActionBar, { type ActionTone } from './ActionBar';
import { screenConfig, useEnter } from './motion';

type Props = {
  title?: string;
  logo?: boolean;
  progress?: number;
  onBack?: () => void;
  actions?: ReactNode;
  feedback?: ReactNode;
  tone?: ActionTone;
  children: ReactNode;
  /** Changing it replays the content's enter animation (e.g. next question on the same route). */
  contentKey?: string;
  scrollRef?: Ref<Animated.ScrollView>;
};

// Edge shadows appear only once content is actually hidden under a bar (prototype: 4 px tolerance).
const EDGE = space[1];

/**
 * Every student screen: fixed TopBar, scrolling content (max 720 px, centred), fixed ActionBar.
 * Only the middle scrolls, so long content never pushes the header or the primary action off-screen.
 */
export default function ScreenLayout({
  title,
  logo,
  progress,
  onBack,
  actions,
  feedback,
  tone,
  children,
  contentKey,
  scrollRef,
}: Props) {
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  const m = useRef({ y: 0, viewH: 0, contentH: 0 });
  const [topRaised, setTopRaised] = useState(false);
  const [bottomRaised, setBottomRaised] = useState(false);
  // Same values as enterScreen('forward'); a shared-value animation because Keyframe entering breaks layout on web (see useEnter).
  const enter = useEnter(contentKey, screenConfig('forward'));

  const update = useCallback(() => {
    const { y, viewH, contentH } = m.current;
    setTopRaised(y > EDGE);
    setBottomRaised(y + viewH < contentH - EDGE);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      m.current.y = e.nativeEvent.contentOffset.y;
      update();
    },
    [update],
  );
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      m.current.viewH = e.nativeEvent.layout.height;
      update();
    },
    [update],
  );
  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      m.current.contentH = h;
      update();
    },
    [update],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TopBar title={title} logo={logo} progress={progress} onBack={onBack} raised={topRaised} />
        <Animated.ScrollView
          ref={scrollRef}
          testID="screen-scroll"
          style={styles.fill}
          contentContainerStyle={[styles.content, wide && styles.contentWide]}
          onScroll={onScroll}
          onLayout={onLayout}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View key={contentKey} style={[styles.inner, wide && styles.innerWide, enter]}>
            {children}
          </Animated.View>
        </Animated.ScrollView>
        {actions ? (
          <ActionBar feedback={feedback} tone={tone} raised={bottomRaised}>
            {actions}
          </ActionBar>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: space[3],
    paddingBottom: space[6],
    paddingHorizontal: layout.gutter,
  },
  // Prototype desktop: 32 px gutters, 40 px bottom.
  contentWide: { paddingHorizontal: layout.gutterWide, paddingBottom: space[10] },
  // Prototype .inner is 720 px including its gutters.
  inner: { width: '100%', maxWidth: layout.maxContentWidth - 2 * layout.gutter, alignSelf: 'center' },
  innerWide: { maxWidth: layout.maxContentWidth - 2 * layout.gutterWide },
});
