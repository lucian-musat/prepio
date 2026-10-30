import { getSettings } from '@/lib/data/settings';
import { createServerClient } from '@/lib/supabase/server';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await getSettings(await createServerClient());
  return (
    <>
      <h1 className="h3 mb-3">Setări</h1>
      <SettingsForm initial={settings} />
    </>
  );
}
