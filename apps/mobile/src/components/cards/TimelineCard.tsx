import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color, palette, radius, space, type CardContent, type TimelinePoint } from '@prepio/shared';
import { AppText, Enter } from '../../ui';
import { fontFamily } from '../../theme/fonts';
import { imageUrl } from '../../lib/content';

const LINE_LEFT = 7;
const LINE_WIDTH = 3;
const DOT = 17;
const GUTTER = 22;
const THUMB = 48;

function PointBody({ point, expanded }: { point: TimelinePoint; expanded: boolean }) {
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
      </View>
      {point.details && expanded ? (
        <View style={styles.details}>
          <AppText role="caption" color="textMuted">
            {point.details}
          </AppText>
        </View>
      ) : null}
    </>
  );
}

function TimelineEvent({ point, index }: { point: TimelinePoint; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const label = `${point.date}, ${point.title}${point.key ? ', moment cheie' : ''}`;
  return (
    <Enter index={index} style={styles.event}>
      <View style={[styles.dot, point.key && styles.dotKey]} />
      {point.details ? (
        // The label replaces the children for screen readers, so it carries the details once expanded.
        // aria-expanded, not accessibilityState: react-native-web 0.21 drops the latter; native maps both.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? `${label}. ${point.details}` : label}
          aria-expanded={expanded}
          onPress={() => setExpanded((e) => !e)}
        >
          <PointBody point={point} expanded={expanded} />
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label}>
          <PointBody point={point} expanded={false} />
        </View>
      )}
    </Enter>
  );
}

export default function TimelineCard({ content }: { content: Extract<CardContent, { type: 'timeline' }> }) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={[palette.teal[300], palette.teal[700]]} style={styles.line} />
      {content.points.map((p, i) => (
        <TimelineEvent key={p.id} point={p} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', paddingLeft: GUTTER, marginTop: space[1] },
  line: { position: 'absolute', left: LINE_LEFT, top: space[1], bottom: space[1], width: LINE_WIDTH, borderRadius: 2 },
  event: { position: 'relative', marginBottom: space[3] },
  dot: {
    position: 'absolute',
    left: -GUTTER,
    top: 2,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.surface,
    borderWidth: 3,
    borderColor: color.primary,
  },
  dotKey: { backgroundColor: color.accent, borderColor: palette.yellow[600] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  headText: { flex: 1, minWidth: 0 },
  date: { fontFamily: fontFamily.headExtra },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.sm, backgroundColor: color.surfaceMuted },
  details: { backgroundColor: color.primarySubtle, borderRadius: radius.xs, paddingVertical: space[1.5], paddingHorizontal: space[2], marginTop: space[1] },
});
