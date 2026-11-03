import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Lesson } from '@prepio/shared';
import LessonScreen, { lessonProgress } from './LessonScreen';
import { fetchLesson } from '../lib/content';

jest.mock('../lib/content', () => ({ fetchLesson: jest.fn(), imageUrl: (p: string) => `http://x/${p}` }));
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = false;
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    back: (...a: unknown[]) => mockBack(...a),
    canGoBack: () => mockCanGoBack,
  },
  useLocalSearchParams: () => ({ id: 'l1' }),
  Stack: { Screen: () => null },
}));

const mocked = fetchLesson as jest.Mock;
const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  id: 'l1',
  nodeId: 'n',
  title: 'Lecția test',
  position: 1,
  status: 'published',
  cards: [{ id: 'c1', position: 1, title: 'Cardul', type: 'text', text: 'Corp card' }],
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
    <SafeAreaProvider initialMetrics={metrics}>
      <LessonScreen />
    </SafeAreaProvider>,
  );
};
const actionBar = () => within(screen.getByTestId('action-bar'));
const press = async (name: string) => {
  await screen.findByTestId('action-bar');
  await fireEvent.press(actionBar().getByRole('button', { name }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = false;
});

describe('lessonProgress', () => {
  const l = lesson({
    cards: [1, 2, 3].map((n) => ({ id: `c${n}`, position: n, title: null, type: 'text', text: 'b' })),
    exercises: [
      { id: 'e1', position: 1, prompt: 'p', criteria: 'c' },
      { id: 'e2', position: 2, prompt: 'p', criteria: 'c' },
    ],
  });

  it.each([
    ['cards', 0, 1 / 6],
    ['cards', 2, 3 / 6],
    ['questions', 0, 4 / 6],
    ['exercises', 0, 5 / 6],
    ['exercises', 1, 6 / 6],
    ['done', 0, 1],
  ] as const)('%s %i -> %f', (phase, index, expected) => {
    expect(lessonProgress(l, phase, index)).toBeCloseTo(expected);
  });

  it('matches the prototype (card 1 of 3, 2 exercises -> 1/5)', () => {
    expect(lessonProgress(lesson({ ...l, questions: [] }), 'cards', 0)).toBeCloseTo(1 / 5);
  });

  it('is 1 for an empty lesson', () => {
    expect(lessonProgress(lesson({ cards: [], questions: [], exercises: [] }), 'done', 0)).toBe(1);
  });
});

it('shows a not-found message when the lesson is null', async () => {
  await renderLesson(null);
  expect(await screen.findByText('Lecția nu a fost găsită')).toBeTruthy();
});

it('walks cards -> questions -> exercises -> summary', async () => {
  await renderLesson(lesson());
  expect(await screen.findByText('Corp card')).toBeTruthy();
  await press('La exerciții');
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

it('progress bar is visible on every phase', async () => {
  await renderLesson(lesson());
  expect(await screen.findByText('Corp card')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  await press('La exerciții');
  expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  await fireEvent.press(screen.getByText('Da'));
  await press('Verifică');
  await press('Continuă');
  expect(await screen.findByText('Scrie un eseu')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  await press('Continuă');
  expect(await screen.findByText('1 din 1 întrebări corecte')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
});

it('back from the lesson goes home without history', async () => {
  await renderLesson(lesson());
  expect(await screen.findByText('Corp card')).toBeTruthy();
  await fireEvent.press(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Înapoi' }));
  expect(mockReplace).toHaveBeenCalledWith('/');
  expect(mockBack).not.toHaveBeenCalled();
});

it('back from a question goes back when there is history', async () => {
  mockCanGoBack = true;
  await renderLesson(lesson({ cards: [] }));
  expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
  await fireEvent.press(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Înapoi' }));
  expect(mockBack).toHaveBeenCalledTimes(1);
});

it('loading and not-found states have a back button', async () => {
  await renderLesson(null);
  expect(await screen.findByText('Lecția nu a fost găsită')).toBeTruthy();
  expect(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Înapoi' })).toBeTruthy();
});

it('starts at questions when there are no cards', async () => {
  await renderLesson(lesson({ cards: [] }));
  expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
});

it('goes from cards to exercises when there are no questions', async () => {
  await renderLesson(lesson({ questions: [] }));
  await press('La exerciții');
  expect(await screen.findByText('Scrie un eseu')).toBeTruthy();
});

it('last card says Continuă when only the summary follows', async () => {
  await renderLesson(lesson({ questions: [], exercises: [] }));
  await press('Continuă');
  expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
  // No questions, no score line.
  expect(screen.queryByText(/întrebări corecte/)).toBeNull();
});

it('done shows the score and goes home', async () => {
  await renderLesson(lesson({ cards: [], exercises: [] }));
  await fireEvent.press(await screen.findByText('Da'));
  await press('Verifică');
  await press('Continuă');
  const content = within(await screen.findByTestId('screen-content'));
  expect(content.getByText('Ai terminat lecția!')).toBeTruthy();
  expect(content.getByText('Lecția test')).toBeTruthy();
  expect(content.getByText('1 din 1 întrebări corecte')).toBeTruthy();
  expect(screen.getByText('Lecție terminată')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  await press('Înapoi la lecții');
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('exercise skip label is Următorul exercițiu until the last one', async () => {
  await renderLesson(
    lesson({
      cards: [],
      questions: [],
      exercises: [
        { id: 'e1', position: 1, prompt: 'Primul eseu', criteria: 'c' },
        { id: 'e2', position: 2, prompt: 'Al doilea eseu', criteria: 'c' },
      ],
    }),
  );
  expect(await screen.findByText('Primul eseu')).toBeTruthy();
  expect(screen.getByText('Exercițiul 1 din 2')).toBeTruthy();
  await press('Următorul exercițiu');
  expect(await screen.findByText('Al doilea eseu')).toBeTruthy();
  await press('Continuă');
  expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
});

it('ends at the summary when there are no exercises', async () => {
  await renderLesson(lesson({ exercises: [] }));
  await press('La exerciții');
  await fireEvent.press(await screen.findByText('Nu'));
  await press('Verifică');
  await press('Continuă');
  expect(await screen.findByText('0 din 1 întrebări corecte')).toBeTruthy();
});

it('does not crash on a lesson with nothing in it', async () => {
  await renderLesson(lesson({ cards: [], questions: [], exercises: [] }));
  expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
});
