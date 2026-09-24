import { StyleSheet } from 'react-native-unistyles';
import { getStoredColorScheme } from './lib/color-scheme';
import { createTheme, type AppTheme } from './theme';

// All tokens live in ./theme. This file only registers them with Unistyles.
// `light` and `dark` are the adaptive pair the system appearance switches
// between; `setColorScheme` (lib/color-scheme) rebuilds both for a new scheme.
const scheme = getStoredColorScheme();

const appThemes = {
  light: createTheme(scheme, 'light'),
  dark: createTheme(scheme, 'dark'),
};

const breakpoints = {
  xs: 0,
  sm: 300,
  md: 500,
  lg: 800,
  xl: 1200,
} as const;

type AppThemes = { light: AppTheme; dark: AppTheme };
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  // Module augmentation requires empty extending interfaces (type aliases can't
  // merge across declarations), so the empty-object-type rule doesn't apply.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: {
    adaptiveThemes: true,
  },
});
