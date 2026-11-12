import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ExpoRouter from 'expo-router';

const APP = 'Prepio';

/** The browser tab title: „<page> · Prepio”, or „Prepio” alone. */
export function pageTitle(name?: string): string {
  const n = name?.trim();
  return n ? `${n} · ${APP}` : APP;
}

/**
 * Focus of the enclosing route; outside a route tree (component tests, or a mocked expo-router without the hook)
 * the screen counts as focused. useIsFocused throws right after reading its context, so the hook order is stable.
 */
function useFocused(): boolean {
  const hook = (ExpoRouter as { useIsFocused?: () => boolean }).useIsFocused;
  if (typeof hook !== 'function') return true;
  try {
    return hook();
  } catch {
    return true;
  }
}

/**
 * Sets the document title (web only; renders nothing) whenever the screen is focused: the stack keeps a screen
 * mounted under the next one, so going back has to set it again.
 */
export function PageTitle({ name }: { name?: string }) {
  const title = pageTitle(name);
  const focused = useFocused();
  useEffect(() => {
    if (focused && Platform.OS === 'web' && typeof document !== 'undefined') document.title = title;
  }, [focused, title]);
  return null;
}
