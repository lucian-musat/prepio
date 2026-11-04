import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { border, color, palette, radius, space, stroke, type CardContent, type SchemaBox } from '@prepio/shared';
import { AppText, Enter, Icon, Reveal } from '../../ui';
import { mixColors, withAlpha } from '../../ui/elevation';
import { EXPAND_HINT, ExpandHint, hoverTransition, pointer, useExpandFeedback } from './expandable';

type Tone = 'cause' | 'central' | 'consequence';
const TEXT_COLOR = { cause: 'text', central: 'onPrimary', consequence: 'onAccent' } as const;
const DETAIL_COLOR = { cause: 'textMuted', central: 'onPrimary', consequence: 'onAccent' } as const;

// The "+" badge of a box with a detail, in the box's tone; it turns 45° into "×" when the box is open.
const BADGE = space[5.5]; // 22 px circle
const BADGE_ICON = space[3.5]; // 14 px glyph
const BADGE_OUTSET = space[1]; // sits over the corner
const BADGE_LOOK = {
  cause: { bg: color.primary, fg: color.onPrimary },
  central: { bg: color.onPrimary, fg: color.primary },
  consequence: { bg: color.accent, fg: color.onAccent },
} as const;
const DIVIDER = { cause: palette.teal[300], central: withAlpha(color.onPrimary, 0.4), consequence: color.accent } as const;
const HOVER_BG = {
  cause: mixColors(color.primary, color.primarySubtle, 0.08),
  central: color.primaryStrong,
  consequence: mixColors(color.accent, color.accentSubtle, 0.3),
} as const;

function Badge({ tone, turn }: { tone: Tone; turn: SharedValue<number> }) {
  const look = BADGE_LOOK[tone];
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 45}deg` }] }));
  return (
    <Animated.View
      testID="schema-badge"
      style={[styles.badge, { backgroundColor: look.bg }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="plus" size={BADGE_ICON} stroke={stroke.iconBold} tint={look.fg} />
    </Animated.View>
  );
}

function BoxText({ box, tone }: { box: SchemaBox; tone: Tone }) {
  return (
    <AppText role="label" color={TEXT_COLOR[tone]} style={styles.text}>
      {box.text}
    </AppText>
  );
}

/** A box with a detail: a button with a "+" badge; the detail opens inside the box under a thin divider. */
function ExpandableBox({ box, tone, detail }: { box: SchemaBox; tone: Tone; detail: string }) {
  const [expanded, setExpanded] = useState(false);
  const { hovered, turn, pressStyle, handlers } = useExpandFeedback(expanded);
  return (
    // Static Pressable around an Animated.View (like OptionRow). The label replaces the children for screen
    // readers, so it carries the detail once expanded. aria-expanded, not accessibilityState: react-native-web
    // 0.21 drops the latter; native maps both.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? `${box.text}. ${detail}` : box.text}
      accessibilityHint={EXPAND_HINT}
      aria-expanded={expanded}
      onPress={() => setExpanded((e) => !e)}
      {...handlers}
      style={[pointer, tone !== 'central' && styles.flexBox]}
    >
      <Animated.View style={[styles.box, styles.boxTap, styles[tone], hoverTransition, hovered && { backgroundColor: HOVER_BG[tone] }, pressStyle]}>
        <BoxText box={box} tone={tone} />
        <Reveal open={expanded}>
          <View style={[styles.detail, { borderTopColor: DIVIDER[tone] }]}>
            <AppText role="caption" color={DETAIL_COLOR[tone]} style={styles.text}>
              {detail}
            </AppText>
          </View>
        </Reveal>
        <Badge tone={tone} turn={turn} />
      </Animated.View>
    </Pressable>
  );
}

function Box({ box, tone }: { box: SchemaBox; tone: Tone }) {
  if (box.detail) return <ExpandableBox box={box} tone={tone} detail={box.detail} />;
  const style: StyleProp<ViewStyle> = [styles.box, styles[tone], tone !== 'central' && styles.flexBox];
  return (
    <View style={style}>
      <BoxText box={box} tone={tone} />
    </View>
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
  const expandable = [...content.causes, content.central, ...content.consequences].some((b) => b.detail);
  return (
    <Enter index={0} style={styles.root}>
      {expandable ? <ExpandHint text="Atinge căsuțele cu + pentru detalii" /> : null}
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
  // Room for the badge on both sides, so the centred text never runs under it; fills the stretched pressable.
  boxTap: { paddingHorizontal: space[5], flexGrow: 1 },
  // Boxes share a row but wrap onto the next line when narrower than ~120 px.
  flexBox: { flexGrow: 1, flexBasis: 120 },
  text: { textAlign: 'center' },
  cause: { backgroundColor: color.primarySubtle, borderWidth: 2, borderColor: palette.teal[300] },
  central: { backgroundColor: color.primary, width: '100%' },
  consequence: { backgroundColor: color.accentSubtle, borderWidth: 2, borderColor: color.accent },
  detail: { borderTopWidth: border.hairline, paddingTop: space[1.5], marginTop: space[1] },
  badge: {
    position: 'absolute',
    top: -BADGE_OUTSET,
    right: -BADGE_OUTSET,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { lineHeight: 16 },
});
