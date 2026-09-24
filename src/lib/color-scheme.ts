import {
  createTheme,
  defaultColorScheme,
  isColorSchemeName,
  type ColorSchemeName,
} from '@/theme';
import { createMMKV } from 'react-native-mmkv';
import { UnistylesRuntime, useUnistyles } from 'react-native-unistyles';

// The user's chosen color scheme. Read synchronously at launch (before
// StyleSheet.configure) so the first frame already paints in it.
const store = createMMKV({ id: 'appearance' });
const KEY = 'colorScheme';

export function getStoredColorScheme(): ColorSchemeName {
  const stored = store.getString(KEY);
  return isColorSchemeName(stored) ? stored : defaultColorScheme;
}

/**
 * Switches the whole app to another scheme, in place. Unistyles keeps
 * `light`/`dark` as its adaptive theme names, so both are rebuilt from the new
 * scheme and the system appearance still picks between them.
 */
export function setColorScheme(scheme: ColorSchemeName) {
  store.set(KEY, scheme);
  UnistylesRuntime.updateTheme('light', () => createTheme(scheme, 'light'));
  UnistylesRuntime.updateTheme('dark', () => createTheme(scheme, 'dark'));
}

/** The active scheme's name; re-renders when `setColorScheme` runs. */
export function useColorSchemeName(): ColorSchemeName {
  return useUnistyles().theme.scheme;
}
