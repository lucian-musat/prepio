import { listTemplates } from '@/lib/data/templates';
import { createServerClient } from '@/lib/supabase/server';
import TemplatesEditor from './TemplatesEditor';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const templates = await listTemplates(await createServerClient());
  return (
    <>
      <h1 className="h3 mb-3">Șabloane de rezolvare</h1>
      <TemplatesEditor templates={templates} />
    </>
  );
}
