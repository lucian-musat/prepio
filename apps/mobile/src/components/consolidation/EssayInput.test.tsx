import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ConsolidationExercise, ExerciseAnswer, ExerciseFeedback } from '@prepio/shared';
import { evaluateConsolidation, EvaluateApiError } from '../../lib/api';
import ExerciseScreen from '../../screens/consolidation/ExerciseScreen';
import EssayInput from './EssayInput';

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
  requirements: [
    { id: 'r1', text: 'Prezentarea constituției din 1952', modelAnswer: null, templateId: null, argument: false },
    { id: 'r2', text: 'Formularea unui punct de vedere și susținerea lui', modelAnswer: null, templateId: null, argument: true },
  ],
} as unknown as Extract<ConsolidationExercise, { type: 'essay' }>;

function Harness({ onFeedback }: { onFeedback: jest.Mock }) {
  const [value, setValue] = useState<ExerciseAnswer>({ type: 'essay', parts: { r1: '', r2: '' } });
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null);
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <EssayInput
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

beforeEach(() => jest.clearAllMocks());

it('checks one requirement with its id and updates its state chip', async () => {
  mockedEvaluate.mockResolvedValue({
    items: [{ key: 'r1', verdict: 'almost', title: 'Aproape: o singură prevedere', good: ['Anul e corect.'], improve: ['Mai adaugă o prevedere.'], ai: true }],
  });
  const onFeedback = jest.fn();
  await render(<Harness onFeedback={onFeedback} />);
  const card = within(screen.getByTestId('requirement-r1'));
  expect(card.getByText('Necompletat')).toBeTruthy();
  expect(card.getByRole('button', { name: 'Verifică cerința 1' })).toBeDisabled();
  await fireEvent.changeText(card.getByLabelText('Cerința 1'), 'În 1952 a fost adoptată o nouă constituție.');
  expect(card.getByText('43 caractere')).toBeTruthy();
  expect(card.getByText('Neverificat')).toBeTruthy();
  await act(async () => void fireEvent.press(card.getByRole('button', { name: 'Verifică cerința 1' })));
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
  await act(async () => void fireEvent.press(card.getByRole('button', { name: 'Verifică cerința 1' })));
  expect(await card.findByText('Ai atins limita de evaluări.')).toBeTruthy();
  expect(card.getByRole('button', { name: 'Reîncearcă' })).toBeTruthy();
  expect(onFeedback).not.toHaveBeenCalled();
});

it('the argument requirement shows the connector chips', async () => {
  await render(<Harness onFeedback={jest.fn()} />);
  await fireEvent.press(screen.getByText('Formularea unui punct de vedere și susținerea lui'));
  expect(within(screen.getByTestId('requirement-r2')).getByText('○ Conector de cauzalitate')).toBeTruthy();
});

it('the whole-essay check is enabled only once every requirement has text, and sends target whole', async () => {
  mockedEvaluate.mockResolvedValue({ items: [{ key: 'whole', verdict: 'ok', title: 'Eseu bine structurat', good: [], improve: [], ai: true }] });
  const onChecked = jest.fn();
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
      />
    </SafeAreaProvider>,
  );
  const bar = () => within(screen.getByTestId('action-bar'));
  expect(bar().getByRole('button', { name: 'Verifică eseul întreg' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Cerința 1'), 'Prima parte.');
  expect(bar().getByRole('button', { name: 'Verifică eseul întreg' })).toBeDisabled();
  await fireEvent.press(screen.getByText('Formularea unui punct de vedere și susținerea lui'));
  await fireEvent.changeText(screen.getByLabelText('Cerința 2'), 'A doua parte.');
  expect(bar().getByRole('button', { name: 'Verifică eseul întreg' })).toBeEnabled();
  await act(async () => void fireEvent.press(bar().getByRole('button', { name: 'Verifică eseul întreg' })));
  expect(mockedEvaluate).toHaveBeenCalledWith(expect.objectContaining({ exerciseId: 'e9', target: 'whole' }));
  expect(await screen.findByText('Eseu bine structurat')).toBeTruthy();
  expect(onChecked).toHaveBeenCalledWith(expect.objectContaining({ exerciseId: 'e9', verdict: 'ok' }));
});
