import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, motion, radius, space, type Card } from '@prepio/shared';
import { Button, CardTransition, ScreenLayout, timing } from '../ui';
import CardView from './cards/CardView';
import type { LessonFrame } from './QuestionView';

// Prototype `.dots i` / `.dots i.on`.
const DOT = 7;
const DOT_ACTIVE = 22;

function Dot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? DOT_ACTIVE : DOT);
  const bg = useSharedValue<string>(active ? color.primary : color.border);
  useEffect(() => {
    const t = timing(motion.duration.base);
    width.value = withTiming(active ? DOT_ACTIVE : DOT, t);
    bg.value = withTiming(active ? color.primary : color.border, t);
  }, [active]);
  const style = useAnimatedStyle(() => ({ width: width.value, backgroundColor: bg.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

type Props = {
  cards: Card[];
  onFinish: () => void;
  frame: LessonFrame;
  /** Label of the button on the last card: "La exerciții" when questions/exercises follow. */
  finishLabel?: string;
  /** Reports the current card so the lesson can update its progress bar. */
  onIndexChange?: (index: number) => void;
};

/** Learning cards one at a time (prototype `.stepper`): slide transition, dots, Înapoi / Continuă in the action bar. */
export default function CardStepper({ cards, onFinish, frame, finishLabel = 'Continuă', onIndexChange }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const scrollRef = useRef<Animated.ScrollView>(null);
  const card = cards[index];
  if (!card) return null;
  const last = index === cards.length - 1;

  const go = (to: number) => {
    setDirection(to > index ? 'next' : 'prev');
    setIndex(to);
    onIndexChange?.(to);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <ScreenLayout
      title={frame.title}
      progress={frame.progress}
      onBack={frame.onBack}
      scrollRef={scrollRef}
      actions={
        <>
          <Button
            flex
            variant="secondary"
            label="Înapoi"
            accessibilityLabel="Înapoi la cartonașul anterior"
            disabled={index === 0}
            onPress={() => index > 0 && go(index - 1)}
          />
          <Button flex label={last ? finishLabel : 'Continuă'} onPress={() => (last ? onFinish() : go(index + 1))} />
        </>
      }
    >
      <CardTransition contentKey={card.id} direction={direction}>
        <CardView card={card} eyebrow={`Cartonaș ${index + 1} din ${cards.length}`} />
      </CardTransition>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {cards.map((c, i) => (
          <Dot key={c.id} active={i === index} />
        ))}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space[1.5], marginTop: space[3.5] },
  dot: { height: DOT, borderRadius: radius.pill },
});
