import { getAccessSettings } from '@/lib/data/accessSettings';
import { getCreditSettings } from '@/lib/data/credits';
import { getSettings } from '@/lib/data/settings';
import { createServerClient } from '@/lib/supabase/server';
import AccessForm from './AccessForm';
import CreditsForm from './CreditsForm';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const db = await createServerClient();
  const [settings, creditSettings, accessSettings] = await Promise.all([getSettings(db), getCreditSettings(db), getAccessSettings(db)]);
  return (
    <>
      <h1 className="h3 mb-3">Setări</h1>
      <SettingsForm initial={settings} />
      <CreditsForm initial={creditSettings} />
      <AccessForm initial={accessSettings} />
    </>
  );
}
