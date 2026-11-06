import { render, screen } from '@testing-library/react-native';
import type { ConsolidationExercise, ExerciseFeedback } from '@prepio/shared';
import FeedbackView, { AI_NOTE, Analyzing, CheckError } from './FeedbackView';

const TYPES = ['short_answer', 'multi_answer', 'source_info', 'source_letter', 'cause_effect', 'facts', 'comparison', 'viewpoint', 'argument', 'essay'] as const;

const exercise = (type: (typeof TYPES)[number]) =>
  ({ id: 'e1', position: 1, prompt: 'p', templateId: null, sources: [], modelAnswer: null, explanation: null, creditCost: 2, type }) as unknown as ConsolidationExercise;
const feedback = (key: string): ExerciseFeedback => ({
  verdict: 'ok',
  items: [{ key, verdict: 'ok', title: 'Corect', good: ['Bine'], improve: [], ai: true }],
});

it.each(TYPES)('%s: the AI note never says "AI"', async (type) => {
  await render(<FeedbackView exercise={exercise(type)} feedback={feedback(type === 'essay' ? 'whole' : 'answer')} />);
  expect(screen.queryAllByText(/\bAI\b/)).toHaveLength(0);
  expect(screen.getByText(/profesorul digital/)).toBeTruthy();
});

it('uses the agreed wording', async () => {
  expect(AI_NOTE).toBe('Feedback de la profesorul digital, pe baza indicațiilor profesorului. Poate greși.');
  await render(<FeedbackView exercise={exercise('viewpoint')} feedback={feedback('viewpoint')} />);
  expect(screen.getByText('Punctul de vedere e evaluat de profesorul digital și poate greși; informațiile sunt verificate exact.')).toBeTruthy();
});

it('argument note', async () => {
  await render(<FeedbackView exercise={exercise('argument')} feedback={feedback('answer')} />);
  expect(screen.getByText('Conectorii sunt verificați automat; faptul istoric e evaluat de profesorul digital și poate greși.')).toBeTruthy();
});

it('Analyzing and CheckError carry no "AI"', async () => {
  await render(
    <>
      <Analyzing />
      <CheckError message="Nu am putut verifica." onRetry={() => {}} />
    </>,
  );
  expect(screen.queryAllByText(/\bAI\b/)).toHaveLength(0);
});
