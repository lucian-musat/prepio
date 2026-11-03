import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, palette, radius, space, type CardContent, type SchemaBox } from '@prepio/shared';
import { AppText, Enter } from '../../ui';

type Tone = 'cause' | 'central' | 'consequence';
const TEXT_COLOR = { cause: 'text', central: 'onPrimary', consequence: 'onAccent' } as const;
const DETAIL_COLOR = { cause: 'textMuted', central: 'onPrimary', consequence: 'onAccent' } as const;

/** A schema box; one with `detail` is a button that toggles it. */
function Box({ box, tone }: { box: SchemaBox; tone: Tone }) {
  const [expanded, setExpanded] = useState(false);
  const body = (
    <>
      <AppText role="label" color={TEXT_COLOR[tone]} style={styles.text}>
        {box.text}
      </AppText>
      {box.detail && expanded ? (
        <AppText role="caption" color={DETAIL_COLOR[tone]} style={styles.text}>
          {box.detail}
        </AppText>
      ) : null}
    </>
  );
  const style: StyleProp<ViewStyle> = [styles.box, styles[tone], tone !== 'central' && styles.flexBox];
  return box.detail ? (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((e) => !e)} style={style}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

const Arrow = () => (
  <AppText role="label" color="primary" accessible={false} importantForAccessibility="no" style={styles.arrow}>
    ▼
  </AppText>
);

function Zone({ label, boxes, tone }: { label: string; boxes: SchemaBox[]; tone: Tone }) {
  return (
    <View style={styles.zone}>
      <AppText role="caption" color="textMuted" style={styles.zoneLabel}>
        {label}
      </AppText>
      <View style={styles.row}>
        {boxes.map((b) => (
          <Box key={b.id} box={b} tone={tone} />
        ))}
      </View>
    </View>
  );
}

export default function SchemaCard({ content }: { content: Extract<CardContent, { type: 'schema' }> }) {
  return (
    <Enter index={0} style={styles.root}>
      <Zone label={content.causesLabel} boxes={content.causes} tone="cause" />
      <Arrow />
      <View style={styles.zone}>
        <Box box={content.central} tone="central" />
      </View>
      <Arrow />
      <Zone label={content.consequencesLabel} boxes={content.consequences} tone="consequence" />
    </Enter>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space[1.5] },
  zone: { width: '100%', gap: space[1] },
  zoneLabel: { textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5], width: '100%' },
  box: { borderRadius: radius.sm, paddingVertical: space[2], paddingHorizontal: space[2.5], gap: space[1], minWidth: 0 },
  // Boxes share a row but wrap onto the next line when narrower than ~120 px.
  flexBox: { flexGrow: 1, flexBasis: 120 },
  text: { textAlign: 'center' },
  cause: { backgroundColor: color.primarySubtle, borderWidth: 2, borderColor: palette.teal[300] },
  central: { backgroundColor: color.primary, width: '100%' },
  consequence: { backgroundColor: color.accentSubtle, borderWidth: 2, borderColor: color.accent },
  arrow: { lineHeight: 16 },
});
