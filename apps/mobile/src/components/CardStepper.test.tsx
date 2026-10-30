import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import type { Card } from '@prepio/shared';
import CardStepper from './CardStepper';

const card = (n: number, extra: Partial<Card> = {}): Card => ({
  id: `c${n}`,
  position: n,
  title: `Titlu ${n}`,
  body: `Corp ${n}`,
  imagePath: null,
  imageCredit: null,
  ...extra,
});

const renderStepper = async (cards: Card[], onFinish = jest.fn()) => {
  await render(
    <PaperProvider>
      <CardStepper cards={cards} onFinish={onFinish} />
    </PaperProvider>,
  );
  return onFinish;
};

const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || !!el.props['aria-disabled'];

it('shows the first card with a counter and steps through the cards within bounds', async () => {
  const onFinish = await renderStepper([card(1), card(2), card(3)]);
  expect(screen.getByText('Titlu 1')).toBeTruthy();
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(isDisabled(screen.getByRole('button', { name: 'Înapoi' }))).toBe(true);

  await fireEvent.press(screen.getByRole('button', { name: 'Următorul' }));
  expect(screen.getByText('Corp 2')).toBeTruthy();
  expect(screen.getByText('2 / 3')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Înapoi' }));
  expect(screen.getByText('Corp 1')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Următorul' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Următorul' }));
  expect(screen.getByText('3 / 3')).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(onFinish).toHaveBeenCalledTimes(1);
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
