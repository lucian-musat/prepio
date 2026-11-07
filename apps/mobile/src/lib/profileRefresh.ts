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
