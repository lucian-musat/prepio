import type { ConsolidationExercise } from '@prepio/shared';
import { VERDICT_TONE } from '../../components/consolidation/verdictTone';
import type { Attempt } from '../../lib/consolidation';
import { MUTED, exerciseStatus } from './status';

const base = { id: 'e1', position: 1, prompt: 'P', templateId: null, sources: [], modelAnswer: null, explanation: null };
const short = { ...base, type: 'short_answer', accepted: ['X'], mistakes: [] } as unknown as ConsolidationExercise;
const essay = {
  ...base,
  type: 'essay',
  requirements: [
    { id: 'r1', text: 'Cerința 1', modelAnswer: null, templateId: null, argument: false },
    { id: 'r2', text: 'Cerința 2', modelAnswer: null, templateId: null, argument: false },
  ],
} as unknown as ConsolidationExercise;
const item = (key: string, verdict: 'ok' | 'almost' | 'no') => ({ key, verdict, title: key, good: [], improve: [], ai: true });
const attempt = (verdict: Attempt['verdict'], items: ReturnType<typeof item>[] = []): Attempt => ({
  exerciseId: 'e1',
  verdict,
  answer: { type: 'short_answer', text: 'x' },
  feedback: { verdict, items },
});

it('an exercise without an attempt is „Nerezolvat”', () => {
  expect(exerciseStatus(short, undefined)).toEqual({ chip: 'Nerezolvat', tone: MUTED });
});

it('an attempt with a verdict shows its label and colours', () => {
  expect(exerciseStatus(short, attempt('ok'))).toEqual({ chip: 'Corect', tone: VERDICT_TONE.ok });
  expect(exerciseStatus(short, attempt('almost'))).toEqual({ chip: 'Aproape', tone: VERDICT_TONE.almost });
  expect(exerciseStatus(short, attempt('no'))).toEqual({ chip: 'Mai lucrează', tone: VERDICT_TONE.no });
});

it('an essay without a verdict shows „n din N”', () => {
  expect(exerciseStatus(essay, attempt(null, [item('r1', 'ok')]))).toEqual({ chip: '1 din 2', tone: VERDICT_TONE.almost });
  expect(exerciseStatus(essay, attempt(null, [item('r1', 'no')]))).toEqual({ chip: '0 din 2', tone: MUTED });
  expect(exerciseStatus(essay, attempt(null, [item('r1', 'ok'), item('r2', 'ok')]))).toEqual({ chip: '2 din 2', tone: VERDICT_TONE.ok });
});
