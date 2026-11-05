import { validateCard } from './cards';
import type { Lesson, Question } from './types';

const blank = (s: string | null | undefined) => !s || s.trim() === '';

/** Returns Romanian error messages; empty array when the question is valid. */
export function validateQuestion(q: Question): string[] {
  const errors: string[] = [];
  if (blank(q.prompt)) errors.push('Enunțul întrebării nu poate fi gol.');

  const ids = q.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) errors.push('Variantele trebuie să aibă identificatori unici.');

  if (q.type === 'chronological_order') {
    if (q.options.length < 2) errors.push('Ordinea cronologică necesită cel puțin 2 elemente.');
  } else {
    const correct = q.options.filter((o) => o.correct).length;
    if (q.type === 'single_choice' && correct !== 1) {
      errors.push('Alegerea simplă trebuie să aibă exact un răspuns corect.');
    }
    if (q.type === 'multiple_choice') {
      if (q.options.length < 2) errors.push('Alegerea multiplă necesită cel puțin 2 variante.');
      if (correct < 1) errors.push('Alegerea multiplă trebuie să aibă cel puțin un răspuns corect.');
    }
  }
  return errors;
}

/** Structural rules only; content-volume rules are intentionally not enforced here. */
export function validateLesson(l: Lesson): string[] {
  const errors: string[] = [];
  if (blank(l.title)) errors.push('Titlul lecției nu poate fi gol.');
  l.cards.forEach((c, i) => {
    for (const e of validateCard(c)) errors.push(`Cartonașul ${i + 1}: ${e}`);
  });
  l.questions.forEach((q, i) => {
    for (const e of validateQuestion(q)) errors.push(`Întrebarea ${i + 1}: ${e}`);
  });
  return errors;
}
