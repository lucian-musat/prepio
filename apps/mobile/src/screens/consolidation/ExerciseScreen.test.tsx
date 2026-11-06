import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ConsolidationExercise } from '@prepio/shared';
import ExerciseScreen from './ExerciseScreen';

jest.mock('../../lib/api', () => ({ evaluateConsolidation: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../credits/CreditsProvider', () => ({ useCredits: () => ({ balance: 7, change: null }) }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const base = { id: 'e1', position: 1, prompt: 'P', templateId: null, modelAnswer: null, explanation: null, sources: [] };
const comparison = { ...base, type: 'comparison', variant: 'difference', creditCost: 2, items: [], count: 1 } as unknown as ConsolidationExercise;
const shortAnswer = { ...base, type: 'short_answer', accepted: ['x'], mistakes: [], creditCost: 0 } as unknown as ConsolidationExercise;

const mount = async (exercise: ConsolidationExercise) =>
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
        onSkip={jest.fn()}
      />
    </SafeAreaProvider>,
  );

it('an AI exercise shows the cost tag, the balance chip and „Verifică” with its cost', async () => {
  await mount(comparison);
  expect(screen.getByLabelText('Profesorul digital, costă 2 credite')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Verifică, costă 2 credite' })).toBeTruthy();
  expect(screen.getByLabelText('Ai 7 credite. Deschide creditele mele.')).toBeTruthy();
  expect(screen.getByText('3/10')).toBeTruthy();
});

it('a deterministic exercise shows neither the tag nor a cost', async () => {
  await mount(shortAnswer);
  expect(screen.queryByLabelText(/Profesorul digital/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Verifică' })).toBeTruthy();
  expect(screen.queryByTestId('button-cost')).toBeNull();
});
