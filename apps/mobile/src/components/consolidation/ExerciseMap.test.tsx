import { render, screen } from '@testing-library/react-native';
import ExerciseMap from './ExerciseMap';

const tone = { fg: '#000', bg: '#fff', edge: '#ccc' };

it('explains its colours under the dots', async () => {
  await render(<ExerciseMap items={[{ id: 'a', chip: 'Corect', tone }, { id: 'b', chip: 'Nerezolvat', tone }]} current={0} onJump={jest.fn()} />);
  expect(screen.getByTestId('map-legend', { includeHiddenElements: true })).toBeTruthy();
  for (const w of ['corect', 'aproape', 'mai lucrează', 'nerezolvat']) expect(screen.getByText(w, { includeHiddenElements: true })).toBeTruthy();
});
