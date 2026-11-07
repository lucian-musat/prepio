import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ConsolidationExercise, ExerciseAnswer, ExerciseFeedback } from '@prepio/shared';
import { evaluateConsolidation, EvaluateApiError } from '../../lib/api';
import ExerciseScreen from '../../screens/consolidation/ExerciseScreen';
import { fetchCreditPackages } from '../../lib/credits';
import { useCreditGate } from '../../credits/useCreditGate';
import EssayInput from './EssayInput';

jest.mock('../../credits/CreditsProvider');
const { mockResetCredits } = jest.requireMock<typeof import('../../credits/__mocks__/CreditsProvider')>('../../credits/CreditsProvider');
jest.mock('../../lib/credits', () => ({ ...jest.requireActual('../../lib/credits'), fetchCreditPackages: jest.fn(), purchaseCredits: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../lib/api', () => {
  const actual = jest.requireActual('../../lib/api');
  return { ...actual, evaluateConsolidation: jest.fn() };
});
const mockedEvaluate = evaluateConsolidation as jest.Mock;

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const essay = {
  id: 'e9',
  position: 1,
  prompt: 'Elaborați un eseu despre evoluția politică a României.',
  templateId: null,
  sources: [],
  modelAnswer: null,
  explanation: null,
  type: 'essay',
  creditCost: 2,
  requirements: [
    { id: 'r1', text: 'Prezentarea constituției din 1952', modelAnswer: null, templateId: null, argument: false },
    { id: 'r2', text: 'Formularea unui punct de vedere și susținerea lui', modelAnswer: null, templateId: null, argument: true },
  ],
} as unknown as Extract<ConsolidationExercise, { type: 'essay' }>;

function Harness({ onFeedback }: { onFeedback: jest.Mock }) {
  const [value, setValue] = useState<ExerciseAnswer>({ type: 'essay', parts: { r1: '', r2: '' } });
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null);
  const gate = useCreditGate();
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      {gate.sheet}
      <EssayInput
        gate={gate}
        exercise={essay}
        sources={[]}
        value={value as Extract<ExerciseAnswer, { type: 'essay' }>}
        onChange={setValue}
        feedback={feedback}
        disabled={false}
        onFeedback={(f) => {
          setFeedback(f);
          onFeedback(f);
        }}
      />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(5);
  (fetchCreditPackages as jest.Mock).mockResolvedValue([{ id: 'p50', credits: 50, priceBani: 1999, featured: true }]);
});

it('checks one requirement with its id and updates its state chip', async () => {
  mockedEvaluate.mockResolvedValue({
    items: [{ key: 'r1', verdict: 'almost', title: 'Aproape: o singură prevedere', good: ['Anul e corect.'], improve: ['Mai adaugă o prevedere.'], ai: true }],
  });
  const onFeedback = jest.fn();
  await render(<Harness onFeedback={onFeedback} />);
  const card = within(screen.getByTestId('requirement-r1'));
  expect(card.getByText('Necompletat')).toBeTruthy();
  expect(card.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })).toBeDisabled();
  await fireEvent.changeText(card.getByLabelText('Cerința 1'), 'În 1952 a fost adoptată o nouă constituție.');
  expect(card.getByText('43 caractere')).toBeTruthy();
  expect(card.getByText('Neverificat')).toBeTruthy();
  await act(async () => void fireEvent.press(card.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })));
  expect(mockedEvaluate).toHaveBeenCalledWith({
    exerciseId: 'e9',
    target: { requirementId: 'r1' },
    answer: { type: 'essay', parts: { r1: 'În 1952 a fost adoptată o nouă constituție.', r2: '' } },
  });
  expect(await card.findByText('Aproape')).toBeTruthy();
  expect(card.getByText('Aproape: o singură prevedere')).toBeTruthy();
  expect(onFeedback).toHaveBeenCalledWith(expect.objectContaining({ verdict: null, items: [expect.objectContaining({ key: 'r1', verdict: 'almost' })] }));
});

it('a failed requirement check shows the API message with „Reîncearcă”', async () => {
  mockedEvaluate.mockRejectedValue(new EvaluateApiError('rate_limited', 'Ai atins limita de evaluări.'));
  const onFeedback = jest.fn();
  await render(<Harness onFeedback={onFeedback} />);
  const card = within(screen.getByTestId('requirement-r1'));
  await fireEvent.changeText(card.getByLabelText('Cerința 1'), 'Text');
  await act(async () => void fireEvent.press(card.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })));
  expect(await card.findByText('Ai atins limita de evaluări.')).toBeTruthy();
  expect(card.getByRole('button', { name: 'Reîncearcă' })).toBeTruthy();
  expect(onFeedback).not.toHaveBeenCalled();
});

it('the argument requirement shows the connector chips', async () => {
  await render(<Harness onFeedback={jest.fn()} />);
  await fireEvent.press(screen.getByText('Formularea unui punct de vedere și susținerea lui'));
  expect(within(screen.getByTestId('requirement-r2')).getByText('○ Conector de cauzalitate')).toBeTruthy();
});

// ---- Fix round 1 ----

const item = (key: string, verdict: 'ok' | 'almost' | 'no', title = key) => ({ key, verdict, title, good: [], improve: [], ai: true });
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

async function renderScreen(onChecked = jest.fn(), onRetry = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ExerciseScreen
        exercise={essay}
        sources={new Map()}
        templates={new Map()}
        index={0}
        total={1}
        onBack={jest.fn()}
        onChecked={onChecked}
        onContinue={jest.fn()}
        onRetry={onRetry}
        onSkip={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(screen.getByLabelText('Cerința 1'), 'Prima parte.');
  await fireEvent.press(screen.getByText('Formularea unui punct de vedere și susținerea lui'));
  await fireEvent.changeText(screen.getByLabelText('Cerința 2'), 'A doua parte.');
}
const bar = () => within(screen.getByTestId('action-bar'));

it('a checked requirement edited afterwards goes back to „Neverificat”', async () => {
  mockedEvaluate.mockResolvedValue({ items: [item('r1', 'ok', 'Bine')] });
  await renderScreen();
  const card = () => within(screen.getByTestId('requirement-r1'));
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })));
  expect(await card().findByText('Corect')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Cerința 1'), 'Prima parte, schimbată.');
  expect(card().getByText('Neverificat')).toBeTruthy();
  expect(card().queryByText('Corect')).toBeNull();
});

it('coming back to an essay in progress restores its texts and requirement verdicts; editing one makes it stale', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ExerciseScreen
        exercise={essay}
        sources={new Map()}
        templates={new Map()}
        index={1}
        total={2}
        onBack={jest.fn()}
        onChecked={jest.fn()}
        onContinue={jest.fn()}
        onRetry={jest.fn()}
        onSkip={jest.fn()}
        onPrev={jest.fn()}
        initial={{ answer: { type: 'essay', parts: { r1: 'Prima parte.', r2: '' } }, feedback: { verdict: null, items: [item('r1', 'ok', 'Bine')] } }}
      />
    </SafeAreaProvider>,
  );
  const card = () => within(screen.getByTestId('requirement-r1'));
  expect(card().getByText('Corect')).toBeTruthy();
  expect(screen.getByLabelText('Cerința 1').props.value).toBe('Prima parte.');
  // Some requirement feedback: the forward button says „Continuă”, as before the navigation.
  expect(bar().getByRole('button', { name: 'Continuă' })).toBeEnabled();
  expect(bar().getByRole('button', { name: 'Exercițiul anterior' })).toBeEnabled();
  await fireEvent.changeText(screen.getByLabelText('Cerința 1'), 'Prima parte, schimbată.');
  expect(card().getByText('Neverificat')).toBeTruthy();
});

it('previous / skip are disabled while a requirement check runs', async () => {
  const part = deferred<{ items: ReturnType<typeof item>[] }>();
  mockedEvaluate.mockReturnValueOnce(part.promise);
  await renderScreen();
  expect(bar().getByRole('button', { name: 'Sari peste, exercițiul următor' })).toBeEnabled();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })));
  expect(bar().getByRole('button', { name: 'Sari peste, exercițiul următor' })).toBeDisabled();
  expect(bar().getByRole('button', { name: 'Exercițiul anterior' })).toBeDisabled();
  await act(async () => part.resolve({ items: [item('r1', 'ok')] }));
  expect(bar().getByRole('button', { name: 'Continuă' })).toBeEnabled();
});

// ---- Per-requirement only (no whole-essay check) ----

const checkBoth = async () => {
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })));
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 2, costă 2 credite' })));
};

it('has no whole-essay check: the intro and the caption speak of requirements only', async () => {
  await renderScreen();
  expect(screen.queryByText(/Verifică eseul întreg/)).toBeNull();
  expect(screen.queryByText('Eseul întreg')).toBeNull();
  expect(screen.getByText('Scrie fiecare cerință în câmpul ei și verifică-le pe rând.')).toBeTruthy();
  expect(screen.getByText('0 din 2 cerințe corecte')).toBeTruthy();
});

it.each([
  ['ok', 'no', 'almost'],
  ['ok', 'ok', 'ok'],
] as const)('both requirements checked (%s + %s): onChecked gets verdict %s, inputs stay editable', async (a, b, verdict) => {
  mockedEvaluate.mockResolvedValueOnce({ items: [item('r1', a)] }).mockResolvedValueOnce({ items: [item('r2', b)] });
  const onChecked = jest.fn();
  await renderScreen(onChecked);
  await checkBoth();
  expect(onChecked).toHaveBeenLastCalledWith(expect.objectContaining({ verdict }));
  expect(screen.getByLabelText('Cerința 1').props.editable).toBe(true);
  expect(screen.getByLabelText('Cerința 2').props.editable).toBe(true);
  expect(screen.queryByText('Încearcă din nou')).toBeNull();
  expect(bar().getByRole('button', { name: 'Continuă' })).toBeEnabled();
});

it('one of two requirements checked: verdict null and „Continuă” replaces „Sari peste”', async () => {
  mockedEvaluate.mockResolvedValueOnce({ items: [item('r1', 'ok')] });
  const onChecked = jest.fn();
  await renderScreen(onChecked);
  expect(bar().getByRole('button', { name: 'Sari peste, exercițiul următor' })).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })));
  expect(onChecked).toHaveBeenLastCalledWith(expect.objectContaining({ verdict: null }));
  expect(bar().getByRole('button', { name: 'Continuă' })).toBeEnabled();
  expect(screen.getByText('1 din 2 cerințe corecte')).toBeTruthy();
});

it('ignores a stored whole item', async () => {
  const onChecked = jest.fn();
  mockedEvaluate.mockResolvedValueOnce({ items: [item('r2', 'ok')] });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ExerciseScreen
        exercise={essay}
        sources={new Map()}
        templates={new Map()}
        index={0}
        total={1}
        onBack={jest.fn()}
        onChecked={onChecked}
        onContinue={jest.fn()}
        onRetry={jest.fn()}
        onSkip={jest.fn()}
        initial={{
          answer: { type: 'essay', parts: { r1: 'Prima parte.', r2: 'A doua.' } },
          feedback: { verdict: 'no', items: [item('whole', 'no'), item('r1', 'ok')] },
        }}
      />
    </SafeAreaProvider>,
  );
  expect(screen.getByText('1 din 2 cerințe corecte')).toBeTruthy();
  expect(screen.getByLabelText('Cerința 1').props.editable).toBe(true);
  // The old whole verdict (no) does not count: ok + ok is ok.
  await fireEvent.press(screen.getByText('Formularea unui punct de vedere și susținerea lui'));
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 2, costă 2 credite' })));
  expect(onChecked).toHaveBeenLastCalledWith(expect.objectContaining({ verdict: 'ok' }));
});

// ---- Credits gate ----

it('two requirements checked together with 1 credit: the second gets 402, the sheet opens, both texts stay', async () => {
  mockResetCredits(1);
  const cheap = { ...essay, creditCost: 1 } as typeof essay;
  const first = deferred<{ items: ReturnType<typeof item>[]; credits: { spent: number; balance: number } }>();
  let rejectSecond!: (e: unknown) => void;
  const secondPromise = new Promise((_, reject) => (rejectSecond = reject));
  mockedEvaluate.mockReturnValueOnce(first.promise).mockReturnValueOnce(secondPromise);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ExerciseScreen
        exercise={cheap}
        sources={new Map()}
        templates={new Map()}
        index={0}
        total={1}
        onBack={jest.fn()}
        onChecked={jest.fn()}
        onContinue={jest.fn()}
        onRetry={jest.fn()}
        onSkip={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(screen.getByLabelText('Cerința 1'), 'Prima parte.');
  await fireEvent.press(screen.getByText('Formularea unui punct de vedere și susținerea lui'));
  await fireEvent.changeText(screen.getByLabelText('Cerința 2'), 'A doua parte.');
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 1, costă 1 credit' })));
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 2, costă 1 credit' })));
  expect(mockedEvaluate).toHaveBeenCalledTimes(2);
  await act(async () => first.resolve({ items: [item('r1', 'ok', 'Bine')], credits: { spent: 1, balance: 0 } }));
  await act(async () => rejectSecond(new EvaluateApiError('insufficient_credits', 'Nu ai destule credite.', { required: 1, balance: 0 })));
  expect(screen.getByText('Îți mai trebuie 1 credit')).toBeTruthy();
  expect(screen.getByLabelText('Ai 0 credite. Deschide creditele mele.')).toBeTruthy();
  expect(within(screen.getByTestId('requirement-r2')).queryByText('Nu ai destule credite.')).toBeNull();
  expect(screen.getByLabelText('Cerința 1').props.value).toBe('Prima parte.');
  expect(screen.getByLabelText('Cerința 2').props.value).toBe('A doua parte.');
});

it('a requirement check without enough credits opens the sheet and sends nothing', async () => {
  mockResetCredits(1);
  const onFeedback = jest.fn();
  await render(<Harness onFeedback={onFeedback} />);
  await fireEvent.changeText(screen.getByLabelText('Cerința 1'), 'Text');
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })));
  expect(screen.getByText('Îți mai trebuie 1 credit')).toBeTruthy();
  expect(mockedEvaluate).not.toHaveBeenCalled();
});

// ---- Final review fixes ----

/** The press handler of a button, to tap it twice before React re-renders (fireEvent wraps each tap in act). */
type Fiber = { memoizedProps?: { onPress?: unknown }; return: Fiber | null };
const pressHandler = (el: object) => {
  let f = (el as { unstable_fiber: Fiber | null }).unstable_fiber;
  while (f && typeof f.memoizedProps?.onPress !== 'function') f = f.return;
  return f!.memoizedProps!.onPress as () => void;
};

it('a fast double tap on „Verifică cerința” sends (and pays for) one check', async () => {
  const part = deferred<{ items: ReturnType<typeof item>[] }>();
  mockedEvaluate.mockReturnValue(part.promise);
  await render(<Harness onFeedback={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Cerința 1'), 'Text');
  const btn = screen.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' });
  // Both taps land before the busy state re-renders the button.
  await act(async () => {
    const press = pressHandler(btn);
    press();
    press();
  });
  expect(mockedEvaluate).toHaveBeenCalledTimes(1);
  await act(async () => part.resolve({ items: [item('r1', 'ok')] }));
  // Done: the requirement can be checked again.
  mockedEvaluate.mockResolvedValue({ items: [item('r1', 'ok')] });
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 1, costă 2 credite' })));
  expect(mockedEvaluate).toHaveBeenCalledTimes(2);
});

it('the sheet cannot skip the exercise while a requirement check is in flight', async () => {
  mockResetCredits(1);
  const cheap = { ...essay, creditCost: 1 } as typeof essay;
  const first = deferred<{ items: ReturnType<typeof item>[]; credits: { spent: number; balance: number } }>();
  mockedEvaluate
    .mockReturnValueOnce(first.promise)
    .mockRejectedValueOnce(new EvaluateApiError('insufficient_credits', 'Nu ai destule credite.', { required: 1, balance: 0 }));
  const onSkip = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ExerciseScreen
        exercise={cheap}
        sources={new Map()}
        templates={new Map()}
        index={0}
        total={1}
        onBack={jest.fn()}
        onChecked={jest.fn()}
        onContinue={jest.fn()}
        onRetry={jest.fn()}
        onSkip={onSkip}
      />
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(screen.getByLabelText('Cerința 1'), 'Prima parte.');
  await fireEvent.press(screen.getByText('Formularea unui punct de vedere și susținerea lui'));
  await fireEvent.changeText(screen.getByLabelText('Cerința 2'), 'A doua parte.');
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 1, costă 1 credit' })));
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică cerința 2, costă 1 credit' })));
  expect(screen.getByText('Îți mai trebuie 1 credit')).toBeTruthy();
  const skip = () => screen.getByRole('button', { name: 'Sari peste exercițiu' });
  expect(skip()).toBeDisabled();
  await fireEvent.press(skip());
  expect(onSkip).not.toHaveBeenCalled();
  await act(async () => first.resolve({ items: [item('r1', 'ok', 'Bine')], credits: { spent: 1, balance: 0 } }));
  expect(skip()).toBeEnabled();
  await fireEvent.press(skip());
  expect(onSkip).toHaveBeenCalledTimes(1);
});
