import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import CreditChip from '../credits/CreditChip';
import StreakPill from './StreakPill';

/** The top-bar pills in a row: the streak, then the access and credits chip. `onSolve`: what the streak sheet's „Rezolvă un exercițiu” does. */
export default function HeaderPills({ need, onSolve }: { need?: number; onSolve?: () => void }) {
  return (
    <View testID="header-pills" style={styles.row}>
      <StreakPill onSolve={onSolve} />
      <CreditChip need={need} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
