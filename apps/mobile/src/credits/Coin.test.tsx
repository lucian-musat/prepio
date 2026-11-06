import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import Coin from './Coin';

it('draws a round coin of the given size', async () => {
  await render(<Coin size={20} />);
  const s = StyleSheet.flatten(screen.getByTestId('coin', { hidden: true }).props.style);
  expect(s.width).toBe(20);
  expect(s.borderRadius).toBe(10);
});
