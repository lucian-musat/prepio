import { notFound } from 'next/navigation';
import LessonEditor from '@/components/editor/LessonEditor';
import { isUuid } from '@/lib/data/db';
import { getLessonForEdit } from '@/lib/data/lesson';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getLessonForEdit(await createServerClient(), id);
  if (!data) notFound();
  return <LessonEditor data={data} />;
}
