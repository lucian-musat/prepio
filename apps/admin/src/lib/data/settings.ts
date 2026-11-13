import type { SupabaseClient } from '@supabase/supabase-js';
import { check, checkAffected, UserError } from './db';

export type SettingsInput = {
  rules: string;
  model: string;
  /** Instructions for the BAC paper grader (optional). */
  bacRules: string;
};

export async function getSettings(db: SupabaseClient): Promise<SettingsInput> {
  const a = check(await db.from('ai_settings').select('rules,model,bac_rules').eq('id', 1).single()) as {
    rules: string;
    model: string;
    bac_rules: string;
  };
  return { rules: a.rules, model: a.model, bacRules: a.bac_rules };
}

function validate(i: SettingsInput) {
  if (typeof i.rules !== 'string' || !i.rules.trim()) throw new UserError('Regulile generale nu pot fi goale.');
  if (typeof i.model !== 'string' || !i.model.trim()) throw new UserError('Modelul nu poate fi gol.');
  if (typeof i.bacRules !== 'string') throw new UserError('Regulile de notare BAC nu sunt valide.');
}

/** Validates everything first so a bad input never writes. */
export async function saveSettings(db: SupabaseClient, input: SettingsInput): Promise<void> {
  validate(input);
  checkAffected(
    await db
      .from('ai_settings')
      .update({ rules: input.rules.trim(), model: input.model.trim(), bac_rules: input.bacRules.trim() })
      .eq('id', 1)
      .select('id'),
  );
}
