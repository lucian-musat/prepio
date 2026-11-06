import { createContext, useCallback, useContext, useRef, useState, type ReactNode, type Ref } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout, space } from '@prepio/shared';
import TopBar from './TopBar';
import ActionBar, { type ActionTone } from './ActionBar';
import Enter from './Enter';
import { screenConfig } from './motion';

type Props = {
  title?: string;
  logo?: boolean;
  progress?: number;
  /** Accessible name of the progress bar (default "Progres"). */
  progressLabel?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  /** A full-width row in the header under the progress: it stays put while the content scrolls. */
  subheader?: ReactNode;
  actions?: ReactNode;
  feedback?: ReactNode;
  tone?: ActionTone;
  children: ReactNode;
  /** Changing it replays the content's enter animation (e.g. next question on the same route). */
  contentKey?: string;
  scrollRef?: Ref<Animated.ScrollView>;
  /** On desktop, content up to `layout.maxWideContentWidth` instead of 720 px (a source beside the answer). */
  wide?: boolean;
};

/** Height the content can use without scrolling (the scroll viewport minus its paddings); null before layout. */
const ViewportContext = createContext<number | null>(null);
export const useScreenViewport = () => useContext(ViewportContext);

/** Top padding of the scroll content: the content wrapper sits this far below the scroll origin. */
export const SCREEN_CONTENT_TOP = space[3];

// Edge shadows appear only once content is actually hidden under a bar (prototype: 4 px tolerance).
const EDGE = space[1];

// Screen enter, run as a shared-value animation (Keyframe entering breaks layout on web, see useEnter).
const SCREEN_ENTER = screenConfig('forward');

/**
 * Every student screen: fixed TopBar, scrolling content (max 720 px, centred), fixed ActionBar.
 * Only the middle scrolls, so long content never pushes the header or the primary action off-screen.
 */
export default function ScreenLayout({
  title,
  logo,
  progress,
  progressLabel,
  onBack,
  trailing,
  subheader,
  actions,
  feedback,
  tone,
  children,
  contentKey,
  scrollRef,
  wide: wideContent = false,
}: Props) {
  const wide = useWindowDimensions().width >= layout.wideBreakpoint;
  const m = useRef({ y: 0, viewH: 0, contentH: 0 });
  const [topRaised, setTopRaised] = useState(false);
  const [bottomRaised, setBottomRaised] = useState(false);
  const [viewH, setViewH] = useState<number | null>(null);
  const { bottom } = useSafeAreaInsets();
  // Without an action bar nothing else clears the gesture bar / home indicator, so the content does.
  const bottomPad = (wide ? space[10] : space[6]) + (actions ? 0 : bottom);
  const insetPad = !actions && bottom ? { paddingBottom: bottomPad } : null;

  const update = useCallback(() => {
    const { y, viewH, contentH } = m.current;
    const measured = viewH > 0;
    setTopRaised(measured && y > EDGE);
    // Before the first layout the viewport height is unknown (0): nothing can be hidden yet.
    setBottomRaised(measured && y + viewH < contentH - EDGE);
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
      setViewH(e.nativeEvent.layout.height);
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
        <TopBar title={title} logo={logo} progress={progress} progressLabel={progressLabel} onBack={onBack} trailing={trailing} below={subheader} raised={topRaised} />
        <Animated.ScrollView
          ref={scrollRef}
          testID="screen-scroll"
          style={styles.fill}
          contentContainerStyle={[styles.content, wide && styles.contentWide, insetPad]}
          onScroll={onScroll}
          onLayout={onLayout}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Keyed: new content remounts with a fresh, hidden enter animation. */}
          <Enter
            key={contentKey}
            testID="screen-content"
            config={SCREEN_ENTER}
            style={[styles.inner, wide && styles.innerWide, wide && wideContent && styles.innerSplit]}
          >
            <ViewportContext.Provider value={viewH === null ? null : Math.max(0, viewH - SCREEN_CONTENT_TOP - bottomPad)}>
              {children}
            </ViewportContext.Provider>
          </Enter>
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
    paddingTop: SCREEN_CONTENT_TOP,
    paddingBottom: space[6],
    paddingHorizontal: layout.gutter,
  },
  // Prototype desktop: 32 px gutters, 40 px bottom.
  contentWide: { paddingHorizontal: layout.gutterWide, paddingBottom: space[10] },
  // Prototype .inner is 720 px including its gutters.
  inner: { width: '100%', maxWidth: layout.maxContentWidth - 2 * layout.gutter, alignSelf: 'center' },
  innerWide: { maxWidth: layout.maxContentWidth - 2 * layout.gutterWide },
  innerSplit: { maxWidth: layout.maxWideContentWidth - 2 * layout.gutterWide },
});
