import { plural, type SourceLabel } from '@prepio/shared';

/**
 * The source letters a requirement names („…precizată în sursa B”, „din sursele A și B”), in order; none for
 * „sursa dată” or a requirement without a source.
 */
export function sourcesNamedIn(prompt: string): SourceLabel[] {
  const found = new Set<SourceLabel>();
  for (const m of prompt.matchAll(/\bsurs(?:a|ele)\s+([AB])(?:\s*(?:și|,)\s*([AB]))?\b/gi)) {
    for (const l of [m[1], m[2]]) if (l) found.add(l.toUpperCase() as SourceLabel);
  }
  return [...found].sort();
}

/** A BAC item's „· 2 puncte”, with non-breaking spaces so the word never wraps alone onto a new line. */
export function pointsTail(points: number): string {
  return `· ${plural(points, 'punct', 'puncte')}`.replace(/ /g, ' ');
}
