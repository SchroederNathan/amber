// SDK 57's top-level createEventInCalendarAsync is a throwing deprecation stub;
// the working "present the system Add-Event sheet" helper lives in /legacy.
import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// The closed set of action kinds the AI can attach to an item. Mirrors the
// Convex `intentKindValidator` in convex/items.ts.
export type IntentKind =
  | 'open_url'
  | 'copy'
  | 'web_search'
  | 'open_maps'
  | 'call'
  | 'email'
  | 'message'
  | 'add_event';

/**
 * Execute an intent. Each kind maps to a guaranteed-installed Expo primitive.
 * `open_url` uses Linking (not WebBrowser) so an https URL can hand off to the
 * matching native app via universal links — e.g. an x.com URL opens the X app
 * if installed — falling back to the in-app browser only if nothing handles it.
 */
export async function runIntent(kind: IntentKind, value: string): Promise<void> {
  switch (kind) {
    case 'open_url':
      await Linking.openURL(value).catch(() =>
        WebBrowser.openBrowserAsync(value),
      );
      break;
    case 'copy':
      await Clipboard.setStringAsync(value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'web_search':
      await WebBrowser.openBrowserAsync(
        `https://www.google.com/search?q=${encodeURIComponent(value)}`,
      );
      break;
    case 'open_maps':
      await Linking.openURL(
        `https://maps.apple.com/?q=${encodeURIComponent(value)}`,
      );
      break;
    case 'call':
      await Linking.openURL(`tel:${value.replace(/[^\d+]/g, '')}`);
      break;
    case 'message':
      await Linking.openURL(`sms:${value.replace(/[^\d+]/g, '')}`);
      break;
    case 'email':
      await Linking.openURL(`mailto:${value}`);
      break;
    case 'add_event':
      // Presents the system "Add Event" sheet prefilled with the title; the
      // user picks the date/time. Requires calendar permission.
      await createEventInCalendarAsync({ title: value });
      break;
  }
}
