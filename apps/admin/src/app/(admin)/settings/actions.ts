'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
import * as access from '@/lib/data/accessSettings';
import type { AccessSettingsInput } from '@/lib/data/accessSettings';
import * as referrals from '@/lib/data/referralSettings';
import type { ReferralSettingsInput } from '@/lib/data/referralSettings';
import * as credits from '@/lib/data/credits';
import type { CreditSettingsInput } from '@/lib/data/credits';
import * as settings from '@/lib/data/settings';
import type { SettingsInput } from '@/lib/data/settings';
import { createServerClient } from '@/lib/supabase/server';
import { captureError } from '@/lib/sentry';

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  try {
    const db = await createServerClient();
    await settings.saveSettings(db, input);
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[settings action] unexpected error:', e);
    captureError(e, { route: 'settings action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveCreditSettingsAction(input: CreditSettingsInput): Promise<ActionResult<CreditSettingsInput>> {
  try {
    const db = await createServerClient();
    await credits.saveCreditSettings(db, input);
    const data = await credits.getCreditSettings(db);
    revalidatePath('/settings');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[credit settings action] unexpected error:', e);
    captureError(e, { route: 'credit settings action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveAccessSettings(input: AccessSettingsInput): Promise<ActionResult> {
  try {
    const db = await createServerClient();
    await access.saveAccessSettings(db, input);
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[access settings action] unexpected error:', e);
    captureError(e, { route: 'access settings action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveReferralSettings(input: ReferralSettingsInput): Promise<ActionResult> {
  try {
    const db = await createServerClient();
    await referrals.saveReferralSettings(db, input);
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[referral settings action] unexpected error:', e);
    captureError(e, { route: 'referral settings action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}
