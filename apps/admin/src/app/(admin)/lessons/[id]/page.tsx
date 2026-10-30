import { notFound } from 'next/navigation';
import LessonEditor from '@/components/editor/LessonEditor';
import { getLessonForEdit } from '@/lib/data/lesson';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getLessonForEdit(await createServerClient(), id);
  if (!data) notFound();
  return <LessonEditor data={data} />;
}
