import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Opens an external http(s) URL. Native: an in-app browser (Custom Tab / SFSafariViewController).
 * Web: a new tab via react-native-web's Linking (`noopener`); expo-web-browser would open a small popup
 * window that keeps a `window.opener` handle on the student app.
 */
export function openExternal(href: string): void {
  if (Platform.OS === 'web') void Linking.openURL(href);
  else void WebBrowser.openBrowserAsync(href);
}
