const COMMA_BELOW: Record<string, string> = { 'ş': 'ș', 'Ş': 'Ș', 'ţ': 'ț', 'Ţ': 'Ț' };

/**
 * Romanian text with comma-below ș / ț: models often answer with the cedilla forms (ş, ţ), which look wrong next to
 * the app's own text. Nothing else changes.
 */
export function fixRomanianDiacritics(s: string): string {
  return s.replace(/[şŞţŢ]/g, (c) => COMMA_BELOW[c] ?? c);
}
