import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Card } from '@prepio/shared';
import CardStepper from './CardStepper';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));

const card = (n: number, extra: Partial<Card> = {}): Card => ({
  id: `c${n}`,
  position: n,
  title: `Titlu ${n}`,
  body: `Corp ${n}`,
  imagePath: null,
  imageCredit: null,
  ...extra,
});

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
const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || !!el.props['aria-disabled'];

it('shows the first card with a counter and steps through the cards within bounds', async () => {
  const { onFinish, onIndexChange } = await renderStepper([card(1), card(2), card(3)], { finishLabel: 'La exerciții' });
  expect(screen.getByText('Titlu 1')).toBeTruthy();
  expect(screen.getByText('Cartonaș 1 din 3')).toBeTruthy();

  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  expect(screen.getByText('Corp 2')).toBeTruthy();
  expect(screen.getByText('Cartonaș 2 din 3')).toBeTruthy();
  expect(onIndexChange).toHaveBeenLastCalledWith(1);

  await fireEvent.press(bar().getByRole('button', { name: 'Înapoi' }));
  expect(screen.getByText('Cartonaș 1 din 3')).toBeTruthy();
  expect(onIndexChange).toHaveBeenLastCalledWith(0);

  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  expect(screen.getByText('Cartonaș 3 din 3')).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
  await fireEvent.press(bar().getByRole('button', { name: 'La exerciții' }));
  expect(onFinish).toHaveBeenCalledTimes(1);
});

it('back disabled on first card', async () => {
  await renderStepper([card(1), card(2)]);
  expect(isDisabled(bar().getByRole('button', { name: 'Înapoi' }))).toBe(true);
  await fireEvent.press(bar().getByRole('button', { name: 'Continuă' }));
  expect(isDisabled(bar().getByRole('button', { name: 'Înapoi' }))).toBe(false);
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

it('renders an image with its credit; onError hides both but keeps the text', async () => {
  await renderStepper([card(1, { imagePath: 'a/b.jpg', imageCredit: 'Wikimedia' })]);
  const img = screen.getByLabelText('Titlu 1 – ilustrație');
  expect(screen.getByText('Wikimedia')).toBeTruthy();
  await fireEvent(img, 'error');
  expect(screen.queryByLabelText('Titlu 1 – ilustrație')).toBeNull();
  expect(screen.queryByText('Wikimedia')).toBeNull();
  expect(screen.getByText('Corp 1')).toBeTruthy();
});

it('renders text only when the card has no image', async () => {
  await renderStepper([card(1)]);
  expect(screen.queryByLabelText('Titlu 1 – ilustrație')).toBeNull();
  expect(screen.getByText('Corp 1')).toBeTruthy();
});
