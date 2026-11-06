import { color, feedbackText, type Verdict } from '@prepio/shared';

/** Verdict colours (types mockup `.fb.ok / .almost / .no`, `.st.*`): text, tint and the solid edge / icon colour. */
export const VERDICT_TONE: Record<Verdict, { fg: string; bg: string; edge: string }> = {
  ok: { fg: feedbackText.good, bg: color.successSubtle, edge: color.success },
  almost: { fg: feedbackText.almost, bg: color.accentSubtle, edge: color.accent },
  no: { fg: feedbackText.wrong, bg: color.dangerSubtle, edge: color.danger },
};
