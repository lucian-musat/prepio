import { listAiTemplates } from '@/lib/data/aiTemplates';
import { createServerClient } from '@/lib/supabase/server';
import AiTemplatesEditor from './AiTemplatesEditor';

export const dynamic = 'force-dynamic';

export default async function AiTemplatesPage() {
  const templates = await listAiTemplates(await createServerClient());
  return (
    <>
      <h1 className="h3 mb-3">Șabloane AI</h1>
      <AiTemplatesEditor templates={templates} />
    </>
  );
}
