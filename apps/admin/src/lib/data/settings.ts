import type { SupabaseClient } from '@supabase/supabase-js';
import { check, checkAffected, UserError } from './db';

export type SettingsInput = {
  welcomeMessage: string;
  rules: string;
  model: string;
  /** Instructions for the BAC paper grader (optional). */
  bacRules: string;
};

export async function getSettings(db: SupabaseClient): Promise<SettingsInput> {
  const s = check(await db.from('settings').select('welcome_message').eq('id', 1).single()) as { welcome_message: string };
  const a = check(await db.from('ai_settings').select('rules,model,bac_rules').eq('id', 1).single()) as {
    rules: string;
    model: string;
    bac_rules: string;
  };
  return { welcomeMessage: s.welcome_message, rules: a.rules, model: a.model, bacRules: a.bac_rules };
}

function validate(i: SettingsInput) {
  if (typeof i.welcomeMessage !== 'string' || !i.welcomeMessage.trim()) throw new UserError('Mesajul de bun venit nu poate fi gol.');
  if (typeof i.rules !== 'string' || !i.rules.trim()) throw new UserError('Regulile generale nu pot fi goale.');
  if (typeof i.model !== 'string' || !i.model.trim()) throw new UserError('Modelul nu poate fi gol.');
  if (typeof i.bacRules !== 'string') throw new UserError('Regulile de notare BAC nu sunt valide.');
}

/** Validates everything first so a bad input never writes either table. */
export async function saveSettings(db: SupabaseClient, input: SettingsInput): Promise<void> {
  validate(input);
  checkAffected(
    await db.from('settings').update({ welcome_message: input.welcomeMessage.trim() }).eq('id', 1).select('id'),
  );
  checkAffected(
    await db
      .from('ai_settings')
      .update({ rules: input.rules.trim(), model: input.model.trim(), bac_rules: input.bacRules.trim() })
      .eq('id', 1)
      .select('id'),
  );
}
