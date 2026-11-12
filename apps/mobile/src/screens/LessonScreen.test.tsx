import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Lesson, LessonSummary } from '@prepio/shared';
import LessonScreen, { SKIP_CONFIRM, SKIP_MESSAGE, lessonProgress } from './LessonScreen';
import { fetchHome, fetchLesson } from '../lib/content';
import { fetchProgress, markFinished, savePosition, type LessonPosition } from '../lib/progress';
import { consolidationSummary } from '../lib/consolidation';
import { AUTH_TIMEOUT_MS } from '../lib/supabase';
import { logTestFailed } from '../lib/activity';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../lib/content', () => ({
  fetchLesson: jest.fn(),
  fetchHome: jest.fn(),
  imageUrl: (p: string) => `http://x/${p}`,
}));
jest.mock('../lib/progress', () => ({ fetchProgress: jest.fn(), savePosition: jest.fn(), markFinished: jest.fn() }));
jest.mock('../lib/consolidation', () => ({ consolidationSummary: jest.fn() }));
jest.mock('../lib/activity', () => ({ logTestFailed: jest.fn() }));
let mockCanOpen = (_id: string) => true;
jest.mock('../access/AccessProvider', () => ({
  useAccess: () => ({ canOpen: (id: string) => mockCanOpen(id), status: { plan: 'trial' }, isAdmin: false }),
}));
jest.mock('../credits/CreditsProvider', () => ({ useCredits: () => ({ balance: 7, change: null }) }));
let mockMode: 'guided' | 'free' = 'free';
jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'u1', displayName: 'ana', learningMode: mockMode } }),
}));
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = false;
let mockId = 'l1';
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    push: (...a: unknown[]) => mockPush(...a),
    back: (...a: unknown[]) => mockBack(...a),
    canGoBack: () => mockCanGoBack,
  },
  useLocalSearchParams: () => ({ id: mockId }),
  Stack: { Screen: () => null },
}));

const mockedLesson = fetchLesson as jest.Mock;
const mockedHome = fetchHome as jest.Mock;
const mockedProgress = fetchProgress as jest.Mock;
const mockedSave = savePosition as jest.Mock;
const mockedFinish = markFinished as jest.Mock;
const mockedSummary = consolidationSummary as jest.Mock;
// Most tests only care about the number of exercises.
const mockedCount = {
  mockResolvedValue: (count: number) => mockedSummary.mockResolvedValue({ count, correct: 0, done: 0 }),
  mockRejectedValue: (e: unknown) => mockedSummary.mockRejectedValue(e),
};
const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const question = (n: number) => ({
  id: `q${n}`,
  position: n,
  type: 'single_choice' as const,
  prompt: n === 1 ? 'Prima întrebare?' : `Întrebarea numărul ${n}?`,
  difficulty: 'easy' as const,
  explanation: null,
  options: [
    { id: 'a', text: 'Da', correct: true },
    { id: 'b', text: 'Nu', correct: false },
  ],
});

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  id: 'l1',
  nodeId: 'n',
  title: 'Lecția test',
  position: 1,
  status: 'published',
  cards: [{ id: 'c1', position: 1, title: 'Cardul', type: 'text', text: 'Corp card' }],
  questions: [question(1)],
  ...over,
});

const summary = (id: string, title: string, position: number): LessonSummary => ({ id, nodeId: 'n', title, position });
const homeOf = (...lessons: LessonSummary[]) => ({ welcomeMessage: '', sections: [{ path: ['A'], lessons }] });
const twoLessons = homeOf(summary('l1', 'Lecția test', 1), summary('l2', 'Lecția doi', 2));
const progressOf = (finished: string[] = [], positions: Record<string, LessonPosition> = {}) => ({
  finished: new Set(finished),
  positions: new Map(Object.entries(positions)),
});

const renderLesson = async (l: Lesson | null) => {
  mockedLesson.mockResolvedValue(l);
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
const SKIP = 'Știu deja — sari la verificare';
/** Presses a skip link (start screen or cards) and confirms the dialog. */
const skip = async (name: string = SKIP) => {
  await press(name);
  await fireEvent.press(await screen.findByRole('button', { name: SKIP_CONFIRM }));
};
/** Opens the lesson and leaves the start screen with the given button (the skip is confirmed). */
const openLesson = async (l: Lesson | null, start = 'Începe învățarea') => {
  await renderLesson(l);
  await screen.findByText(SKIP);
  await (start === SKIP ? skip() : press(start));
};
const answer = async (text: 'Da' | 'Nu', next: string) => {
  await fireEvent.press(await screen.findByText(text));
  await press('Verifică');
  await press(next);
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockCanOpen = () => true;
  mockCanGoBack = false;
  mockMode = 'free';
  mockId = 'l1';
  mockedHome.mockResolvedValue(twoLessons);
  mockedProgress.mockResolvedValue(progressOf());
  mockedSave.mockResolvedValue(undefined);
  mockedFinish.mockResolvedValue(undefined);
  mockedCount.mockResolvedValue(0);
  (logTestFailed as jest.Mock).mockResolvedValue(true);
});

describe('lessonProgress', () => {
  const l = lesson({
    cards: [1, 2, 3].map((n) => ({ id: `c${n}`, position: n, title: null, type: 'text', text: 'b' })),
  });

  it.each([
    ['cards', 0, 1 / 4],
    ['cards', 2, 3 / 4],
    ['questions', 0, 4 / 4],
    ['done', 0, 1],
  ] as const)('%s %i -> %f', (phase, index, expected) => {
    expect(lessonProgress(l, phase, index)).toBeCloseTo(expected);
  });

  it('is 1 for an empty lesson', () => {
    expect(lessonProgress(lesson({ cards: [], questions: [] }), 'done', 0)).toBe(1);
  });
});

describe('loading', () => {
  it('shows a not-found message when the lesson is null', async () => {
    await renderLesson(null);
    expect(await screen.findByText('Lecția nu a fost găsită')).toBeTruthy();
    expect(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Înapoi' })).toBeTruthy();
  });

  it('a failed progress fetch shows the load error, and Reîncearcă loads again', async () => {
    mockedProgress.mockRejectedValueOnce(new Error('offline'));
    await renderLesson(lesson());
    expect(await screen.findByText('Nu am putut încărca lecția')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reîncearcă' }));
    expect(await screen.findByText('Știu deja — sari la verificare')).toBeTruthy();
    expect(mockedProgress).toHaveBeenCalledTimes(2);
  });

  it('guided: a locked lesson cannot be opened', async () => {
    mockMode = 'guided';
    mockId = 'l2';
    await renderLesson(lesson({ id: 'l2', title: 'Lecția doi' }));
    expect(await screen.findByText('Lecția este blocată')).toBeTruthy();
    expect(screen.getByText('Termină mai întâi lecțiile de dinainte, în ordine.')).toBeTruthy();
    expect(screen.queryByText('Începe învățarea')).toBeNull();
  });

  it('free: the same lesson is open', async () => {
    mockId = 'l2';
    await renderLesson(lesson({ id: 'l2', title: 'Lecția doi' }));
    expect(await screen.findByText('Începe învățarea')).toBeTruthy();
  });
});

describe('start screen', () => {
  it('shows the title, the counts and both buttons; guided explains passing', async () => {
    mockMode = 'guided';
    await renderLesson(lesson());
    const content = within(await screen.findByTestId('screen-content'));
    expect(content.getByText('Lecția test')).toBeTruthy();
    expect(content.getByText('Învățare')).toBeTruthy();
    expect(content.getByText('1 card')).toBeTruthy();
    expect(content.getByText('Verificare')).toBeTruthy();
    expect(content.getByText('1 întrebare')).toBeTruthy();
    expect(content.queryByText('Consolidare')).toBeNull(); // no consolidation exercises
    expect(content.getByText('Dacă răspunzi corect la toate, treci la lecția următoare.')).toBeTruthy();
    expect(actionBar().getByRole('button', { name: 'Începe învățarea' })).toBeTruthy();
    expect(actionBar().getByRole('button', { name: 'Știu deja — sari la verificare' })).toBeTruthy();
    expect(screen.queryByText('Continuă de unde ai rămas')).toBeNull();
  });

  it('shows the plan and credits pill in the top bar', async () => {
    await renderLesson(lesson());
    await screen.findByText(SKIP);
    expect(within(screen.getByTestId('top-bar')).getByLabelText('Perioadă de probă, 7 credite, deschide accesul')).toBeTruthy();
  });

  it('pluralises the counts and has no guided line in free mode', async () => {
    await renderLesson(
      lesson({
        cards: [1, 2].map((n) => ({ id: `c${n}`, position: n, title: null, type: 'text', text: 'b' })),
      }),
    );
    expect(await screen.findByText('2 carduri')).toBeTruthy();
    expect(screen.queryByText('Dacă răspunzi corect la toate, treci la lecția următoare.')).toBeNull();
  });

  it('Începe învățarea opens the first card', async () => {
    await openLesson(lesson());
    expect(await screen.findByText('Corp card')).toBeTruthy();
  });

  it('the cards offer a skip to the test when there is one', async () => {
    await openLesson(lesson());
    expect(await screen.findByText('Corp card')).toBeTruthy();
    await skip('Sari la verificare');
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
  });

  it('the cards have no skip when the lesson has no test', async () => {
    await openLesson(lesson({ questions: [] }));
    expect(await screen.findByText('Corp card')).toBeTruthy();
    expect(actionBar().queryByRole('button', { name: 'Sari la verificare' })).toBeNull();
  });

  it('skipping goes straight to question 1', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
    expect(screen.getByText('Întrebarea 1 din 1')).toBeTruthy();
  });

  it('skipping asks first and explains guided mode; Anulează stays on the start screen', async () => {
    mockMode = 'guided';
    await renderLesson(lesson());
    await screen.findByText(SKIP);
    await press(SKIP);
    expect(await screen.findByText('Sari la verificare?')).toBeTruthy();
    expect(screen.getByText(SKIP_MESSAGE.guided)).toBeTruthy();
    expect(mockedSave).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Anulează' }));
    expect(screen.queryByText('Sari la verificare?')).toBeNull();
    expect(screen.queryByText('Prima întrebare?')).toBeNull();
    expect(actionBar().getByRole('button', { name: 'Începe învățarea' })).toBeTruthy();
  });

  it('the skip dialog explains free mode', async () => {
    await renderLesson(lesson());
    await screen.findByText(SKIP);
    await press(SKIP);
    expect(await screen.findByText(SKIP_MESSAGE.free)).toBeTruthy();
  });

  it('skipping from the cards asks too; Anulează keeps the card', async () => {
    await openLesson(lesson());
    expect(await screen.findByText('Corp card')).toBeTruthy();
    await press('Sari la verificare');
    await fireEvent.press(await screen.findByRole('button', { name: 'Anulează' }));
    expect(screen.getByText('Corp card')).toBeTruthy();
    expect(screen.queryByText('Prima întrebare?')).toBeNull();
  });

  it('a lesson without cards hides Începe învățarea', async () => {
    await renderLesson(lesson({ cards: [] }));
    expect(await screen.findByText('Știu deja — sari la verificare')).toBeTruthy();
    expect(screen.queryByText('Începe învățarea')).toBeNull();
  });
});

describe('free mode', () => {
  it('walks cards -> questions -> summary', async () => {
    await openLesson(lesson());
    expect(await screen.findByText('Corp card')).toBeTruthy();
    await press('La verificare');
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
    await answer('Da', 'Continuă');
    expect(await screen.findByText('1 din 1 întrebări corecte')).toBeTruthy();
    expect(mockedFinish).toHaveBeenCalledWith('l1');
    await press('Înapoi la lecții');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('a wrong answer in free mode logs no failed test', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Nu', 'Continuă');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
    expect(logTestFailed).not.toHaveBeenCalled();
  });

  it('a wrong answer still finishes the lesson', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Nu', 'Continuă');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
    expect(screen.getByText('0 din 1 întrebări corecte')).toBeTruthy();
    expect(mockedFinish).toHaveBeenCalledWith('l1');
  });

  it('progress bar is visible on every phase', async () => {
    await openLesson(lesson());
    expect(await screen.findByText('Corp card')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    await press('La verificare');
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    await answer('Da', 'Continuă');
    expect(await screen.findByText('1 din 1 întrebări corecte')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('done shows the score and goes home', async () => {
    await openLesson(lesson({ cards: [] }), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    const content = within(await screen.findByTestId('screen-content'));
    expect(await content.findByText('Ai terminat lecția!')).toBeTruthy();
    expect(content.getByText('Lecția test')).toBeTruthy();
    expect(content.getByText('1 din 1 întrebări corecte')).toBeTruthy();
    expect(screen.getByText('Lecție terminată')).toBeTruthy();
    await press('Înapoi la lecții');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('last card says Continuă when only the summary follows', async () => {
    await openLesson(lesson({ questions: [] }));
    await press('Continuă');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
    expect(screen.queryByText(/întrebări corecte/)).toBeNull();
  });

  it('does not crash on a lesson with nothing in it', async () => {
    await openLesson(lesson({ cards: [], questions: [] }), 'Știu deja — sari la verificare');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
  });

  it('a failed markFinished shows the error and Reîncearcă retries the write', async () => {
    mockedFinish.mockRejectedValueOnce(new Error('Progresul nu a putut fi salvat. Încearcă din nou.'));
    await openLesson(lesson({ cards: [], questions: [] }), 'Știu deja — sari la verificare');
    expect(await screen.findByText('Progresul nu a putut fi salvat. Încearcă din nou.')).toBeTruthy();
    expect(screen.queryByText('Ai terminat lecția!')).toBeNull();
    await press('Reîncearcă');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
    expect(mockedFinish).toHaveBeenCalledTimes(2);
  });
});

describe('stalled progress writes', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('a markFinished that never settles shows the save error after the timeout', async () => {
    jest.useFakeTimers();
    mockedFinish.mockReturnValueOnce(new Promise(() => {}));
    await openLesson(lesson({ cards: [], questions: [] }), 'Știu deja — sari la verificare');
    expect(screen.queryByText('Ai terminat lecția!')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(AUTH_TIMEOUT_MS);
    });
    expect(await screen.findByText('Progresul nu a putut fi salvat. Încearcă din nou.')).toBeTruthy();
    await press('Reîncearcă');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
  });

  it('a hung position save does not hold the finished mark back forever', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockMode = 'guided';
    mockedSave
      .mockResolvedValueOnce(undefined) // entering question 1
      .mockReturnValueOnce(new Promise(() => {})); // the „Verifică” save hangs
    await openLesson(lesson({ cards: [] }), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(mockedFinish).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(AUTH_TIMEOUT_MS);
    });
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(mockedFinish).toHaveBeenCalledWith('l1');
    expect(warn).toHaveBeenCalledWith('Could not save the lesson position', expect.anything());
    warn.mockRestore();
  });
});

describe('back', () => {
  it('back from the lesson goes home without history', async () => {
    await openLesson(lesson());
    expect(await screen.findByText('Corp card')).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Înapoi' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('back from a question goes back when there is history', async () => {
    mockCanGoBack = true;
    await openLesson(lesson({ cards: [] }), 'Știu deja — sari la verificare');
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Înapoi' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('saving the position', () => {
  it('saves card changes, and answers', async () => {
    await openLesson(
      lesson({
        cards: [1, 2].map((n) => ({ id: `c${n}`, position: n, title: null, type: 'text', text: `Corp ${n}` })),
      }),
    );
    expect(mockedSave).toHaveBeenLastCalledWith('l1', { phase: 'cards', index: 0, results: {} });
    await press('Continuă');
    expect(mockedSave).toHaveBeenLastCalledWith('l1', { phase: 'cards', index: 1, results: {} });
    await press('La verificare');
    expect(mockedSave).toHaveBeenLastCalledWith('l1', { phase: 'questions', index: 0, results: {} });
    await fireEvent.press(await screen.findByText('Nu'));
    await press('Verifică');
    expect(mockedSave).toHaveBeenLastCalledWith('l1', { phase: 'questions', index: 0, results: { q1: false } });
  });

  it('a failed save is logged and the lesson goes on', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedSave.mockRejectedValue(new Error('offline'));
    await openLesson(lesson());
    expect(await screen.findByText('Corp card')).toBeTruthy();
    await press('La verificare');
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('guided mode', () => {
  beforeEach(() => {
    mockMode = 'guided';
  });

  it('all correct finishes the lesson, unlocks the next one and opens it', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(mockedFinish).toHaveBeenCalledWith('l1');
    expect(screen.getByText('Ai deblocat: Lecția doi')).toBeTruthy();
    await press('Mergi la lecția următoare');
    expect(mockReplace).toHaveBeenCalledWith('/lesson/l2');
  });

  it('trial: passing the free lesson claims no unlock and offers no button into the paywalled lesson', async () => {
    mockCanOpen = (id) => id === 'l1';
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(screen.queryByText(/Ai deblocat/)).toBeNull();
    expect(screen.queryByText('Mergi la lecția următoare')).toBeNull();
    expect(actionBar().getByRole('button', { name: 'Înapoi acasă' })).toBeTruthy();
  });

  it('Înapoi acasă goes home from the passed screen', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    await press('Înapoi acasă');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('a wrong answer fails: lists the question, clears the position, does not finish', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Nu', 'Continuă');
    expect(await screen.findByText('Aproape!')).toBeTruthy();
    expect(screen.getByText('Rezultatul testului')).toBeTruthy();
    expect(screen.getByText('Ai greșit la:')).toBeTruthy();
    // Each mistake opens in place with the right answer.
    const row = screen.getByRole('button', { name: 'Întrebarea 1 · Prima întrebare?' });
    expect(screen.queryByText('Răspuns corect: Da')).toBeNull();
    await fireEvent.press(row);
    expect(screen.getByText('Răspuns corect: Da')).toBeTruthy();
    expect(screen.getByLabelText('0 din 1 întrebări corecte')).toBeTruthy();
    expect(
      screen.getByText(
        'Ca să treci mai departe, ai nevoie de toate răspunsurile corecte. Revezi cardurile și încearcă din nou.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('0 din 1 întrebări corecte')).toBeTruthy();
    expect(mockedFinish).not.toHaveBeenCalled();
    expect(mockedSave).toHaveBeenLastCalledWith('l1', null);
  });

  it('a failed attempt logs the failed test once, after the position is cleared; a second failed attempt logs again', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Nu', 'Continuă');
    expect(await screen.findByText('Aproape!')).toBeTruthy();
    await waitFor(() => expect(logTestFailed).toHaveBeenCalledTimes(1));
    expect(logTestFailed).toHaveBeenCalledWith('l1');
    expect(mockedSave.mock.invocationCallOrder.at(-1)!).toBeLessThan((logTestFailed as jest.Mock).mock.invocationCallOrder[0]);
    await press('Reia testul acum');
    await answer('Nu', 'Continuă');
    expect(await screen.findByText('Aproape!')).toBeTruthy();
    await waitFor(() => expect(logTestFailed).toHaveBeenCalledTimes(2));
  });

  it('a passed attempt does not log a failed test', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(logTestFailed).not.toHaveBeenCalled();
  });

  it('Reia testul acum shows question 1 unanswered', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Nu', 'Continuă');
    await press('Reia testul acum');
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
    expect(actionBar().getByRole('button', { name: 'Verifică' })).toBeTruthy();
    expect(mockedSave).toHaveBeenLastCalledWith('l1', { phase: 'questions', index: 0, results: {} });
    // A correct retake now passes.
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
  });

  it('Revezi cardurile shows card 1', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Nu', 'Continuă');
    await press('Revezi cardurile');
    expect(await screen.findByText('Corp card')).toBeTruthy();
    expect(screen.getByText('Card 1 din 1')).toBeTruthy();
  });

  it('resumes a saved position with its answers', async () => {
    mockedProgress.mockResolvedValue(
      progressOf([], { l1: { phase: 'questions', index: 1, results: { q1: true } } }),
    );
    await renderLesson(lesson({ questions: [question(1), question(2)] }));
    await screen.findByText('Continuă de unde ai rămas');
    await press('Continuă de unde ai rămas');
    expect(await screen.findByText('Întrebarea numărul 2?')).toBeTruthy();
    expect(screen.getByText('Întrebarea 2 din 2')).toBeTruthy();
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(mockedFinish).toHaveBeenCalledWith('l1');
  });

  it('resumes on the saved card', async () => {
    mockedProgress.mockResolvedValue(progressOf([], { l1: { phase: 'cards', index: 1, results: {} } }));
    await renderLesson(
      lesson({ cards: [1, 2].map((n) => ({ id: `c${n}`, position: n, title: null, type: 'text', text: `Corp ${n}` })) }),
    );
    await screen.findByText('Continuă de unde ai rămas');
    await press('Continuă de unde ai rămas');
    expect(await screen.findByText('Corp 2')).toBeTruthy();
  });

  it('starting fresh ignores the saved answers', async () => {
    mockedProgress.mockResolvedValue(
      progressOf([], { l1: { phase: 'questions', index: 1, results: { q1: true } } }),
    );
    await renderLesson(lesson({ questions: [question(1), question(2)] }));
    await screen.findByText('Continuă de unde ai rămas');
    await skip();
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
    expect(mockedSave).toHaveBeenLastCalledWith('l1', { phase: 'questions', index: 0, results: {} });
    // q2 alone is not enough: the saved q1 answer is gone, so the attempt fails on question 1.
    await answer('Nu', 'Următoarea întrebare');
    await answer('Da', 'Continuă');
    expect(await screen.findByRole('button', { name: 'Întrebarea 1 · Prima întrebare?' })).toBeTruthy();
  });

  it('Revezi cardurile, then skipping from the cards starts a fresh test', async () => {
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Nu', 'Continuă');
    await press('Revezi cardurile');
    expect(await screen.findByText('Corp card')).toBeTruthy();
    await skip('Sari la verificare');
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
    expect(actionBar().getByRole('button', { name: 'Verifică' })).toBeTruthy();
    expect(mockedSave).toHaveBeenLastCalledWith('l1', { phase: 'questions', index: 0, results: {} });
  });

  it('waits for a pending position save before writing the finished mark', async () => {
    let settle: () => void = () => {};
    mockedSave
      .mockResolvedValueOnce(undefined) // entering question 1
      .mockReturnValueOnce(new Promise<void>((r) => (settle = r))); // the „Verifică” save, still in flight
    await openLesson(lesson({ cards: [] }), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(mockedFinish).not.toHaveBeenCalled();
    await act(async () => settle());
    expect(mockedFinish).toHaveBeenCalledWith('l1');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
  });

  it('a new route id (next lesson) loads it afresh and shows its start screen', async () => {
    mockedLesson.mockImplementation(async (id: string) =>
      id === 'l2' ? lesson({ id: 'l2', title: 'Lecția doi', cards: [] }) : lesson(),
    );
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LessonScreen />
      </SafeAreaProvider>,
    );
    await screen.findByText('Știu deja — sari la verificare');
    await skip();
    await answer('Da', 'Continuă');
    await press('Mergi la lecția următoare');
    expect(mockReplace).toHaveBeenCalledWith('/lesson/l2');
    // The router keeps the screen mounted and only changes the param.
    mockId = 'l2';
    mockedProgress.mockResolvedValue(progressOf(['l1'])); // l1 is finished now, so l2 is the current lesson
    await screen.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <LessonScreen />
      </SafeAreaProvider>,
    );
    expect(await screen.findByText('0 carduri')).toBeTruthy();
    expect(within(screen.getByTestId('screen-content')).getByText('Lecția doi')).toBeTruthy();
    expect(mockedLesson).toHaveBeenLastCalledWith('l2');
    expect(mockedProgress).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Lecție terminată! 🎉')).toBeNull();
  });

  it('the last lesson passed only offers Home', async () => {
    mockedHome.mockResolvedValue(homeOf(summary('l1', 'Lecția test', 1)));
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(screen.queryByText('Mergi la lecția următoare')).toBeNull();
    expect(screen.queryByText(/Ai deblocat/)).toBeNull();
    expect(actionBar().getByRole('button', { name: 'Înapoi acasă' })).toBeTruthy();
  });

  it('redoing a finished lesson: no unlock line, but the next lesson is offered', async () => {
    mockedProgress.mockResolvedValue(progressOf(['l1']));
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(screen.queryByText(/Ai deblocat/)).toBeNull();
    expect(actionBar().getByRole('button', { name: 'Mergi la lecția următoare' })).toBeTruthy();
  });

  it('redoing a finished lesson and failing shows the failed screen and un-finishes nothing', async () => {
    mockedProgress.mockResolvedValue(progressOf(['l1']));
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Nu', 'Continuă');
    expect(await screen.findByText('Aproape!')).toBeTruthy();
    expect(mockedFinish).not.toHaveBeenCalled();
    expect(mockedSave).toHaveBeenLastCalledWith('l1', null);
  });

  it('a failed markFinished waits on the passed screen and Reîncearcă retries', async () => {
    mockedFinish.mockRejectedValueOnce(new Error('Progresul nu a putut fi salvat. Încearcă din nou.'));
    await openLesson(lesson(), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Progresul nu a putut fi salvat. Încearcă din nou.')).toBeTruthy();
    expect(screen.queryByText('Lecție terminată! 🎉')).toBeNull();
    await press('Reîncearcă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(mockedFinish).toHaveBeenCalledTimes(2);
  });

  // After a free -> guided switch the finished lessons need not be a prefix of the order.
  const fiveLessons = homeOf(...[1, 2, 3, 4, 5].map((n) => summary(`l${n}`, `Lecția ${n}`, n)));

  it('passing the current lesson after a switch unlocks the first unfinished one, not the next in order', async () => {
    mockedHome.mockResolvedValue(fiveLessons);
    mockedProgress.mockResolvedValue(progressOf(['l1', 'l3']));
    mockId = 'l2';
    await openLesson(lesson({ id: 'l2', title: 'Lecția 2' }), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(screen.getByText('Ai deblocat: Lecția 4')).toBeTruthy();
    await press('Mergi la lecția următoare');
    expect(mockReplace).toHaveBeenCalledWith('/lesson/l4');
  });

  it('redoing a finished lesson after a switch offers the current lesson, without an unlock line', async () => {
    mockedHome.mockResolvedValue(fiveLessons);
    mockedProgress.mockResolvedValue(progressOf(['l1', 'l4']));
    mockId = 'l4';
    await openLesson(lesson({ id: 'l4', title: 'Lecția 4' }), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(screen.queryByText(/Ai deblocat/)).toBeNull();
    await press('Mergi la lecția următoare');
    expect(mockReplace).toHaveBeenCalledWith('/lesson/l2');
  });

  it('passing the only unfinished lesson after a switch offers only Home', async () => {
    mockedHome.mockResolvedValue(homeOf(summary('l1', 'Lecția 1', 1), summary('l2', 'Lecția 2', 2)));
    mockedProgress.mockResolvedValue(progressOf(['l2']));
    await openLesson(lesson({ title: 'Lecția 1' }), 'Știu deja — sari la verificare');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(screen.queryByText(/Ai deblocat/)).toBeNull();
    expect(screen.queryByText('Mergi la lecția următoare')).toBeNull();
  });

  it('resumes on the last question when every question was answered and keeps the saved results', async () => {
    mockedProgress.mockResolvedValue(
      progressOf([], { l1: { phase: 'questions', index: 1, results: { q1: true, q2: true } } }),
    );
    await renderLesson(lesson({ questions: [question(1), question(2)] }));
    await screen.findByText('Continuă de unde ai rămas');
    await press('Continuă de unde ai rămas');
    expect(await screen.findByText('Întrebarea 2 din 2')).toBeTruthy();
    await answer('Da', 'Continuă');
    // q1 is not asked again: its saved result counts.
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(screen.getByText('2 din 2 întrebări corecte')).toBeTruthy();
  });

  it('a lesson without questions passes at its end', async () => {
    await openLesson(lesson({ questions: [] }), 'Știu deja — sari la verificare');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(mockedFinish).toHaveBeenCalledWith('l1');
  });
});

describe('zones and consolidation', () => {
  const zones = async () => within(await screen.findByTestId('screen-content'));

  it('the start screen lists the three zones', async () => {
    mockedCount.mockResolvedValue(9);
    await renderLesson(lesson());
    const content = await zones();
    expect(content.getByText('Învățare')).toBeTruthy();
    expect(content.getByText('1 card')).toBeTruthy();
    expect(content.getByText('Verificare')).toBeTruthy();
    expect(content.getByText('1 întrebare')).toBeTruthy();
    expect(content.getByText('Consolidare')).toBeTruthy();
    expect(content.getByText('9 exerciții tip BAC')).toBeTruthy();
  });

  it('consolidation is locked on an unfinished lesson', async () => {
    mockedCount.mockResolvedValue(3);
    await renderLesson(lesson());
    const content = await zones();
    expect(content.getByText('Se deschide după ce termini verificarea')).toBeTruthy();
    expect(content.queryByRole('button', { name: /Consolidare/ })).toBeNull();
    expect(content.queryByText('✓')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('consolidation opens on a finished lesson, and the zones show ✓', async () => {
    mockedCount.mockResolvedValue(3);
    mockedProgress.mockResolvedValue(progressOf(['l1']));
    await renderLesson(lesson());
    const content = await zones();
    expect(content.queryByText('Se deschide după ce termini verificarea')).toBeNull();
    expect(content.getAllByText('✓')).toHaveLength(2);
    await fireEvent.press(content.getByRole('button', { name: /Consolidare/ }));
    expect(mockPush).toHaveBeenCalledWith('/lesson/l1/consolidare');
  });

  it('a started consolidation shows its score and continues', async () => {
    mockedSummary.mockResolvedValue({ count: 4, correct: 3, done: 3 });
    mockedProgress.mockResolvedValue(progressOf(['l1']));
    await renderLesson(lesson());
    const content = await zones();
    expect(content.getByText('3 din 4 rezolvate corect')).toBeTruthy();
    expect(content.getByText('Continuă ›')).toBeTruthy();
  });

  it('the Consolidare zone is hidden when there are no exercises', async () => {
    mockedProgress.mockResolvedValue(progressOf(['l1']));
    await renderLesson(lesson());
    expect((await zones()).queryByText('Consolidare')).toBeNull();
  });

  it('a failed count hides consolidation but never blocks the lesson', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedCount.mockRejectedValue(new Error('offline'));
    mockedProgress.mockResolvedValue(progressOf(['l1']));
    await renderLesson(lesson());
    const content = await zones();
    expect(content.getByText('Lecția test')).toBeTruthy();
    expect(content.queryByText('Consolidare')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('the guided pass offers Începe consolidarea when there are exercises', async () => {
    mockMode = 'guided';
    mockedCount.mockResolvedValue(4);
    await openLesson(lesson(), SKIP);
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Consolidare deblocată')).toBeTruthy();
    expect(screen.getByText('Exersează cerințele de BAC pe lecția asta')).toBeTruthy();
    await press('Începe consolidarea');
    expect(mockPush).toHaveBeenCalledWith('/lesson/l1/consolidare');
    expect(actionBar().getByRole('button', { name: 'Mergi la lecția următoare' })).toBeTruthy();
  });

  it('the guided pass has no consolidation without exercises', async () => {
    mockMode = 'guided';
    await openLesson(lesson(), SKIP);
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    expect(screen.queryByText('Consolidare deblocată')).toBeNull();
    expect(screen.queryByText('Începe consolidarea')).toBeNull();
  });

  it('the free done screen offers Începe consolidarea when there are exercises', async () => {
    mockedCount.mockResolvedValue(2);
    await openLesson(lesson({ cards: [] }), SKIP);
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
    expect(screen.getByText('Consolidare deblocată')).toBeTruthy();
    await press('Începe consolidarea');
    expect(mockPush).toHaveBeenCalledWith('/lesson/l1/consolidare');
    expect(actionBar().queryByRole('button', { name: 'Înapoi la lecții' })).toBeNull();
    await press('Mergi la lecția următoare');
    expect(mockReplace).toHaveBeenCalledWith('/lesson/l2');
  });

  it('the free done screen of the last lesson with exercises offers Înapoi acasă', async () => {
    mockedCount.mockResolvedValue(2);
    mockId = 'l2';
    await openLesson(lesson({ id: 'l2', title: 'Lecția doi', cards: [] }), SKIP);
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
    expect(actionBar().getByRole('button', { name: 'Începe consolidarea' })).toBeTruthy();
    expect(actionBar().queryByRole('button', { name: 'Mergi la lecția următoare' })).toBeNull();
    await press('Înapoi acasă');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('a saved exercises position is ignored: the lesson starts at the start screen', async () => {
    mockedProgress.mockResolvedValue(progressOf([], { l1: { phase: 'exercises', index: 0, results: {} } as never }));
    await renderLesson(lesson());
    await screen.findByText(SKIP);
    expect(screen.queryByText('Continuă de unde ai rămas')).toBeNull();
  });
});

describe('free mode with a paywall', () => {
  it('trial: no next-lesson button into a paywalled lesson', async () => {
    mockCanOpen = (id) => id === 'l1';
    mockedCount.mockResolvedValue(2);
    await openLesson(lesson({ cards: [] }), SKIP);
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Ai terminat lecția!')).toBeTruthy();
    expect(actionBar().getByRole('button', { name: 'Începe consolidarea' })).toBeTruthy();
    expect(actionBar().queryByRole('button', { name: 'Mergi la lecția următoare' })).toBeNull();
  });
});

describe('start screen progress', () => {
  beforeEach(() => {
    mockMode = 'guided';
  });
  const threeCards = () =>
    lesson({ cards: [1, 2, 3].map((n) => ({ id: `c${n}`, position: n, title: null, type: 'text' as const, text: `Corp ${n}` })) });

  it('shows the card the student left on', async () => {
    mockedProgress.mockResolvedValue(progressOf([], { l1: { phase: 'cards', index: 1, results: {} } }));
    await renderLesson(threeCards());
    expect(await screen.findByText('Ai rămas la cardul 2 din 3')).toBeTruthy();
  });

  it('after a failed test the start screen shows the score and offers „Reia testul” first', async () => {
    await openLesson(lesson(), SKIP);
    await answer('Nu', 'Continuă');
    expect(await screen.findByText('Aproape!')).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem('prepio.lastTest.l1')).toBe('{"correct":0,"total":1}'));
    await screen.unmount();
    await renderLesson(lesson());
    expect(await screen.findByText('Ultima încercare: 0 din 1 corecte')).toBeTruthy();
    await press('Reia testul');
    // Straight to question 1, no skip confirmation.
    expect(await screen.findByText('Prima întrebare?')).toBeTruthy();
  });

  it('a passed test forgets the last failed score', async () => {
    await AsyncStorage.setItem('prepio.lastTest.l1', '{"correct":0,"total":1}');
    await renderLesson(lesson());
    // After a failure „Reia testul” replaces the skip link: same test, no confirmation.
    expect(await screen.findByText('Reia testul')).toBeTruthy();
    expect(screen.queryByText(SKIP)).toBeNull();
    await press('Reia testul');
    await answer('Da', 'Continuă');
    expect(await screen.findByText('Lecție terminată! 🎉')).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem('prepio.lastTest.l1')).toBeNull());
  });

  it('a finished lesson says so and drops the guided rule', async () => {
    mockedProgress.mockResolvedValue(progressOf(['l1']));
    await renderLesson(lesson());
    expect(await screen.findByText('✓ Lecție terminată')).toBeTruthy();
    expect(screen.queryByText('Dacă răspunzi corect la toate, treci la lecția următoare.')).toBeNull();
  });
});
