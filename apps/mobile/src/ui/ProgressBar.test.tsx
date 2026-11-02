import { render, screen } from '@testing-library/react-native';
import ProgressBar from './ProgressBar';

const value = () => screen.getByRole('progressbar').props.accessibilityValue;

it('exposes progress to accessibility', async () => {
  await render(<ProgressBar value={0.5} accessibilityLabel="Progres lecție" />);
  expect(value()).toEqual({ min: 0, max: 100, now: 50 });
});

it('clamps values outside 0..1', async () => {
  await render(<ProgressBar value={1.4} />);
  expect(value().now).toBe(100);
  await screen.rerender(<ProgressBar value={-1} />);
  expect(value().now).toBe(0);
});

it('is labelled "Progres" by default', async () => {
  await render(<ProgressBar value={0.5} />);
  expect(screen.getByRole('progressbar', { name: 'Progres' })).toBeTruthy();
});
