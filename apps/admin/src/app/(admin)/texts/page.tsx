import { listUiTexts } from '@/lib/data/uiTexts';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import TextsTable from './TextsTable';

export const dynamic = 'force-dynamic';

export default async function TextsPage() {
  const db = await createServerClient();
  const rows = await listUiTexts(db, createAdminClient());
  return (
    <>
      <h1 className="h3 mb-2">Texte</h1>
      <p className="text-muted">Modificările apar la elevi de la următoarele deschideri ale aplicației.</p>
      <TextsTable initial={rows} />
    </>
  );
}
