import { useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextStyle } from 'react-native';
import { border, color, radius, space } from '@prepio/shared';
import { withAlpha } from './elevation';
import { type } from './typography';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  placeholder: string;
  invalid?: boolean;
};

// Prototype `.ta`: min height 150, thick border; focus ring 4 px of primary at 18 %.
const MIN_HEIGHT = 150;
const RING = space[1];
const RING_ALPHA = 0.18;

const ring = (tint: string) => `0px 0px 0px ${RING}px ${withAlpha(tint, RING_ALPHA)}`;

/** Multi-line answer field with a brand focus ring (danger border/ring when `invalid`). */
export default function TextArea({ value, onChangeText, accessibilityLabel, placeholder, invalid = false }: Props) {
  const [focused, setFocused] = useState(false);
  const tint = invalid ? color.danger : color.primary;
  return (
    <TextInput
      multiline
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel={accessibilityLabel}
      placeholder={placeholder}
      placeholderTextColor={color.textMuted}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      textAlignVertical="top"
      style={[
        styles.input,
        styles.noOutline,
        (focused || invalid) && { borderColor: tint },
        focused && { boxShadow: ring(tint) },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...type('input'),
    color: color.text,
    minHeight: MIN_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: border.thick,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space[3.5],
  },
  // web: the ring replaces the browser focus outline (outline-style `auto` ignores a 0 width).
  noOutline: Platform.select({ web: { outlineStyle: 'none' } as unknown as TextStyle, default: {} }),
});
