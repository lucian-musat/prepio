'use server';

import { revalidatePath } from 'next/cache';
import type { BacBarem, BacSection } from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import * as bac from '@/lib/data/bac';
import type { BacItemInput, BacSubjectInput } from '@/lib/data/bac';
import type { SourceImpact, SourceInput } from '@/lib/data/consolidation';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
import { createServerClient } from '@/lib/supabase/server';
import { captureError } from '@/lib/sentry';

async function run<T = void>(
  fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>,
  { revalidate = true }: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    const db = await createServerClient();
    const data = await fn(db);
    if (revalidate) {
      revalidatePath('/bac');
      revalidatePath('/bac/[id]', 'page');
    }
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[bac action] unexpected error:', e);
    captureError(e, { route: 'bac action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}

// Arguments come from the browser: never trust them to be well-typed.
function section(s: unknown): BacSection {
  if (s !== 1 && s !== 2 && s !== 3) throw new UserError(GENERIC_ERROR);
  return s;
}
const dir = (d: unknown): -1 | 1 => (d === -1 ? -1 : 1);
const messages = (errors: string[]) => {
  if (errors.length) throw new UserError(errors.join('\n'));
};

export async function createBacSubject(input: BacSubjectInput): Promise<ActionResult<{ id: string }>> {
  return run(async (db) => ({ id: await bac.createBacSubject(db, input) }));
}
export async function updateBacSubject(id: string, input: BacSubjectInput): Promise<ActionResult> {
  return run((db) => bac.updateBacSubject(db, id, input));
}
export async function deleteBacSubject(id: string): Promise<ActionResult> {
  return run((db) => bac.deleteBacSubject(db, id));
}
/** Publishing refused: `ok: false` with every blocking message joined by newlines. */
export async function setBacPublished(id: string, published: boolean): Promise<ActionResult> {
  return run(async (db) => {
    const errors = await bac.setBacPublished(db, id, published === true);
    if (errors.length) throw new UserError(errors.join('\n'));
  });
}
export async function saveBacSource(subjectId: string, s: BacSection, input: SourceInput): Promise<ActionResult<{ id: string }>> {
  return run((db) => bac.saveBacSource(db, subjectId, section(s), input));
}
export async function previewBacSourceImpact(sourceId: string, body: string): Promise<ActionResult<SourceImpact>> {
  return run(async (db) => {
    if (typeof sourceId !== 'string' || typeof body !== 'string') throw new UserError(GENERIC_ERROR);
    return bac.bacSourceImpact(db, sourceId, body);
  }, { revalidate: false });
}
export async function deleteBacSource(id: string): Promise<ActionResult> {
  return run((db) => bac.deleteBacSource(db, id));
}
export async function moveBacSource(id: string, d: -1 | 1): Promise<ActionResult> {
  return run((db) => bac.moveBacSource(db, id, dir(d)));
}
export async function saveBacItem(subjectId: string, s: BacSection, item: BacItemInput, barem: BacBarem): Promise<ActionResult<{ id: string }>> {
  return run(async (db) => {
    const res = await bac.saveBacItem(db, subjectId, section(s), item, barem);
    messages(res.errors);
    return { id: res.id! };
  });
}
export async function deleteBacItem(id: string): Promise<ActionResult> {
  return run((db) => bac.deleteBacItem(db, id));
}
export async function moveBacItem(id: string, d: -1 | 1): Promise<ActionResult> {
  return run((db) => bac.moveBacItem(db, id, dir(d)));
}
