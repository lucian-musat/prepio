import { act, render, screen } from '@testing-library/react-native';
import { applyOverrides, resetTexts } from '../texts/store';
import ScoreRing, { fraction } from './ScoreRing';

it('labels the grade for accessibility', async () => {
  await render(<ScoreRing value={8} min={1} max={10} />);
  expect(screen.getByLabelText('Nota 8 din 10')).toBeTruthy();
});

it('counts the number up from min to the value', async () => {
  jest.useFakeTimers();
  try {
    await render(<ScoreRing value={8} min={1} max={10} />);
    expect(screen.getByText('1')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1500));
    expect(screen.getByText('8')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

it('maps the grade onto the arc fraction (8 on 1–10 fills 7/9), clamped', () => {
  expect(fraction(8, 1, 10)).toBeCloseTo(7 / 9, 10);
  expect(fraction(12, 1, 10)).toBe(1);
  expect(fraction(0, 1, 10)).toBe(0);
  expect(fraction(5, 5, 5)).toBe(1);
});

describe('texts', () => {
  afterEach(() => resetTexts());
  it('takes its default name from the texts', async () => {
    applyOverrides({ 'common.scoreRing.label': '[override] {nota}/{max}' });
    await render(<ScoreRing value={8} min={1} max={10} />);
    expect(screen.getByLabelText('[override] 8/10')).toBeTruthy();
  });
});
