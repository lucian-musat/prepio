import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Card } from '@prepio/shared';
import CardStepper from './CardStepper';

// Reanimated's jest helper; the public typings only describe the no-op production stub.
const { getAnimatedStyle } = Reanimated as unknown as { getAnimatedStyle: (node: unknown) => { transform: Record<string, number | string>[] } };

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));

const card = (n: number): Card => ({ id: `c${n}`, position: n, title: `Titlu ${n}`, type: 'text', text: `Corp ${n}` });

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const frame = { title: 'Lecția', progress: 0.2, onBack: jest.fn() };

const renderStepper = async (cards: Card[], props: { onFinish?: jest.Mock; finishLabel?: string } = {}) => {
  const onFinish = props.onFinish ?? jest.fn();
  const onIndexChange = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CardStepper cards={cards} onFinish={onFinish} frame={frame} finishLabel={props.finishLabel} onIndexChange={onIndexChange} />
    </SafeAreaProvider>,
  );
  return { onFinish, onIndexChange };
};

const bar = () => within(screen.getByTestId('action-bar'));
const PREV = 'Înapoi la cartonașul anterior';
const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || !!el.props['aria-disabled'];

it('shows the first card with a counter and steps through the cards within bounds', async () => {
  const { onFinish, onIndexChange } = await renderStepper([card(1), card(2), card(3)], { finishLabel: 'La verificare' });
  expect(screen.getByText('Titlu 1')).toBeTruthy();
  expect(screen.getByText('Cartonaș 1 din 3')).toBeTruthy();

  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  expect(screen.getByText('Corp 2')).toBeTruthy();
  expect(screen.getByText('Cartonaș 2 din 3')).toBeTruthy();
  expect(onIndexChange).toHaveBeenLastCalledWith(1);

  await fireEvent.press(bar().getByRole('button', { name: PREV }));
  expect(screen.getByText('Cartonaș 1 din 3')).toBeTruthy();
  expect(onIndexChange).toHaveBeenLastCalledWith(0);

  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  expect(screen.getByText('Cartonaș 3 din 3')).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
  await fireEvent.press(bar().getByRole('button', { name: 'La verificare' }));
  expect(onFinish).toHaveBeenCalledTimes(1);
});

it('back disabled on first card', async () => {
  await renderStepper([card(1), card(2)]);
  expect(isDisabled(bar().getByRole('button', { name: PREV }))).toBe(true);
  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  expect(isDisabled(bar().getByRole('button', { name: PREV }))).toBe(false);
});

it('last card defaults to Continuă', async () => {
  const { onFinish } = await renderStepper([card(1)]);
  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  expect(onFinish).toHaveBeenCalledTimes(1);
});

it('renders the frame: title, progress and the top bar back button', async () => {
  await renderStepper([card(1)]);
  expect(screen.getByText('Lecția')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  await fireEvent.press(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Înapoi' }));
  expect(frame.onBack).toHaveBeenCalled();
});

it('renders the type chip and eyebrow with the title and body', async () => {
  await renderStepper([card(1), card(2)]);
  expect(screen.getByText('Text')).toBeTruthy();
  expect(screen.getByText('Cartonaș 1 din 2')).toBeTruthy();
  expect(screen.getByText('Titlu 1')).toBeTruthy();
  expect(screen.getByText('Corp 1')).toBeTruthy();
});

it('the two back buttons have distinct accessible names', async () => {
  await renderStepper([card(1), card(2)]);
  expect(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Înapoi' })).toBeTruthy();
  expect(bar().getByRole('button', { name: PREV })).toBeTruthy();
  expect(bar().getByText('Înapoi')).toBeTruthy();
});

describe('swipe between cards', () => {
  type PanEvent = { translationX: number; velocityX: number; pointerType: number; canceled?: boolean };
  type PanConfig = {
    enabled?: boolean;
    onBegin?: (e: PanEvent) => void;
    onUpdate?: (e: PanEvent) => void;
    onActivate?: (e: PanEvent) => void;
    onDeactivate?: (e: PanEvent) => void;
  };
  // Capture the pan the stepper registers (the global gesture mock is a no-op).
  const rngh = jest.requireMock('react-native-gesture-handler');
  const usePan = rngh.usePanGesture;
  let pan: PanConfig = {};
  beforeEach(() => {
    jest.useFakeTimers();
    rngh.usePanGesture = (config: PanConfig) => {
      pan = config;
      return {};
    };
  });
  afterEach(() => {
    rngh.usePanGesture = usePan;
    jest.useRealTimers();
  });

  // The card area reports its width (no layout pass under Jest).
  const layout = async () =>
    fireEvent(screen.getByTestId('card-swipe'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 400 } } });
  const TOUCH = 0;
  const MOUSE = 2;
  // A whole drag (begin, move, lift), then enough time for the fly-off or spring-back animation.
  const swipe = async (translationX: number, velocityX = 0, pointerType = TOUCH, canceled = false) => {
    const e = { translationX, velocityX, pointerType };
    await act(async () => {
      pan.onBegin?.(e);
      pan.onUpdate?.(e);
      pan.onDeactivate?.({ ...e, canceled });
    });
    await act(async () => jest.advanceTimersByTime(600));
  };
  const counter = (text: string) => expect(screen.getByText(text)).toBeTruthy();

  it('a left swipe goes to the next card and a right swipe back, like the buttons', async () => {
    const { onIndexChange } = await renderStepper([card(1), card(2), card(3)]);
    await layout();
    await swipe(-250);
    counter('Cartonaș 2 din 3');
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    await swipe(250);
    counter('Cartonaș 1 din 3');
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
  });

  it('a fast flick commits even when short; a slow short drag springs back', async () => {
    const { onIndexChange } = await renderStepper([card(1), card(2)]);
    await layout();
    await swipe(-30);
    counter('Cartonaș 1 din 2');
    expect(onIndexChange).not.toHaveBeenCalled();
    await swipe(-30, -900);
    counter('Cartonaș 2 din 2');
  });

  it('never goes past the ends: no previous card on the first, no finishing on the last', async () => {
    const { onIndexChange, onFinish } = await renderStepper([card(1), card(2)]);
    await layout();
    await swipe(300, 900);
    counter('Cartonaș 1 din 2');
    expect(onIndexChange).not.toHaveBeenCalled();
    await swipe(-300);
    counter('Cartonaș 2 din 2');
    await swipe(-300, -900);
    counter('Cartonaș 2 din 2');
    expect(onFinish).not.toHaveBeenCalled();
    expect(onIndexChange).toHaveBeenCalledTimes(1);
  });

  it('the card picks up where it is, without jumping by the activation distance', async () => {
    await renderStepper([card(1), card(2)]);
    await layout();
    const e = (translationX: number) => ({ translationX, velocityX: 0, pointerType: TOUCH });
    await act(async () => {
      pan.onBegin?.(e(0));
      pan.onActivate?.(e(15));
      pan.onUpdate?.(e(15));
    });
    await act(async () => jest.advanceTimersByTime(20));
    expect(getAnimatedStyle(screen.getByTestId('card-swipe')).transform[0]).toEqual({ translateX: 0 });
    await act(async () => pan.onUpdate?.(e(-45)));
    await act(async () => jest.advanceTimersByTime(20));
    expect(getAnimatedStyle(screen.getByTestId('card-swipe')).transform[0]).toEqual({ translateX: -60 });
  });

  it('a cancelled pan (system gesture, a scroll view took over) never navigates', async () => {
    const { onIndexChange } = await renderStepper([card(1), card(2)]);
    await layout();
    await swipe(-300, -900, TOUCH, true);
    counter('Cartonaș 1 din 2');
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('on web it is off for a mouse (fine pointer) and on for touch screens', async () => {
    const os = Platform.OS;
    const matchMedia = window.matchMedia;
    const media = (coarse: boolean) =>
      ((q: string) => ({ matches: (q === '(pointer: coarse)') === coarse })) as unknown as typeof window.matchMedia;
    Platform.OS = 'web';
    try {
      window.matchMedia = media(false);
      await renderStepper([card(1), card(2)]);
      expect(pan.enabled).toBe(false);
      await screen.unmount();
      window.matchMedia = media(true);
      await renderStepper([card(1), card(2)]);
      await layout();
      expect(pan.enabled).toBe(true);
      // In the gesture config itself, so web config updates keep vertical touch scrolling.
      expect(pan).toMatchObject({ touchAction: 'pan-y', userSelect: 'auto' });
      // A mouse drag on a touch device is ignored.
      await swipe(-300, -900, MOUSE);
      counter('Cartonaș 1 din 2');
    } finally {
      Platform.OS = os;
      window.matchMedia = matchMedia;
    }
  });
});

it('starts on initialIndex', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CardStepper cards={[card(1), card(2), card(3)]} onFinish={jest.fn()} frame={frame} initialIndex={1} />
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Corp 2')).toBeTruthy();
  expect(screen.getByText('Cartonaș 2 din 3')).toBeTruthy();
  expect(isDisabled(bar().getByRole('button', { name: PREV }))).toBe(false);
});

it('shows the skip action only when onSkip is given', async () => {
  const onSkip = jest.fn();
  const { rerender } = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CardStepper cards={[card(1), card(2)]} onFinish={jest.fn()} frame={frame} onSkip={onSkip} />
    </SafeAreaProvider>,
  );
  await fireEvent.press(bar().getByRole('button', { name: 'Sari la verificare' }));
  expect(onSkip).toHaveBeenCalledTimes(1);
  // Continuă is still there.
  expect(bar().getByRole('button', { name: 'Continuă' })).toBeTruthy();
  await rerender(
    <SafeAreaProvider initialMetrics={metrics}>
      <CardStepper cards={[card(1), card(2)]} onFinish={jest.fn()} frame={frame} />
    </SafeAreaProvider>,
  );
  expect(bar().queryByRole('button', { name: 'Sari la verificare' })).toBeNull();
});
