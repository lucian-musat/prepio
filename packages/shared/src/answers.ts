import type { Answer, Question } from './types';

export function checkAnswer(q: Question, a: Answer): boolean {
  if (q.type === 'chronological_order') {
    if (a.type !== 'chronological_order') return false;
    return sameSequence(
      q.options.map((o) => o.id),
      a.order,
    );
  }
  if (q.type !== a.type) return false;
  const correct = q.options.filter((o) => o.correct).map((o) => o.id);
  const selected = new Set(a.selected);
  if (selected.size !== a.selected.length) return false; // duplicates are not a valid selection
  return selected.size === correct.length && correct.every((id) => selected.has(id));
}

function sameSequence(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Fisher–Yates shuffle returning a new array. For 2+ items the result is never
 * the original order, so a student is never shown an already-solved sequence.
 */
export function shuffleForDisplay<T extends { id: string }>(
  items: T[],
  rng: () => number = Math.random,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  if (out.length >= 2 && out.every((item, i) => item.id === items[i]!.id)) {
    out.push(out.shift()!);
  }
  return out;
}
