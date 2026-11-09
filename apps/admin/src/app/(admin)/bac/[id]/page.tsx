import { notFound } from 'next/navigation';
import BacSubjectEditor from '@/components/bac/BacSubjectEditor';
import { getBacSubject } from '@/lib/data/bac';
import { isUuid } from '@/lib/data/db';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BacSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getBacSubject(await createServerClient(), id);
  if (!data) notFound();
  return <BacSubjectEditor data={data} />;
}
