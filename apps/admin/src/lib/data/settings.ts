import type { SupabaseClient } from '@supabase/supabase-js';
import { check, checkAffected, UserError } from './db';

export type SettingsInput = {
  welcomeMessage: string;
  rules: string;
  gradeMin: number;
  gradeMax: number;
  model: string;
};

export async function getSettings(db: SupabaseClient): Promise<SettingsInput> {
  const s = check(await db.from('settings').select('welcome_message').eq('id', 1).single()) as { welcome_message: string };
  const a = check(await db.from('ai_settings').select('rules,grade_min,grade_max,model').eq('id', 1).single()) as { rules: string; grade_min: number; grade_max: number; model: string };
  return { welcomeMessage: s.welcome_message, rules: a.rules, gradeMin: a.grade_min, gradeMax: a.grade_max, model: a.model };
}

function validate(i: SettingsInput) {
  if (typeof i.welcomeMessage !== 'string' || !i.welcomeMessage.trim()) throw new UserError('Mesajul de bun venit nu poate fi gol.');
  if (typeof i.rules !== 'string' || !i.rules.trim()) throw new UserError('Regulile de evaluare nu pot fi goale.');
  if (!Number.isInteger(i.gradeMin) || !Number.isInteger(i.gradeMax)) throw new UserError('Notele minimă și maximă trebuie să fie numere întregi.');
  if (i.gradeMin >= i.gradeMax) throw new UserError('Nota minimă trebuie să fie mai mică decât nota maximă.');
  if (typeof i.model !== 'string' || !i.model.trim()) throw new UserError('Modelul nu poate fi gol.');
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
      .update({ rules: input.rules.trim(), grade_min: input.gradeMin, grade_max: input.gradeMax, model: input.model.trim() })
      .eq('id', 1)
      .select('id'),
  );
}
