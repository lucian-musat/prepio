import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { border, color, palette, radius, space, type CardContent, type TimelinePoint } from '@prepio/shared';
import { AppText, Enter, Icon, Reveal } from '../../ui';
import { mixColors } from '../../ui/elevation';
import { fontFamily } from '../../theme/fonts';
import { imageUrl } from '../../lib/content';
import { ExpandHint, hoverTransition, pointer, useExpandFeedback } from './expandable';
import { t } from '../../texts/store';

const LINE_LEFT = 7;
const LINE_WIDTH = 3;
const DOT = 17;
const GUTTER = 22;
const THUMB = 48;
const CHEVRON = space[4.5]; // 18 px glyph
// Every row has the same padding (tinted or not), so dates line up; the dot follows the first text line.
const ROW_PAD_V = space[2];
const ROW_PAD_H = space[2.5];
const HOVER_BG = mixColors(color.primary, color.primarySubtle, 0.08);

function Chevron({ turn }: { turn: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View testID="timeline-chevron" style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon name="down" size={CHEVRON} tint={color.primary} />
    </Animated.View>
  );
}

function PointBody({ point, expanded, turn }: { point: TimelinePoint; expanded: boolean; turn?: SharedValue<number> }) {
  return (
    <>
      <View style={styles.head}>
        <View style={styles.headText}>
          <AppText role="caption" color="primary" style={styles.date}>
            {point.key ? `${point.date} ★` : point.date}
          </AppText>
          <AppText role="label">{point.title}</AppText>
        </View>
        {point.imagePath ? <Image source={{ uri: imageUrl(point.imagePath) }} resizeMode="cover" accessible={false} style={styles.thumb} /> : null}
        {turn ? <Chevron turn={turn} /> : null}
      </View>
      {point.details ? (
        <Reveal open={expanded}>
          <View style={styles.details}>
            <AppText role="caption" color="textMuted">
              {point.details}
            </AppText>
          </View>
        </Reveal>
      ) : null}
    </>
  );
}

/** A point with details: a tinted, tappable row with a chevron that turns over as the details slide open. */
function ExpandablePoint({ point, label }: { point: TimelinePoint; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const { hovered, turn, pressStyle, handlers } = useExpandFeedback(expanded);
  return (
    // Static Pressable around an Animated.View (like OptionRow): an animated Pressable's transform does not
    // update on react-native-web. The label replaces the children for screen readers, so it carries the
    // details once expanded. aria-expanded, not accessibilityState: react-native-web 0.21 drops the latter.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? `${label}. ${point.details}` : label}
      accessibilityHint={t('cards.expand.hint')}
      aria-expanded={expanded}
      onPress={() => setExpanded((e) => !e)}
      {...handlers}
      style={pointer}
    >
      <Animated.View style={[styles.row, styles.rowTap, hovered && styles.rowHover, pressStyle]}>
        <PointBody point={point} expanded={expanded} turn={turn} />
      </Animated.View>
    </Pressable>
  );
}

function TimelineEvent({ point, index }: { point: TimelinePoint; index: number }) {
  const label = t(point.key ? 'cards.timeline.keyPoint' : 'cards.timeline.point', { data: point.date, titlu: point.title });
  return (
    <Enter index={index} style={styles.event}>
      <View style={[styles.dot, point.key && styles.dotKey]} />
      {point.details ? (
        <ExpandablePoint point={point} label={label} />
      ) : (
        <View accessible accessibilityLabel={label} style={styles.row}>
          <PointBody point={point} expanded={false} />
        </View>
      )}
    </Enter>
  );
}

export default function TimelineCard({ content }: { content: Extract<CardContent, { type: 'timeline' }> }) {
  return (
    <View>
      {content.points.some((p) => p.details) ? <ExpandHint text={t('cards.timeline.hint')} /> : null}
      <View style={styles.root}>
        <LinearGradient colors={[palette.teal[300], palette.teal[700]]} style={styles.line} />
        {content.points.map((p, i) => (
          <TimelineEvent key={p.id} point={p} index={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', paddingLeft: GUTTER, marginTop: space[1] },
  line: { position: 'absolute', left: LINE_LEFT, top: space[1], bottom: space[1], width: LINE_WIDTH, borderRadius: 2 },
  event: { position: 'relative', marginBottom: space[1.5] },
  dot: {
    position: 'absolute',
    left: -GUTTER,
    top: ROW_PAD_V + 2,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.surface,
    borderWidth: 3,
    borderColor: color.primary,
  },
  dotKey: { backgroundColor: color.accent, borderColor: palette.yellow[600] },
  row: { paddingVertical: ROW_PAD_V, paddingHorizontal: ROW_PAD_H, borderRadius: radius.sm },
  rowTap: { backgroundColor: color.primarySubtle, ...hoverTransition },
  rowHover: { backgroundColor: HOVER_BG },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  headText: { flex: 1, minWidth: 0 },
  date: { fontFamily: fontFamily.headExtra },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.sm, backgroundColor: color.surfaceMuted },
  details: {
    borderTopWidth: border.hairline,
    borderTopColor: palette.teal[300],
    paddingTop: space[1.5],
    marginTop: space[2],
  },
});
