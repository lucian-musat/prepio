'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { LOGIN_FAILED_MESSAGE, NOT_ADMIN_MESSAGE } from './messages';

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: LOGIN_FAILED_MESSAGE };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: LOGIN_FAILED_MESSAGE };

  // Students share the same auth project: only accounts in `admins` may keep a session here.
  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
  if (rpcError || isAdmin !== true) {
    // Local scope: drop only this browser session, not the student's sessions in the app.
    await supabase.auth.signOut({ scope: 'local' });
    return { error: NOT_ADMIN_MESSAGE };
  }

  redirect('/');
}

export async function logout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
