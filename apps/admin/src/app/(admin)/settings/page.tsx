import { getAccessSettings } from '@/lib/data/accessSettings';
import { getCreditSettings } from '@/lib/data/credits';
import { getReferralSettings } from '@/lib/data/referralSettings';
import { getSettings } from '@/lib/data/settings';
import { createServerClient } from '@/lib/supabase/server';
import AccessForm from './AccessForm';
import CreditsForm from './CreditsForm';
import ReferralsForm from './ReferralsForm';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const db = await createServerClient();
  const [settings, creditSettings, accessSettings, referralSettings] = await Promise.all([
    getSettings(db),
    getCreditSettings(db),
    getAccessSettings(db),
    getReferralSettings(db),
  ]);
  return (
    <>
      <h1 className="h3 mb-3">Setări</h1>
      <SettingsForm initial={settings} />
      <CreditsForm initial={creditSettings} />
      <AccessForm initial={accessSettings} />
      <ReferralsForm initial={referralSettings} durationMonths={accessSettings.durationMonths} bonusCredits={accessSettings.bonusCredits} />
    </>
  );
}
