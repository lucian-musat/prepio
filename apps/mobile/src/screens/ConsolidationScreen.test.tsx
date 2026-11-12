import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ConsolidationExercise, LessonSummary, SolutionTemplate } from '@prepio/shared';
import ConsolidationScreen from './ConsolidationScreen';
import { fetchAttempts, fetchConsolidation, fetchRun, saveAttempt, saveRun, type Attempt } from '../lib/consolidation';
import { evaluateConsolidation, EvaluateApiError } from '../lib/api';
import { fetchProgress } from '../lib/progress';
import { fetchHome } from '../lib/content';

jest.mock('../credits/CreditsProvider', () => ({ useCredits: () => ({ balance: 5, change: null }) }));
jest.mock('../lib/consolidation', () => {
  const actual = jest.requireActual('../lib/consolidation');
  return {
    ...actual,
    fetchConsolidation: jest.fn(),
    fetchAttempts: jest.fn(),
    saveAttempt: jest.fn(),
    fetchRun: jest.fn(),
    saveRun: jest.fn(),
  };
});
jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return { ...actual, evaluateConsolidation: jest.fn() };
});
jest.mock('../lib/progress', () => ({ fetchProgress: jest.fn() }));
jest.mock('../lib/content', () => ({ fetchHome: jest.fn(), imageUrl: (p: string) => `http://x/${p}` }));
let mockCanOpen = (_id: string) => true;
jest.mock('../access/AccessProvider', () => ({ useAccess: () => ({ canOpen: (id: string) => mockCanOpen(id), status: { plan: 'trial' }, isAdmin: false }) }));
let mockMode: 'guided' | 'free' = 'free';
jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'u1', displayName: 'ana', learningMode: mockMode } }),
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  },
  useLocalSearchParams: () => ({ id: 'l1' }),
  Stack: { Screen: () => null },
}));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const base = { position: 1, sources: [], modelAnswer: null, explanation: null };
const shortEx = {
  ...base,
  id: 'e1',
  prompt: 'Numiți noua constituție precizată în sursa B.',
  templateId: 't1',
  type: 'short_answer',
  accepted: ['Statutul Dezvoltător'],
  mistakes: [],
} as unknown as ConsolidationExercise;
const factsEx = {
  ...base,
  id: 'e2',
  position: 2,
  prompt: 'Prezentați două fapte istorice din perioada 1866-1886.',
  templateId: null,
  modelAnswer: 'În 1866 se adoptă prima constituție internă.',
  type: 'facts',
  count: 2,
  creditCost: 1,
} as unknown as ConsolidationExercise;
const template: SolutionTemplate = {
  id: 't1',
  title: 'Cum răspunzi la „Numiți / Precizați”',
  exerciseType: 'short_answer',
  points: '2 puncte',
  body: 'Scrie doar denumirea.',
};
const summary = (id: string, position: number): LessonSummary => ({ id, nodeId: 'n', title: `Lecția ${id}`, position });

const mocked = {
  data: fetchConsolidation as jest.Mock,
  attempts: fetchAttempts as jest.Mock,
  saveAttempt: saveAttempt as jest.Mock,
  run: fetchRun as jest.Mock,
  saveRun: saveRun as jest.Mock,
  evaluate: evaluateConsolidation as jest.Mock,
  progress: fetchProgress as jest.Mock,
  home: fetchHome as jest.Mock,
};
const attemptsOf = (...a: Attempt[]) => new Map(a.map((x) => [x.exerciseId, x]));
const attempt = (exerciseId: string, verdict: Attempt['verdict']): Attempt => ({
  exerciseId,
  verdict,
  answer: { type: 'short_answer', text: 'x' },
  feedback: { verdict, items: [] },
});
const FACT_1 = 'În 1866 se adoptă prima constituție internă a României.';
const FACT_2 = 'În 1877 România își proclamă independența de stat.';

beforeEach(() => {
  jest.clearAllMocks();
  mockCanOpen = () => true;
  mockMode = 'free';
  mocked.data.mockResolvedValue({ lessonId: 'l1', exercises: [shortEx, factsEx], sources: new Map(), templates: new Map([['t1', template]]) });
  mocked.attempts.mockResolvedValue(new Map());
  mocked.run.mockResolvedValue(null);
  mocked.saveRun.mockResolvedValue(undefined);
  mocked.saveAttempt.mockResolvedValue(undefined);
  mocked.progress.mockResolvedValue({ finished: new Set(['l1']), positions: new Map() });
  mocked.home.mockResolvedValue({ welcomeMessage: '', sections: [{ path: ['A'], lessons: [summary('l1', 1), summary('l2', 2)] }] });
});

const open = async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ConsolidationScreen />
    </SafeAreaProvider>,
  );
};
const bar = () => within(screen.getByTestId('action-bar'));
const press = async (name: string) => act(async () => void fireEvent.press(bar().getByRole('button', { name })));

it('a lesson that is not finished shows the lock message and leads back to the lesson', async () => {
  mocked.progress.mockResolvedValue({ finished: new Set(), positions: new Map() });
  await open();
  expect(await screen.findByText('Consolidarea se deschide după ce termini lecția.')).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Înapoi la lecție' })));
  expect(mockReplace).toHaveBeenCalledWith('/lesson/l1');
  expect(mocked.saveRun).not.toHaveBeenCalled();
});

it('a new run starts at 1/N and is saved', async () => {
  await open();
  expect(await screen.findByText('Numiți noua constituție precizată în sursa B.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Exercițiul 1, /, selected: true })).toBeTruthy();
  expect(mocked.saveRun).toHaveBeenCalledWith('l1', { exerciseIds: ['e1', 'e2'], index: 0, finished: false });
  expect(bar().getByRole('button', { name: 'Verifică' })).toBeDisabled();
});

it('checking a short answer shows „Corect!”, saves the attempt and „Continuă” saves the next index', async () => {
  await open();
  await fireEvent.changeText(await screen.findByLabelText('Răspunsul tău'), 'statutul dezvoltator');
  await press('Verifică');
  expect(await screen.findByText('Corect!')).toBeTruthy();
  expect(mocked.saveAttempt).toHaveBeenCalledWith(
    expect.objectContaining({ exerciseId: 'e1', verdict: 'ok', answer: { type: 'short_answer', text: 'statutul dezvoltator' } }),
  );
  expect(bar().getByRole('button', { name: 'Încearcă din nou' })).toBeTruthy();
  await press('Continuă');
  expect(await screen.findByText('Prezentați două fapte istorice din perioada 1866-1886.')).toBeTruthy();
  expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e1', 'e2'], index: 1, finished: false });
});

it('„Încearcă din nou” clears the answer and the feedback', async () => {
  await open();
  await fireEvent.changeText(await screen.findByLabelText('Răspunsul tău'), 'Constituția din 1866');
  await press('Verifică');
  expect(await screen.findByText('Mai lucrează')).toBeTruthy();
  await press('Încearcă din nou');
  expect(screen.queryByText('Mai lucrează')).toBeNull();
  expect(screen.getByLabelText('Răspunsul tău').props.value).toBe('');
});

describe('AI types', () => {
  beforeEach(() => mocked.run.mockResolvedValue({ exerciseIds: ['e1', 'e2'], index: 1, finished: false }));
  const fill = async () => {
    await fireEvent.changeText(await screen.findByLabelText('Faptul istoric 1'), FACT_1);
    await fireEvent.changeText(screen.getByLabelText('Faptul istoric 2'), FACT_2);
  };

  it('calls evaluateConsolidation and shows the feedback with the digital-teacher note', async () => {
    mocked.evaluate.mockResolvedValue({
      items: [
        { key: 'fact-0', verdict: 'almost', title: 'Aproape: e doar menționat', good: ['Faptul e în perioadă.'], improve: ['Prezintă-l.'], ai: true },
        { key: 'fact-1', verdict: 'ok', title: 'Corect', good: [], improve: [], ai: true },
      ],
    });
    await open();
    expect(await screen.findByRole('button', { name: /^Exercițiul 2, /, selected: true })).toBeTruthy();
    await fill();
    await press('Verifică, costă 1 credit');
    expect(mocked.evaluate).toHaveBeenCalledWith({ exerciseId: 'e2', target: 'exercise', answer: { type: 'facts', texts: [FACT_1, FACT_2] } });
    expect(await screen.findByText('Aproape: e doar menționat')).toBeTruthy();
    expect(screen.getByText('FAPTUL 1')).toBeTruthy();
    expect(screen.getByText('Feedback de la profesorul digital, după indicațiile scrise de un profesor. Poate greși.')).toBeTruthy();
    expect(screen.getByText('Vezi un răspuns model')).toBeTruthy();
    expect(mocked.saveAttempt).toHaveBeenCalledWith(expect.objectContaining({ exerciseId: 'e2', verdict: 'almost' }));
  });

  it('an instant problem (a fact too short) is shown without calling the AI', async () => {
    await open();
    await fireEvent.changeText(await screen.findByLabelText('Faptul istoric 1'), 'Unirea');
    await fireEvent.changeText(screen.getByLabelText('Faptul istoric 2'), FACT_2);
    await press('Verifică, costă 1 credit');
    expect(await screen.findByText('Faptul 1: prea scurt')).toBeTruthy();
    expect(mocked.evaluate).not.toHaveBeenCalled();
  });

  it('an AI error shows the API message and „Reîncearcă”, and saves nothing', async () => {
    mocked.evaluate.mockRejectedValue(new EvaluateApiError('ai_failed', 'Evaluarea nu a reușit. Încearcă din nou.'));
    await open();
    await fill();
    await press('Verifică, costă 1 credit');
    expect(await screen.findByText('Evaluarea nu a reușit. Încearcă din nou.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeTruthy();
    expect(mocked.saveAttempt).not.toHaveBeenCalled();
    mocked.evaluate.mockResolvedValue({ items: [{ key: 'fact-0', verdict: 'ok', title: 'Corect', good: [], improve: [], ai: true }] });
    await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Reîncearcă' })));
    expect(mocked.evaluate).toHaveBeenCalledTimes(2);
    expect(mocked.saveAttempt).toHaveBeenCalledTimes(1);
  });
});

it('the last „Continuă” finishes the run and shows the end screen with verdict chips', async () => {
  mocked.run.mockResolvedValue({ exerciseIds: ['e1'], index: 0, finished: false });
  mocked.attempts.mockResolvedValue(attemptsOf(attempt('e2', 'almost')));
  await open();
  await fireEvent.changeText(await screen.findByLabelText('Răspunsul tău'), 'Statutul Dezvoltător');
  await press('Verifică');
  await press('Continuă');
  expect(await screen.findByText('Ai terminat consolidarea')).toBeTruthy();
  expect(screen.getByText('Mai ai 1 exercițiu de lucrat.')).toBeTruthy();
  expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e1'], index: 0, finished: true });
  const row1 = within(screen.getByTestId('summary-e1'));
  expect(row1.getByText('Răspuns scurt')).toBeTruthy();
  expect(row1.getByText('Corect')).toBeTruthy();
  expect(within(screen.getByTestId('summary-e2')).getByText('Aproape')).toBeTruthy();
});

it('„Reia doar ce nu a fost corect” builds a run of the exercises not yet correct', async () => {
  mocked.run.mockResolvedValue({ exerciseIds: ['e1', 'e2'], index: 1, finished: true });
  mocked.attempts.mockResolvedValue(attemptsOf(attempt('e1', 'ok'), attempt('e2', 'no')));
  await open();
  expect(await screen.findByText('Ai terminat consolidarea')).toBeTruthy();
  // With something left, redoing it is the main action.
  expect(bar().getAllByRole('button')[0]).toHaveAccessibleName('Reia doar ce nu a fost corect');
  await press('Reia doar ce nu a fost corect');
  expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e2'], index: 0, finished: false });
  expect(await screen.findByText('Prezentați două fapte istorice din perioada 1866-1886.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Exercițiul 1, /, selected: true })).toBeTruthy();
});

it('reopening with a finished run lands on the end screen; with all correct only the full retake is offered', async () => {
  mocked.run.mockResolvedValue({ exerciseIds: ['e1', 'e2'], index: 1, finished: true });
  mocked.attempts.mockResolvedValue(attemptsOf(attempt('e1', 'ok'), attempt('e2', 'ok')));
  await open();
  expect(await screen.findByText('Ai terminat consolidarea')).toBeTruthy();
  expect(screen.getByText('Toate exercițiile sunt corecte. 🎉')).toBeTruthy();
  // All correct: going on is the main action.
  expect(bar().getAllByRole('button')[0]).toHaveAccessibleName('Mergi la lecția următoare');
  expect(bar().getByRole('button', { name: 'Reia consolidarea' })).toBeTruthy();
  expect(bar().queryByRole('button', { name: 'Reia doar ce nu a fost corect' })).toBeNull();
  await press('Mergi la lecția următoare');
  expect(mockReplace).toHaveBeenCalledWith('/lesson/l2');
  await press('Reia consolidarea');
  expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e1', 'e2'], index: 0, finished: false });
});

it.each(['free', 'guided'] as const)('trial (%s): no next-lesson button into a paywalled lesson, only „Înapoi acasă”', async (mode) => {
  mockMode = mode;
  mockCanOpen = (id) => id === 'l1';
  mocked.run.mockResolvedValue({ exerciseIds: ['e1', 'e2'], index: 1, finished: true });
  mocked.attempts.mockResolvedValue(attemptsOf(attempt('e1', 'ok'), attempt('e2', 'ok')));
  await open();
  expect(await screen.findByText('Ai terminat consolidarea')).toBeTruthy();
  expect(bar().queryByRole('button', { name: 'Mergi la lecția următoare' })).toBeNull();
  expect(bar().getByRole('button', { name: 'Înapoi acasă' })).toBeTruthy();
});

it('the last lesson offers „Înapoi acasă”', async () => {
  mocked.home.mockResolvedValue({ welcomeMessage: '', sections: [{ path: ['A'], lessons: [summary('l1', 1)] }] });
  mocked.run.mockResolvedValue({ exerciseIds: ['e1'], index: 0, finished: true });
  await open();
  expect(await screen.findByText('Ai terminat consolidarea')).toBeTruthy();
  await press('Înapoi acasă');
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('the template button opens the sheet, and it is absent without a template', async () => {
  await open();
  await act(async () => void fireEvent.press(await screen.findByRole('button', { name: '💡 Cum rezolv' })));
  expect(await screen.findByText('Cum răspunzi la „Numiți / Precizați”')).toBeTruthy();
  expect(screen.getByText('La BAC: 2 puncte')).toBeTruthy();
  expect(screen.getByText('Scrie doar denumirea.')).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Am înțeles' })));
  expect(screen.queryByText('Scrie doar denumirea.')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Răspunsul tău'), 'x');
  await press('Verifică');
  await press('Continuă');
  expect(await screen.findByText('Prezentați două fapte istorice din perioada 1866-1886.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '💡 Cum rezolv' })).toBeNull();
});

describe('navigation', () => {
  const okAttempt: Attempt = {
    exerciseId: 'e1',
    verdict: 'ok',
    answer: { type: 'short_answer', text: 'Statutul Dezvoltător' },
    feedback: { verdict: 'ok', items: [{ key: 'answer', verdict: 'ok', title: 'Corect!', good: [], improve: [], ai: false }] },
  };
  const prompt1 = 'Numiți noua constituție precizată în sursa B.';
  const prompt2 = 'Prezentați două fapte istorice din perioada 1866-1886.';
  const tap = async (name: string) => act(async () => void fireEvent.press(screen.getByRole('button', { name })));

  it('„Sari peste” goes on without checking; from the last exercise it opens the end screen with all „Nerezolvat”', async () => {
    await open();
    expect(await screen.findByText(prompt1)).toBeTruthy();
    expect(bar().getByRole('button', { name: 'Exercițiul anterior' })).toBeDisabled();
    await press('Sari peste, exercițiul următor');
    expect(await screen.findByText(prompt2)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Exercițiul 2, /, selected: true })).toBeTruthy();
    expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e1', 'e2'], index: 1, finished: false });
    await press('Sari peste, exercițiul următor');
    expect(await screen.findByText('Ai terminat consolidarea')).toBeTruthy();
    expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e1', 'e2'], index: 1, finished: true });
    expect(within(screen.getByTestId('summary-e1')).getByText('Nerezolvat')).toBeTruthy();
    expect(within(screen.getByTestId('summary-e2')).getByText('Nerezolvat')).toBeTruthy();
    expect(mocked.saveAttempt).not.toHaveBeenCalled();
  });

  it('„Exercițiul anterior” goes back one exercise and saves the position', async () => {
    mocked.run.mockResolvedValue({ exerciseIds: ['e1', 'e2'], index: 1, finished: false });
    await open();
    expect(await screen.findByText(prompt2)).toBeTruthy();
    await press('Exercițiul anterior');
    expect(await screen.findByText(prompt1)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Exercițiul 1, /, selected: true })).toBeTruthy();
    expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e1', 'e2'], index: 0, finished: false });
  });

  it('the exercise map shows each state and jumps to the tapped exercise', async () => {
    mocked.attempts.mockResolvedValue(attemptsOf(okAttempt));
    mocked.run.mockResolvedValue({ exerciseIds: ['e1', 'e2'], index: 0, finished: false });
    await open();
    expect(await screen.findByRole('button', { name: 'Exercițiul 1, Corect' })).toBeSelected();
    await tap('Exercițiul 2, Nerezolvat');
    expect(await screen.findByText(prompt2)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exercițiul 2, Nerezolvat' })).toBeSelected();
    expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e1', 'e2'], index: 1, finished: false });
  });

  it('an exercise with an attempt opens checked: the stored answer, its feedback and „Încearcă din nou”', async () => {
    mocked.attempts.mockResolvedValue(attemptsOf(okAttempt));
    mocked.run.mockResolvedValue({ exerciseIds: ['e1', 'e2'], index: 0, finished: false });
    await open();
    expect(await screen.findByText('Corect!')).toBeTruthy();
    expect(screen.getByLabelText('Răspunsul tău').props.value).toBe('Statutul Dezvoltător');
    expect(bar().getByRole('button', { name: 'Continuă' })).toBeTruthy();
    await press('Încearcă din nou');
    expect(screen.queryByText('Corect!')).toBeNull();
    expect(screen.getByLabelText('Răspunsul tău').props.value).toBe('');
  });

  it('coming back to an exercise checked in this session shows its result; unchecked text is kept for the session', async () => {
    await open();
    await fireEvent.changeText(await screen.findByLabelText('Răspunsul tău'), 'statutul dezvoltator');
    await press('Verifică');
    expect(await screen.findByText('Corect!')).toBeTruthy();
    await press('Continuă');
    await fireEvent.changeText(await screen.findByLabelText('Faptul istoric 1'), FACT_1);
    await press('Exercițiul anterior');
    expect(await screen.findByText('Corect!')).toBeTruthy();
    expect(screen.getByLabelText('Răspunsul tău').props.value).toBe('statutul dezvoltator');
    expect(screen.getByRole('button', { name: 'Exercițiul 1, Corect' })).toBeTruthy();
    await press('Continuă');
    expect((await screen.findByLabelText('Faptul istoric 1')).props.value).toBe(FACT_1);
    expect(screen.queryByTestId('feedback')).toBeNull();
  });

  it('a row of the end screen opens a full run at that exercise', async () => {
    mocked.run.mockResolvedValue({ exerciseIds: ['e2'], index: 0, finished: true });
    mocked.attempts.mockResolvedValue(attemptsOf(okAttempt));
    await open();
    expect(await screen.findByText('Ai terminat consolidarea')).toBeTruthy();
    await tap('Exercițiul 2, Prezentare fapte, Nerezolvat');
    expect(await screen.findByText(prompt2)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Exercițiul 2, /, selected: true })).toBeTruthy();
    expect(mocked.saveRun).toHaveBeenLastCalledWith('l1', { exerciseIds: ['e1', 'e2'], index: 1, finished: false });
    await press('Exercițiul anterior');
    expect(await screen.findByText('Corect!')).toBeTruthy();
  });

  it('„Reia consolidarea” opens the exercises empty again', async () => {
    mocked.run.mockResolvedValue({ exerciseIds: ['e1', 'e2'], index: 1, finished: true });
    mocked.attempts.mockResolvedValue(attemptsOf(okAttempt));
    await open();
    await press('Reia consolidarea');
    expect(await screen.findByText(prompt1)).toBeTruthy();
    expect(screen.queryByText('Corect!')).toBeNull();
    expect(screen.getByLabelText('Răspunsul tău').props.value).toBe('');
    expect(screen.getByRole('button', { name: 'Exercițiul 1, Corect' })).toBeTruthy();
    // Skipped through to the end, a row opens its stored attempt again; work typed in this session stays.
    await press('Sari peste, exercițiul următor');
    await fireEvent.changeText(await screen.findByLabelText('Faptul istoric 1'), FACT_1);
    await press('Sari peste, exercițiul următor');
    expect(await screen.findByText('Ai terminat consolidarea')).toBeTruthy();
    await tap('Exercițiul 1, Răspuns scurt, Corect');
    expect(await screen.findByText('Corect!')).toBeTruthy();
    await press('Continuă');
    expect((await screen.findByLabelText('Faptul istoric 1')).props.value).toBe(FACT_1);
  });
});
