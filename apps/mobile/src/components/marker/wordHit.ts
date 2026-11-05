/** A word's box in the MarkableText coordinate space (the view the gestures are attached to). */
export type WordBox = { i: number; x: number; y: number; width: number; height: number };

/**
 * The word under (x, y): the line is the one containing y (between two lines, the nearer one), then the
 * nearest word on that line, so a gap or the space past a line's end still lands on a word. Null above the
 * first line, below the last, or before layout.
 */
export function wordAt(boxes: WordBox[], x: number, y: number): number | null {
  if (boxes.length === 0) return null;
  const top = Math.min(...boxes.map((b) => b.y));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  if (y < top || y > bottom) return null;

  const vDist = (b: WordBox) => (y < b.y ? b.y - y : y >= b.y + b.height ? y - (b.y + b.height) : 0);
  let row = boxes[0]!;
  for (const b of boxes) if (vDist(b) < vDist(row)) row = b;
  const line = boxes.filter((b) => b.y < row.y + row.height && b.y + b.height > row.y);

  const hDist = (b: WordBox) => (x < b.x ? b.x - x : x > b.x + b.width ? x - (b.x + b.width) : 0);
  let best = line[0]!;
  for (const b of line) if (hDist(b) < hDist(best)) best = b;
  return best.i;
}
