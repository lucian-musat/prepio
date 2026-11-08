import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { creditsLabel, type ConsolidationExercise } from '@prepio/shared';
import { evaluateConsolidation, EvaluateApiError } from '../../lib/api';
import { fetchCreditPackages, purchaseCredits } from '../../lib/credits';
import ExerciseScreen from './ExerciseScreen';

jest.mock('../../lib/api', () => ({ ...jest.requireActual('../../lib/api'), evaluateConsolidation: jest.fn() }));
jest.mock('../../lib/credits', () => ({ ...jest.requireActual('../../lib/credits'), fetchCreditPackages: jest.fn(), purchaseCredits: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../credits/CreditsProvider');
jest.mock('../../access/AccessProvider');
jest.mock('../../lib/access', () => ({ ...jest.requireActual('../../lib/access'), purchaseAccess: jest.fn() }));
const { mockResetCredits } = jest.requireMock<typeof import('../../credits/__mocks__/CreditsProvider')>('../../credits/CreditsProvider');
const { mockResetAccess } = jest.requireMock<typeof import('../../access/__mocks__/AccessProvider')>('../../access/AccessProvider');
const mockedEvaluate = evaluateConsolidation as jest.Mock;
const mockedPackages = fetchCreditPackages as jest.Mock;
const mockedPurchase = purchaseCredits as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(7);
  mockResetAccess();
  mockedPackages.mockResolvedValue([
    { id: 'p20', credits: 20, priceBani: 999, featured: false },
    { id: 'p50', credits: 50, priceBani: 1999, featured: true },
  ]);
});

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const base = { id: 'e1', position: 1, prompt: 'P', templateId: null, modelAnswer: null, explanation: null, sources: [] };
const comparison = { ...base, type: 'comparison', variant: 'difference', creditCost: 2, items: [], count: 1 } as unknown as ConsolidationExercise;
const shortAnswer = { ...base, type: 'short_answer', accepted: ['x'], mistakes: [], creditCost: 0 } as unknown as ConsolidationExercise;

const mount = async (exercise: ConsolidationExercise, onSkip = jest.fn()) =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ExerciseScreen
        exercise={exercise}
        sources={new Map()}
        templates={new Map()}
        index={2}
        total={10}
        onBack={jest.fn()}
        onChecked={jest.fn()}
        onContinue={jest.fn()}
        onRetry={jest.fn()}
        onSkip={onSkip}
      />
    </SafeAreaProvider>,
  );

it('an AI exercise shows the cost tag, the balance chip and „Verifică” with its cost', async () => {
  await mount(comparison);
  expect(screen.getByLabelText('Profesorul digital, costă 2 credite')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Verifică, costă 2 credite' })).toBeTruthy();
  expect(screen.getByLabelText('Trial, 7 credite, deschide abonamentul')).toBeTruthy();
  expect(screen.getByText('3/10')).toBeTruthy();
});

it('a deterministic exercise shows neither the tag nor a cost', async () => {
  await mount(shortAnswer);
  expect(screen.queryByLabelText(/Profesorul digital/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Verifică' })).toBeTruthy();
  expect(screen.queryByTestId('button-cost')).toBeNull();
});

// ---- Credits gate ----

const ANSWER = 'Atât Cuza, cât și Carol I au modernizat statul român prin reforme.';
const ok = { key: 'comparison', verdict: 'ok', title: 'Deosebire corectă', good: [], improve: [], ai: true };
const chip = (n: number) => screen.getByLabelText(`Trial, ${creditsLabel(n)}, deschide abonamentul`);
const typeAnswer = async () => fireEvent.changeText(screen.getByLabelText('Răspunsul tău'), ANSWER);
const verify = () => within(screen.getByTestId('action-bar')).getByRole('button', { name: 'Verifică, costă 2 credite' });

it('not enough credits: the sheet opens over the exercise, nothing is sent, the answer stays', async () => {
  mockResetCredits(1);
  await mount(comparison);
  await typeAnswer();
  await act(async () => void fireEvent.press(verify()));
  expect(screen.getByText('Îți mai trebuie 1 credit')).toBeTruthy();
  expect(mockedEvaluate).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Răspunsul tău').props.value).toBe(ANSWER);
});

it('buying in the sheet, then „Verifică acum” runs the blocked check once with the typed answer', async () => {
  mockResetCredits(1);
  mockedPurchase.mockResolvedValue({ orderId: 'o1', credits: 50, balance: 51 });
  mockedEvaluate.mockResolvedValue({ items: [ok], credits: { spent: 2, balance: 49 } });
  await mount(comparison);
  await typeAnswer();
  await act(async () => void fireEvent.press(verify()));
  await act(async () => void fireEvent.press(await screen.findByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' })));
  expect(screen.getByText('Acum ai 51 de credite.')).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Verifică acum, costă 2 credite' })));
  expect(mockedEvaluate).toHaveBeenCalledTimes(1);
  expect(mockedEvaluate).toHaveBeenCalledWith({ exerciseId: 'e1', target: 'exercise', answer: { type: 'comparison', text: ANSWER } });
  expect(screen.queryByText('Credite adăugate!')).toBeNull();
  expect(chip(49)).toBeTruthy();
});

it('„Sari peste exercițiu” in the sheet skips the exercise', async () => {
  mockResetCredits(1);
  const onSkip = jest.fn();
  await mount(comparison, onSkip);
  await typeAnswer();
  await act(async () => void fireEvent.press(verify()));
  await fireEvent.press(screen.getByRole('button', { name: 'Sari peste exercițiu' }));
  expect(onSkip).toHaveBeenCalledTimes(1);
});

it('the server says 402 although the app thought there were enough: the sheet uses the server numbers', async () => {
  mockResetCredits(5);
  mockedEvaluate.mockRejectedValue(
    new EvaluateApiError('insufficient_credits', 'Nu ai destule credite.', { required: 3, balance: 2 }),
  );
  await mount(comparison);
  await typeAnswer();
  await act(async () => void fireEvent.press(verify()));
  expect(screen.getByText('Îți mai trebuie 1 credit')).toBeTruthy();
  expect(chip(2)).toBeTruthy();
  expect(screen.queryByText('Nu ai destule credite.')).toBeNull();
});

it('403 access_required: the paywall sheet opens over the exercise, the typed answer stays, no error row', async () => {
  const { purchaseAccess } = jest.requireMock<typeof import('../../lib/access')>('../../lib/access');
  (purchaseAccess as jest.Mock).mockResolvedValue({
    orderId: 'o1', accessUntil: new Date(Date.now() + 90 * 86400000).toISOString(), bonus: 100, balance: 107,
  });
  // The API layer has already re-read the plan (lib/api, tested there): the student is back in the trial.
  mockResetAccess({ accessUntil: new Date(Date.now() - 60_000).toISOString() });
  mockedEvaluate.mockRejectedValueOnce(new EvaluateApiError('access_required', 'Lecția face parte din accesul complet.'));
  await mount(comparison);
  await typeAnswer();
  await act(async () => void fireEvent.press(verify()));
  expect(screen.getByTestId('paywall-sheet')).toBeTruthy();
  expect(screen.getByText('Reînnoiește accesul')).toBeTruthy();
  expect(screen.queryByText('Lecția face parte din accesul complet.')).toBeNull();
  expect(screen.getByLabelText('Răspunsul tău').props.value).toBe(ANSWER);
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Reînnoiește · 150 lei' })));
  expect(screen.getByText('Ai acces complet!')).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Înapoi la exercițiu' })));
  expect(screen.queryByTestId('paywall-sheet')).toBeNull();
  expect(screen.getByLabelText('Răspunsul tău').props.value).toBe(ANSWER);
  mockedEvaluate.mockResolvedValueOnce({ items: [ok], credits: { spent: 2, balance: 105 } });
  await act(async () => void fireEvent.press(verify()));
  expect(mockedEvaluate).toHaveBeenLastCalledWith(expect.objectContaining({ answer: expect.anything() }));
  expect(mockedEvaluate).toHaveBeenCalledTimes(2);
});

it('403 access_required, then „Mai târziu”: back to the exercise with the answer', async () => {
  mockResetAccess({ accessUntil: null });
  mockedEvaluate.mockRejectedValueOnce(new EvaluateApiError('access_required', 'Lecția face parte din accesul complet.'));
  await mount(comparison);
  await typeAnswer();
  await act(async () => void fireEvent.press(verify()));
  await fireEvent.press(screen.getByRole('button', { name: 'Mai târziu' }));
  expect(screen.queryByTestId('paywall-sheet')).toBeNull();
  expect(screen.getByLabelText('Răspunsul tău').props.value).toBe(ANSWER);
});

it('a refunded failure shows the server message and leaves the balance as it was', async () => {
  mockResetCredits(7);
  mockedEvaluate.mockRejectedValue(new EvaluateApiError('ai_failed', 'Evaluarea nu a reușit. Creditele au fost returnate.', { balance: 7 }));
  await mount(comparison);
  await typeAnswer();
  await act(async () => void fireEvent.press(verify()));
  expect(screen.getByText('Evaluarea nu a reușit. Creditele au fost returnate.')).toBeTruthy();
  expect(chip(7)).toBeTruthy();
  expect(screen.queryByText(/Îți mai trebuie/)).toBeNull();
});
