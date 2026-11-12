import { fireEvent, render, screen } from '@testing-library/react-native';
import BacHint from './BacHint';

it('is collapsed with a down chevron icon, not a text triangle', async () => {
  await render(<BacHint body="Pasul unu" />);
  expect(screen.getByRole('button', { name: /Cum rezolv/ }).props.accessibilityState).toMatchObject({ expanded: false });
  expect(screen.getByTestId('bac-hint-chevron-down')).toBeTruthy();
  expect(screen.queryByText('▼')).toBeNull();
  expect(screen.queryByText('Pasul unu')).toBeNull();
});

it('opens with an up chevron and shows the body', async () => {
  await render(<BacHint body="Pasul unu" />);
  await fireEvent.press(screen.getByRole('button', { name: /Cum rezolv/ }));
  expect(screen.getByTestId('bac-hint-chevron-up')).toBeTruthy();
  expect(screen.queryByText('▲')).toBeNull();
  expect(screen.getByText('Pasul unu')).toBeTruthy();
});
