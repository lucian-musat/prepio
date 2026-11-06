import { useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputProps, type TextStyle } from 'react-native';
import { border, color, radius, space } from '@prepio/shared';
import { withAlpha } from './elevation';
import { type } from './typography';

type Props = Pick<
  TextInputProps,
  | 'inputMode'
  | 'autoComplete'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'autoFocus'
  | 'maxLength'
  | 'textContentType'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'editable'
> & {
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  placeholder: string;
  invalid?: boolean;
  /** Centred text with wide letter-spacing, for one-time codes. */
  code?: boolean;
  /** A checked answer's verdict: green / amber / red border. */
  status?: FieldStatus;
};

export type FieldStatus = 'ok' | 'almost' | 'no';
/** Border of a checked answer field (types mockup `.in.ok / .almost / .no`). */
export const STATUS_BORDER: Record<FieldStatus, string> = { ok: color.success, almost: color.accent, no: color.danger };

// Same look as TextArea: thick border, 4 px focus ring of primary at 18 % (danger when invalid).
const RING = space[1];
const RING_ALPHA = 0.18;
const ring = (tint: string) => `0px 0px 0px ${RING}px ${withAlpha(tint, RING_ALPHA)}`;

/** Single-line text field with a brand focus ring. */
export default function TextField({
  value,
  onChangeText,
  accessibilityLabel,
  placeholder,
  invalid = false,
  code = false,
  status,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  const tint = invalid ? color.danger : color.primary;
  return (
    <TextInput
      {...rest}
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel={accessibilityLabel}
      placeholder={placeholder}
      placeholderTextColor={color.textMuted}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.input,
        styles.noOutline,
        code && styles.code,
        (focused || invalid) && { borderColor: tint },
        status && { borderColor: STATUS_BORDER[status] },
        focused && { boxShadow: ring(tint) },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...type('input'),
    color: color.text,
    borderRadius: radius.lg,
    borderWidth: border.thick,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingVertical: space[3.5],
    paddingHorizontal: space[3.5],
  },
  code: { textAlign: 'center', letterSpacing: space[2] },
  // web: the ring replaces the browser focus outline (outline-style `auto` ignores a 0 width).
  noOutline: Platform.select({ web: { outlineStyle: 'none' } as unknown as TextStyle, default: {} }),
});
