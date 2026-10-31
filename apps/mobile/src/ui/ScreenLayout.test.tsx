import { Text } from 'react-native';
import { render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ScreenLayout from './ScreenLayout';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => false) } }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const renderLayout = async (props: Partial<Parameters<typeof ScreenLayout>[0]> = {}) =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ScreenLayout title="Exercițiul 1 din 2" progress={0.5} onBack={() => {}} {...props}>
        {Array.from({ length: 40 }, (_, i) => (
          <Text key={i}>Paragraf lung {i}</Text>
        ))}
      </ScreenLayout>
    </SafeAreaProvider>,
  );

type Node = { parent: Node | null };

// True when `node` sits somewhere below `ancestor` in the rendered tree.
const isInside = (node: Node, ancestor: Node) => {
  for (let p = node.parent; p; p = p.parent) {
    if (p === ancestor) return true;
  }
  return false;
};

it('renders actions outside the scroll view', async () => {
  await renderLayout({ actions: <Text>Verifică</Text> });
  const scroll = screen.getByTestId('screen-scroll');
  expect(isInside(screen.getByText('Paragraf lung 39'), scroll)).toBe(true);
  expect(isInside(screen.getByText('Verifică'), scroll)).toBe(false);
  expect(isInside(screen.getByTestId('top-bar'), scroll)).toBe(false);
  expect(isInside(screen.getByText('Verifică'), screen.getByTestId('action-bar'))).toBe(true);
});

it('no action bar when actions is undefined', async () => {
  await renderLayout();
  expect(screen.queryByTestId('action-bar')).toBeNull();
});

it('progress is in the top bar', async () => {
  await renderLayout();
  expect(within(screen.getByTestId('top-bar')).getByRole('progressbar')).toBeTruthy();
});

it('renders feedback inside the action bar', async () => {
  await renderLayout({ actions: <Text>Verifică</Text>, feedback: <Text>Corect, bravo!</Text>, tone: 'good' });
  expect(isInside(screen.getByText('Corect, bravo!'), screen.getByTestId('action-bar'))).toBe(true);
});
