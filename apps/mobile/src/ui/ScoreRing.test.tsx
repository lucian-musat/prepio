import { render, screen } from '@testing-library/react-native';
import ScoreRing from './ScoreRing';

it('labels the grade for accessibility', async () => {
  await render(<ScoreRing value={8} min={1} max={10} />);
  expect(screen.getByLabelText('Nota 8 din 10')).toBeTruthy();
});
