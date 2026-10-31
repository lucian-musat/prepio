import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, elevation, radius as radii, space } from '@prepio/shared';
import { solidShadow } from './elevation';

export type SpaceKey = keyof typeof space;

type Props = {
  children?: ReactNode;
  padding?: SpaceKey;
  radius?: 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** White card on the mint background (prototype B `.qcard` / `.lcard`): 1 px border, 2 px solid shadow. */
export default function Surface({ children, padding = 5, radius = 'xl', style, testID }: Props) {
  return (
    <View testID={testID} style={[styles.surface, { padding: space[padding], borderRadius: radii[radius] }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    boxShadow: solidShadow(elevation.card.offsetY, elevation.card.color),
  },
});
