import { Platform, Share } from 'react-native';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

type WebNavigator = { share?: (data: { text: string }) => Promise<void>; clipboard?: { writeText?: (t: string) => Promise<void> } };
const webNavigator = (): WebNavigator | undefined => (typeof navigator === 'undefined' ? undefined : (navigator as unknown as WebNavigator));

/**
 * Puts text on the clipboard. No clipboard module is installed on native, so there the share sheet stands in
 * (it has a copy action); returns false when nothing could be done.
 */
export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== 'web') return (await shareText(text)) !== 'failed';
  try {
    const clipboard = webNavigator()?.clipboard;
    if (!clipboard?.writeText) return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Opens the share sheet (native, or the browser's where it exists); the web falls back to copying the text. */
export async function shareText(text: string): Promise<ShareResult> {
  if (Platform.OS !== 'web') {
    try {
      const r = await Share.share({ message: text });
      return r.action === Share.dismissedAction ? 'cancelled' : 'shared';
    } catch {
      return 'failed';
    }
  }
  const nav = webNavigator();
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // Any other failure: try copying instead.
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
