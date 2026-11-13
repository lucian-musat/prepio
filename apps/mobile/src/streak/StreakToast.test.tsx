import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StreakToast from './StreakToast';
import { TOP_BAR_HEIGHT } from '../ui/TopBar';

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 30 } };

it('is anchored below the top bar (top inset + bar height), never at the bottom, and ignores touches', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StreakToast text="Bravo" />
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Bravo')).toBeTruthy();
  const wrap = StyleSheet.flatten(screen.getByTestId('streak-toast-wrap').props.style);
  expect(wrap.top).toBe(24 + TOP_BAR_HEIGHT);
  expect(wrap.bottom).toBeUndefined();
  expect(wrap.pointerEvents).toBe('none');
});
