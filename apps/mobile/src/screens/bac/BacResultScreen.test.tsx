import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BAC_GRADE_NOTE, type BacItemResult } from '@prepio/shared';
import { fetchLatestGraded, fetchOpenAttempt, type BacAttemptView } from '../../lib/bac';
import BacResultScreen from './BacResultScreen';

jest.mock('../../lib/bac', () => ({ ...jest.requireActual('../../lib/bac'), fetchLatestGraded: jest.fn(), fetchOpenAttempt: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: 's1' }),
}));
const mockedGraded = fetchLatestGraded as jest.Mock;
const mockedOpen = fetchOpenAttempt as jest.Mock;

const r = (section: 1 | 2 | 3, number: number, points: number, max: number, feedback = ''): BacItemResult => ({
  itemId: `i${section}-${number}`,
  section,
  number,
  points,
  max,
  feedback,
});
const graded = (results: BacItemResult[], grade = 8.4): BacAttemptView => ({
  id: 'att1',
  status: 'graded',
  answers: {},
  position: null,
  points: 74,
  grade,
  results,
  gradedAt: '2026-11-09T10:00:00Z',
});

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const mount = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BacResultScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockedOpen.mockResolvedValue(null);
});

it('lists only the items below full marks, by section and number, with their points', async () => {
  mockedGraded.mockResolvedValue(
    graded([
      r(3, 1, 20, 30, 'Punctul de vedere nu e susținut de un fapt istoric.'),
      r(2, 6, 4, 6, 'Lipsesc conectorii de concluzie.'),
      r(1, 1, 2, 2),
      r(1, 5, 3, 7, 'Ai inversat cauza cu efectul.'),
    ]),
  );
  await mount();
  expect(await screen.findByText('8,40')).toBeTruthy();
  expect(screen.getByText('Nota ta')).toBeTruthy();
  expect(screen.getByText(BAC_GRADE_NOTE)).toBeTruthy();
  expect(screen.getByText('De lucrat')).toBeTruthy();
  expect(screen.getAllByTestId('bac-result-row')).toHaveLength(3);
  expect(screen.getByText('I.5: Ai inversat cauza cu efectul.')).toBeTruthy();
  expect(screen.getByText('3 / 7 p')).toBeTruthy();
  expect(screen.getByText('II.6: Lipsesc conectorii de concluzie.')).toBeTruthy();
  expect(screen.getByText('III: Punctul de vedere nu e susținut de un fapt istoric.')).toBeTruthy();
  expect(screen.queryByText(/^I\.1 —/)).toBeNull();
  expect(screen.queryByText(/Felicitări/)).toBeNull();
});

it('full marks everywhere: „Felicitări! …”', async () => {
  mockedGraded.mockResolvedValue(graded([r(1, 1, 2, 2), r(3, 1, 30, 30)], 10));
  await mount();
  expect(await screen.findByText('Felicitări! Ai luat punctajul maxim la toate cerințele.')).toBeTruthy();
  expect(screen.queryByText('De lucrat')).toBeNull();
  expect(screen.getByText('10,00')).toBeTruthy();
});

it('„Reia subiectul” says it needs more credits and opens an empty paper', async () => {
  mockedGraded.mockResolvedValue(graded([r(1, 5, 3, 7, 'Ai inversat cauza cu efectul.')]));
  await mount();
  expect(await screen.findByText('Dacă reiei subiectul, corectarea costă din nou credite.')).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Reia subiectul' })));
  expect(router.replace).toHaveBeenCalledWith('/bac/s1');
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Înapoi la subiecte' })));
  expect(router.back).toHaveBeenCalled();
});

it('no text contains „AI” or „plătește”', async () => {
  mockedGraded.mockResolvedValue(graded([r(1, 5, 3, 7, 'Ai inversat cauza cu efectul.'), r(3, 1, 30, 30)]));
  await mount();
  await screen.findByText('8,40');
  const text = JSON.stringify(screen.toJSON());
  expect(text).not.toMatch(/\bAI\b/);
  expect(text).not.toMatch(/plătește/i);
});

it('without a graded attempt it says so', async () => {
  mockedGraded.mockResolvedValue(null);
  await mount();
  expect(await screen.findByText('Nu ai încă un rezultat la acest subiect.')).toBeTruthy();
});

it('shows the subtotal of each Subiect, the date and the ex officio points', async () => {
  mockedGraded.mockResolvedValue(graded([r(1, 1, 2, 2), r(1, 5, 3, 7), r(2, 6, 4, 6), r(3, 1, 20, 30)]));
  await mount();
  await screen.findByText('8,40');
  expect(screen.getByText('Subiectul I · 5 / 9 p')).toBeTruthy();
  expect(screen.getByText('Subiectul II · 4 / 6 p')).toBeTruthy();
  expect(screen.getByText('Subiectul III · 20 / 30 p')).toBeTruthy();
  expect(screen.getByText('Corectată pe 9 noiembrie 2026 · include 10 puncte din oficiu')).toBeTruthy();
});

it('with a paper already in progress it offers to continue it, not a new retake', async () => {
  mockedGraded.mockResolvedValue(graded([r(1, 5, 3, 7, 'Ai inversat cauza cu efectul.')]));
  mockedOpen.mockResolvedValue({ ...graded([]), id: 'att2', status: 'draft', grade: null, results: null, gradedAt: null });
  await mount();
  await screen.findByText('8,40');
  expect(screen.queryByRole('button', { name: 'Reia subiectul' })).toBeNull();
  expect(screen.queryByText('Dacă reiei subiectul, corectarea costă din nou credite.')).toBeNull();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Continuă lucrarea începută' })));
  expect(router.replace).toHaveBeenCalledWith('/bac/s1');
});
