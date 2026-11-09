import { randomUUID } from 'node:crypto';

/**
 * Delimiters around student text in a prompt. The markers carry a per-request nonce the student cannot know; as
 * defence in depth, `wrap` also strips them repeatedly (a single pass could rebuild a marker from nested fragments),
 * so the student can never close the block early.
 */
export function studentTextDelimiters(nonce: string = randomUUID().replace(/-/g, '')) {
  const open = `<<<TEXT_ELEV_${nonce}`;
  const close = `TEXT_ELEV_${nonce}>>>`;
  const wrap = (text: string): string => {
    let safe = text;
    for (let prev = ''; prev !== safe; ) {
      prev = safe;
      safe = safe.split(open).join('').split(close).join('');
    }
    return [open, safe, close].join('\n');
  };
  return { open, close, wrap };
}
