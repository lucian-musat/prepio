import { StyleSheet, View } from 'react-native';
import { space } from '@prepio/shared';
import { AppText, Spinner } from '../../ui';

/** While the paper is being graded: a spinner and „Corectăm lucrarea…”. */
export default function BacGradingView() {
  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <Spinner />
      <AppText role="section" accessibilityRole="header">
        Corectăm lucrarea…
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space[4], marginTop: space[12] },
});
