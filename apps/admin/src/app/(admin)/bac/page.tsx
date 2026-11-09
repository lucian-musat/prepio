import { listBacSubjects } from '@/lib/data/bac';
import { createServerClient } from '@/lib/supabase/server';
import BacList from './BacList';

export const dynamic = 'force-dynamic';

export default async function BacPage() {
  const subjects = await listBacSubjects(await createServerClient());
  return (
    <>
      <h1 className="h3 mb-3">Subiecte BAC</h1>
      <BacList subjects={subjects} />
    </>
  );
}
