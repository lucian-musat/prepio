import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import type { Lesson } from '@prepio/shared';
import LessonScreen from './LessonScreen';
import { fetchLesson } from '../lib/content';

jest.mock('../lib/content', () => ({ fetchLesson: jest.fn(), imageUrl: (p: string) => `http://x/${p}` }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
  useLocalSearchParams: () => ({ id: 'l1' }),
  Stack: { Screen: () => null },
}));

const mocked = fetchLesson as jest.Mock;

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  id: 'l1',
  nodeId: 'n',
  title: 'Lecția test',
  position: 1,
  status: 'published',
  cards: [{ id: 'c1', position: 1, title: 'Cardul', body: 'Corp card', imagePath: null, imageCredit: null }],
  questions: [
    {
      id: 'q1',
      position: 1,
      type: 'single_choice',
      prompt: 'Prima întrebare?',
      difficulty: 'easy',
      explanation: null,
      options: [
        { id: 'a', text: 'Da', correct: true },
        { id: 'b', text: 'Nu', correct: false },
      ],
    },
  ],
  exercises: [{ id: 'e1', position: 1, prompt: 'Scrie un eseu', criteria: 'c' }],
  ...over,
});

const renderLesson = async (l: Lesson | null) => {
  mocked.mockResolvedValue(l);
  await render(
    <PaperProvider>
      <LessonScreen />
    </PaperProvider>,
  );
};
const press = async (name: string) => await fireEvent.press(await screen.findByRole('button', { name }));

beforeEach(() => jest.clearAllMocks());

it('shows a not-found message when the lesson is null', async () => {
  await renderLesson(null);
  expect(await screen.findByText('Lecția nu a fost găsită')).toBeTruthy();
});

it('walks cards -> questions -> exercises -> summary', async () => {
  await renderLesson(lesson());
  expect(await screen.findByText('Corp card')).toBeTruthy();
  await press('Continuă');
  expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Da'));
  await press('Verifică');
  await press('Continuă');
  expect(await screen.findByText('Scrie un eseu')).toBeTruthy();
  await press('Continuă');
  expect(await screen.findByText('1 din 1 întrebări corecte')).toBeTruthy();
  await press('Înapoi la lecții');
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('starts at questions when there are no cards', async () => {
  await renderLesson(lesson({ cards: [] }));
  expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
});

it('goes from cards to exercises when there are no questions', async () => {
  await renderLesson(lesson({ questions: [] }));
  await press('Continuă');
  expect(await screen.findByText('Scrie un eseu')).toBeTruthy();
});

it('ends at the summary when there are no exercises', async () => {
  await renderLesson(lesson({ exercises: [] }));
  await press('Continuă');
  await fireEvent.press(await screen.findByText('Nu'));
  await press('Verifică');
  await press('Continuă');
  expect(await screen.findByText('0 din 1 întrebări corecte')).toBeTruthy();
});

it('does not crash on a lesson with nothing in it', async () => {
  await renderLesson(lesson({ cards: [], questions: [], exercises: [] }));
  expect(await screen.findByText('0 din 0 întrebări corecte')).toBeTruthy();
});
