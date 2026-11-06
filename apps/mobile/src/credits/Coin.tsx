import { StyleSheet, View } from 'react-native';
import { palette } from '@prepio/shared';

/** The gold coin: a yellow 500 disc with a lighter highlight at the top left and a darker rim underneath. */
export default function Coin({ size = 14 }: { size?: number }) {
  const hl = Math.round(size * 0.62);
  return (
    <View
      testID="coin"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2, borderBottomWidth: Math.max(1, Math.round(size / 14)) }]}
    >
      <View style={{ position: 'absolute', top: size * 0.12, left: size * 0.14, width: hl, height: hl, borderRadius: hl / 2, backgroundColor: palette.yellow[200], opacity: 0.85 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { backgroundColor: palette.yellow[500], borderBottomColor: palette.yellow[600] },
});
