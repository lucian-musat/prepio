import { normalizeAnswer } from './normalize';

export const CAUSAL_CONNECTORS: readonly string[] = [
  'deoarece',
  'pentru că',
  'întrucât',
  'fiindcă',
  'din cauza',
  'datorită',
  'ca urmare',
];
export const CONCLUSION_CONNECTORS: readonly string[] = [
  'așadar',
  'prin urmare',
  'în concluzie',
  'deci',
  'astfel',
  'în consecință',
];

/** Whole-word / whole-phrase match on normalised text: diacritics and punctuation don't matter. */
function containsPhrase(paddedText: string, phrase: string): boolean {
  return paddedText.includes(` ${normalizeAnswer(phrase)} `);
}

export function detectConnectors(text: string): { causal: boolean; conclusion: boolean } {
  const padded = ` ${normalizeAnswer(text)} `;
  return {
    causal: CAUSAL_CONNECTORS.some((p) => containsPhrase(padded, p)),
    conclusion: CONCLUSION_CONNECTORS.some((p) => containsPhrase(padded, p)),
  };
}
