import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, motion, radius, space, type Card } from '@prepio/shared';
import { imageUrl } from '../lib/content';
import { AppText, Button, CardTransition, ScreenLayout, Surface, timing } from '../ui';
import type { LessonFrame } from './QuestionView';

// Prototype `.dots i` / `.dots i.on`, and the card image height.
const DOT = 7;
const DOT_ACTIVE = 22;
const IMAGE_HEIGHT = 200;

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

function CardView({ card, eyebrow }: { card: Card; eyebrow: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!card.imagePath && !imageFailed;
  return (
    <Surface padding={5} radius="xl">
      <AppText role="eyebrow" color="primary">
        {eyebrow}
      </AppText>
      {card.title ? (
        <AppText role="title" accessibilityRole="header" style={styles.title}>
          {card.title}
        </AppText>
      ) : null}
      {showImage ? (
        <View style={styles.figure}>
          <Image
            source={{ uri: imageUrl(card.imagePath!) }}
            accessibilityLabel={`${card.title ?? 'Card'} – ilustrație`}
            resizeMode="contain"
            style={styles.image}
            onError={() => setImageFailed(true)}
          />
          {card.imageCredit ? (
            <AppText role="caption" color="textMuted">
              {card.imageCredit}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <AppText role="body" style={!card.title && !showImage ? styles.bodyOnly : undefined}>
        {card.body}
      </AppText>
    </Surface>
  );
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
          <Button flex variant="secondary" label="Înapoi" disabled={index === 0} onPress={() => index > 0 && go(index - 1)} />
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
  title: { marginTop: space[1.5], marginBottom: space[3] },
  bodyOnly: { marginTop: space[1.5] },
  figure: { gap: space[1], marginBottom: space[3] },
  image: { width: '100%', height: IMAGE_HEIGHT, borderRadius: radius.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space[1.5], marginTop: space[3.5] },
  dot: { height: DOT, borderRadius: radius.pill },
});
