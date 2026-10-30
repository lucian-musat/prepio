import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import type { WritingExercise as WritingExerciseData } from '@prepio/shared';
import { EvaluateApiError, evaluateEssay } from '../lib/api';
import { WritingExercise } from './WritingExercise';

jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return { ...actual, evaluateEssay: jest.fn() };
});
const mockEvaluate = evaluateEssay as jest.Mock;

const exercise: WritingExerciseData = { id: 'e1', position: 1, prompt: 'Scrie despre Cuza.', criteria: 'c' };
const result = { grade: 8, gradeMin: 1, gradeMax: 10, summary: 'Eseu bun.', suggestions: ['Adaugă date.', 'Dezvoltă concluzia.'] };

const setup = async () => {
  await render(
    <PaperProvider>
      <WritingExercise exercise={exercise} />
    </PaperProvider>,
  );
};
const input = () => screen.getByLabelText('Răspunsul tău');
const submitBtn = () => screen.getByRole('button', { name: /Trimite pentru evaluare|Retrimite/ });

beforeEach(() => mockEvaluate.mockReset());

it('shows the prompt and a counter, with submit disabled when empty', async () => {
  await setup();
  expect(screen.getByText('Scrie despre Cuza.')).toBeTruthy();
  expect(screen.getByText('0 / 3000')).toBeTruthy();
  expect(submitBtn()).toBeDisabled();
});

it('disables submit when over the limit (counts code points)', async () => {
  await setup();
  await fireEvent.changeText(input(), 'a'.repeat(3001));
  expect(screen.getByText('3001 / 3000')).toBeTruthy();
  expect(submitBtn()).toBeDisabled();
  await fireEvent.changeText(input(), '😀'.repeat(3000));
  expect(screen.getByText('3000 / 3000')).toBeTruthy();
  expect(submitBtn()).not.toBeDisabled();
});

it('shows loading then grade, summary and suggestions', async () => {
  let resolve!: (v: typeof result) => void;
  mockEvaluate.mockReturnValue(new Promise((r) => (resolve = r)));
  await setup();
  await fireEvent.changeText(input(), 'Eseul meu');
  await fireEvent.press(submitBtn());
  expect(await screen.findByText('Se evaluează…')).toBeTruthy();
  expect(mockEvaluate).toHaveBeenCalledWith({ exerciseId: 'e1', text: 'Eseul meu' });
  resolve(result);
  expect(await screen.findByText('Nota: 8 / 10')).toBeTruthy();
  expect(screen.getByText('Eseu bun.')).toBeTruthy();
  expect(screen.getByText('Adaugă date.')).toBeTruthy();
  expect(screen.getByText('Dezvoltă concluzia.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Retrimite' })).toBeTruthy();
});

it('shows the error message inline and keeps the text', async () => {
  mockEvaluate.mockRejectedValue(new EvaluateApiError('ai_failed', 'Evaluarea nu a reușit. Încearcă din nou.'));
  await setup();
  await fireEvent.changeText(input(), 'Eseul meu');
  await fireEvent.press(submitBtn());
  expect(await screen.findByText('Evaluarea nu a reușit. Încearcă din nou.')).toBeTruthy();
  expect(input().props.value).toBe('Eseul meu');
});

it('resubmits the edited text', async () => {
  mockEvaluate.mockResolvedValue(result);
  await setup();
  await fireEvent.changeText(input(), 'Prima versiune');
  await fireEvent.press(submitBtn());
  await screen.findByText('Nota: 8 / 10');
  await fireEvent.changeText(input(), 'A doua versiune');
  await fireEvent.press(screen.getByRole('button', { name: 'Retrimite' }));
  await screen.findByText('Nota: 8 / 10');
  expect(mockEvaluate).toHaveBeenLastCalledWith({ exerciseId: 'e1', text: 'A doua versiune' });
  expect(mockEvaluate).toHaveBeenCalledTimes(2);
});
