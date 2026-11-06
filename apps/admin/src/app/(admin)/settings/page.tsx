import { getCreditSettings } from '@/lib/data/credits';
import { getSettings } from '@/lib/data/settings';
import { createServerClient } from '@/lib/supabase/server';
import CreditsForm from './CreditsForm';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const db = await createServerClient();
  const [settings, creditSettings] = await Promise.all([getSettings(db), getCreditSettings(db)]);
  return (
    <>
      <h1 className="h3 mb-3">Setări</h1>
      <SettingsForm initial={settings} />
      <CreditsForm initial={creditSettings} />
    </>
  );
}
