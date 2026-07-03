import { StyleSheet } from 'react-native-unistyles';

const lightTheme = {
  colors: {
    background: '#ffffff',
    foreground: '#1c1c1e',
    primary: '#e6a23c',
    secondary: '#e6f4fe',
  },
  fonts: {
    regular: 'Satoshi-Regular',
    medium: 'Satoshi-Medium',
    bold: 'Satoshi-Bold',
    display: 'ExposureTrial-0',
  },
  gap: (v: number) => v * 8,
} as const;

const darkTheme = {
  colors: {
    background: '#1c1c1e',
    foreground: '#ffffff',
    primary: '#e6a23c',
    secondary: '#2c2c2e',
  },
  fonts: {
    regular: 'Satoshi-Regular',
    medium: 'Satoshi-Medium',
    bold: 'Satoshi-Bold',
    display: 'ExposureTrial-0',
  },
  gap: (v: number) => v * 8,
} as const;

const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

const breakpoints = {
  xs: 0,
  sm: 300,
  md: 500,
  lg: 800,
  xl: 1200,
} as const;

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: {
    initialTheme: 'light',
  },
});
