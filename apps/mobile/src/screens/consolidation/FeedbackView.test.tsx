import { render, screen } from '@testing-library/react-native';
import type { ConsolidationExercise, ExerciseFeedback } from '@prepio/shared';
import FeedbackView, { AI_NOTE, Analyzing, CheckError } from './FeedbackView';

const TYPES = ['short_answer', 'multi_answer', 'source_info', 'source_letter', 'cause_effect', 'facts', 'comparison', 'viewpoint', 'argument'] as const;

const exercise = (type: (typeof TYPES)[number] | 'essay') =>
  ({ id: 'e1', position: 1, prompt: 'p', templateId: null, sources: [], modelAnswer: null, explanation: null, creditCost: 2, type }) as unknown as ConsolidationExercise;
const feedback = (key: string): ExerciseFeedback => ({
  verdict: 'ok',
  items: [{ key, verdict: 'ok', title: 'Corect', good: ['Bine'], improve: [], ai: true }],
});

it.each(TYPES)('%s: the AI note never says "AI"', async (type) => {
  await render(<FeedbackView exercise={exercise(type)} feedback={feedback('answer')} />);
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

it('an essay renders nothing here: each requirement shows its own feedback', async () => {
  await render(<FeedbackView exercise={exercise('essay')} feedback={feedback('r1')} />);
  expect(screen.queryByTestId('feedback')).toBeNull();
});

describe('explicit verdict', () => {
  const { StyleSheet } = require('react-native');
  const { color } = require('@prepio/shared');
  const ai = (verdict: 'ok' | 'almost' | 'no'): ExerciseFeedback => ({
    verdict,
    items: [{ key: 'answer', verdict, title: 'Amândouă sunt reforme', good: ['Ai numit asemănarea.'], improve: ['Adaugă anul.'], ai: true }],
  });

  it.each([
    ['ok', 'Corect'],
    ['almost', 'Aproape'],
    ['no', 'Mai lucrează'],
  ] as const)('an AI verdict %s says „%s” before the summary', async (verdict, word) => {
    await render(<FeedbackView exercise={exercise('comparison')} feedback={ai(verdict)} />);
    expect(screen.getByText(word)).toBeTruthy();
    expect(screen.getByText('Amândouă sunt reforme')).toBeTruthy();
  });

  it('the AI bullets are in the text colour, readable on the tint', async () => {
    await render(<FeedbackView exercise={exercise('comparison')} feedback={ai('ok')} />);
    expect(StyleSheet.flatten(screen.getByText('Adaugă anul.').props.style).color).toBe(color.text);
  });

  it('a deterministic item keeps its title as the verdict (no extra chip)', async () => {
    const det: ExerciseFeedback = { verdict: 'almost', items: [{ key: 'm', verdict: 'almost', title: 'Aproape', good: [], improve: ['Prea lung.'], ai: false }] };
    await render(<FeedbackView exercise={exercise('source_info')} feedback={det} />);
    expect(screen.getAllByText('Aproape')).toHaveLength(1);
  });
});
