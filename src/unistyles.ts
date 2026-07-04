import { StyleSheet } from 'react-native-unistyles';

const shared = {
  fonts: {
    regular: 'Satoshi-Regular',
    medium: 'Satoshi-Medium',
    bold: 'Satoshi-Bold',
    display: 'ExposureTrial-0',
  },
  gap: (v: number) => v * 8,
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
  },
} as const;

const lightTheme = {
  ...shared,
  colors: {
    background: '#faf6ee',
    surface: '#fffdf8',
    surfaceMuted: '#f3ecdd',
    foreground: '#2b2418',
    muted: '#8d8271',
    faint: '#b5aa97',
    primary: '#e6a23c',
    primarySoft: '#f7e8cd',
    primaryText: '#9a6416',
    border: '#ece3d1',
    imageBorder: 'rgba(0, 0, 0, 0.07)',
    danger: '#c05a3a',
    overlay: 'rgba(43, 36, 24, 0.45)',
  },
} as const;

const darkTheme = {
  ...shared,
  colors: {
    background: '#191510',
    surface: '#231e16',
    surfaceMuted: '#2c261c',
    foreground: '#f4eddd',
    muted: '#a2977f',
    faint: '#6f6650',
    primary: '#e6a23c',
    primarySoft: '#3a2f1c',
    primaryText: '#f0c078',
    border: '#332c20',
    imageBorder: 'rgba(255, 255, 255, 0.07)',
    danger: '#e07a58',
    overlay: 'rgba(0, 0, 0, 0.55)',
  },
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
    adaptiveThemes: true,
  },
});
