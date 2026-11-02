import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { color, space } from '@prepio/shared';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ScreenLayout from './ScreenLayout';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => false) } }));

// Reanimated's jest helpers; the public typings only describe the no-op production stubs.
const { getAnimatedStyle } = Reanimated as unknown as {
  getAnimatedStyle: (node: unknown) => { opacity: number };
};

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

it('passes progressLabel down to the progress bar', async () => {
  await renderLayout({ progressLabel: 'Progres lecție' });
  expect(within(screen.getByTestId('top-bar')).getByRole('progressbar', { name: 'Progres lecție' })).toBeTruthy();
});

it('renders feedback inside the action bar', async () => {
  await renderLayout({ actions: <Text>Verifică</Text>, feedback: <Text>Corect, bravo!</Text>, tone: 'good' });
  expect(isInside(screen.getByText('Corect, bravo!'), screen.getByTestId('action-bar'))).toBe(true);
});

// ---- Fix round 1 ----

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);
const topRaised = () => flat('top-bar').borderBottomColor === color.border;
const bottomRaised = () => flat('action-bar').borderTopColor === color.border;
const scrollEl = () => screen.getByTestId('screen-scroll');
const layoutH = async (height: number) =>
  await fireEvent(scrollEl(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } });
const contentH = async (h: number) => await fireEvent(scrollEl(), 'contentSizeChange', 360, h);
const scrollTo = async (y: number) => await fireEvent.scroll(scrollEl(), { nativeEvent: { contentOffset: { x: 0, y } } });

describe('raised edges', () => {
  it('flip at the 4 px thresholds', async () => {
    await renderLayout({ actions: <Text>Verifică</Text> });
    await layoutH(500);
    await contentH(1000);
    expect([topRaised(), bottomRaised()]).toEqual([false, true]);
    await scrollTo(4);
    expect(topRaised()).toBe(false);
    await scrollTo(5);
    expect(topRaised()).toBe(true);
    await scrollTo(495); // 495 + 500 < 1000 - 4
    expect(bottomRaised()).toBe(true);
    await scrollTo(496); // 996 is not < 996
    expect([topRaised(), bottomRaised()]).toEqual([true, false]);
  });

  it('short content has no shadows', async () => {
    await renderLayout({ actions: <Text>Verifică</Text> });
    await layoutH(500);
    await contentH(300);
    expect([topRaised(), bottomRaised()]).toEqual([false, false]);
  });

  it('is not raised before the first layout (viewport height unknown)', async () => {
    await renderLayout({ actions: <Text>Verifică</Text> });
    await contentH(1000);
    expect([topRaised(), bottomRaised()]).toEqual([false, false]);
    await layoutH(500);
    expect(bottomRaised()).toBe(true);
  });

  it('no lingering raised state when content size arrives before layout', async () => {
    await renderLayout({ actions: <Text>Verifică</Text> });
    await contentH(300);
    await layoutH(500);
    expect([topRaised(), bottomRaised()]).toEqual([false, false]);
  });
});

describe('bottom safe area', () => {
  const insetMetrics = { ...metrics, insets: { ...metrics.insets, bottom: 34 } };
  const renderWithInset = async (actions?: ReactNode) =>
    await render(
      <SafeAreaProvider initialMetrics={insetMetrics}>
        <ScreenLayout title="Prepio" actions={actions}>
          <Text>Conținut</Text>
        </ScreenLayout>
      </SafeAreaProvider>,
    );
  const contentPaddingBottom = () => StyleSheet.flatten(scrollEl().props.contentContainerStyle).paddingBottom;

  it('without actions the content clears the bottom inset', async () => {
    await renderWithInset();
    expect(contentPaddingBottom()).toBe(space[6] + 34);
  });

  it('with actions the action bar handles the inset instead', async () => {
    await renderWithInset(<Text>Verifică</Text>);
    expect(contentPaddingBottom()).toBe(space[6]);
  });
});

describe('content enter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('new content starts hidden on its first render after a contentKey change', async () => {
    const page = (k: string) => (
      <SafeAreaProvider initialMetrics={metrics}>
        <ScreenLayout title="Exercițiul" contentKey={k}>
          <Text>{k}</Text>
        </ScreenLayout>
      </SafeAreaProvider>
    );
    await render(page('a'));
    await act(async () => jest.advanceTimersByTime(600));
    expect(getAnimatedStyle(screen.getByTestId('screen-content')).opacity).toBe(1);
    await screen.rerender(page('b'));
    expect(getAnimatedStyle(screen.getByTestId('screen-content')).opacity).toBe(0);
  });
});
