import type { Difficulty, Question, QuestionType } from '@prepio/shared';
import type { QuestionInput } from '@/lib/data/lesson';

export type DraftOption = { id: string; text: string; correct: boolean; label: string };
export type QuestionDraft = {
  id?: string;
  type: QuestionType;
  prompt: string;
  difficulty: Difficulty;
  explanation: string;
  options: DraftOption[];
};

const newId = () => crypto.randomUUID();
export const emptyOption = (): DraftOption => ({ id: newId(), text: '', correct: false, label: '' });
export const isChoice = (t: QuestionType) => t !== 'chronological_order';

export function emptyDraft(type: QuestionType = 'single_choice'): QuestionDraft {
  return { type, prompt: '', difficulty: 'medium', explanation: '', options: [emptyOption(), emptyOption()] };
}

export function draftFromQuestion(q: Question): QuestionDraft {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    difficulty: q.difficulty,
    explanation: q.explanation ?? '',
    options: (q.options as Array<{ id: string; text: string; correct?: boolean; label?: string }>).map((o) => ({
      id: o.id,
      text: o.text,
      correct: o.correct ?? false,
      label: o.label ?? '',
    })),
  };
}

/** Choice <-> choice keeps the options (single keeps only the first correct one); crossing to/from ordering resets them. */
export function changeType(d: QuestionDraft, type: QuestionType): QuestionDraft {
  if (type === d.type) return d;
  if (isChoice(type) !== isChoice(d.type)) return { ...d, type, options: [emptyOption(), emptyOption()] };
  if (type === 'single_choice') {
    const first = d.options.findIndex((o) => o.correct);
    return { ...d, type, options: d.options.map((o, i) => ({ ...o, correct: i === first })) };
  }
  return { ...d, type };
}

export function draftToInput(d: QuestionDraft): QuestionInput {
  const base = { id: d.id, prompt: d.prompt, difficulty: d.difficulty, explanation: d.explanation };
  if (d.type === 'chronological_order') {
    return {
      ...base,
      type: d.type,
      options: d.options.map((o) => (o.label.trim() ? { id: o.id, text: o.text, label: o.label.trim() } : { id: o.id, text: o.text })),
    };
  }
  return { ...base, type: d.type, options: d.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct })) };
}
