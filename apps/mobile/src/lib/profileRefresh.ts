/**
 * Lets the API layer (plain functions, outside React) ask the AuthProvider to re-read the profile, e.g. when the
 * server says the student is suspended: the refreshed profile moves the root guard to the suspended screen.
 * The AuthProvider registers its `refreshProfile` while mounted.
 */
type Refresher = () => Promise<unknown>;

let current: Refresher | null = null;

/** Registers the refresher; returns the unregister function (it only clears its own registration). */
export function registerProfileRefresh(fn: Refresher): () => void {
  current = fn;
  return () => {
    if (current === fn) current = null;
  };
}

/** Re-reads the profile through the registered refresher. Never throws; does nothing when none is registered. */
export async function refreshRegisteredProfile(): Promise<void> {
  if (!current) return;
  try {
    await current();
  } catch (e) {
    console.warn('[profile] refresh failed:', e);
  }
}

/** Postgres insufficient_privilege: what RLS returns for a suspended student's writes. */
const INSUFFICIENT_PRIVILEGE = '42501';

/** Refreshes the profile when a write failed with 42501, so a mid-session suspension reaches the suspended screen. */
export async function refreshIfDenied(error: { code?: string } | null | undefined): Promise<void> {
  if (error?.code === INSUFFICIENT_PRIVILEGE) await refreshRegisteredProfile();
}

/**
 * Same idea for the access state: the AccessProvider registers its `refresh` while mounted, and the API layer calls
 * it when the server answers 403 `access_required` (access ended while the student was inside a lesson).
 */
let currentAccess: Refresher | null = null;

export function registerAccessRefresh(fn: Refresher): () => void {
  currentAccess = fn;
  return () => {
    if (currentAccess === fn) currentAccess = null;
  };
}

/** Re-reads the access state through the registered refresher. Never throws; does nothing when none is registered. */
export async function refreshRegisteredAccess(): Promise<void> {
  if (!currentAccess) return;
  try {
    await currentAccess();
  } catch (e) {
    console.warn('[access] refresh failed:', e);
  }
}
