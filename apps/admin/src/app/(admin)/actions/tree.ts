'use server';

import { revalidatePath } from 'next/cache';
import type { LessonStatus } from '@prepio/shared';
import { createServerClient } from '@/lib/supabase/server';
import * as tree from '@/lib/data/tree';

async function run<T>(fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>): Promise<T> {
  const db = await createServerClient();
  const result = await fn(db);
  revalidatePath('/');
  return result;
}

export async function createNode(parentId: string | null, title: string) {
  return run((db) => tree.createNode(db, parentId, title));
}
export async function renameNode(id: string, title: string) {
  return run((db) => tree.renameNode(db, id, title));
}
export async function moveNode(id: string, direction: 'up' | 'down') {
  return run((db) => tree.moveNode(db, id, direction));
}
export async function deleteNode(id: string) {
  return run((db) => tree.deleteNode(db, id));
}
export async function createLesson(nodeId: string, title: string): Promise<{ id: string }> {
  return run((db) => tree.createLesson(db, nodeId, title));
}
export async function moveLesson(id: string, direction: 'up' | 'down') {
  return run((db) => tree.moveLesson(db, id, direction));
}
export async function setLessonStatus(id: string, status: LessonStatus) {
  return run((db) => tree.setLessonStatus(db, id, status));
}
export async function deleteLesson(id: string) {
  return run((db) => tree.deleteLesson(db, id));
}