import TreeEditor from '@/components/TreeEditor';
import { getTree } from '@/lib/data/tree';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ContentHome() {
  const tree = await getTree(await createServerClient());
  return (
    <>
      <h1 className="h3 mb-3">Conținut</h1>
      <TreeEditor tree={tree} />
    </>
  );
}