import { StyleSheet } from 'react-native-unistyles';
import { motion } from './styles/motion';

const fonts = {
  regular: 'Satoshi-Regular',
  medium: 'Satoshi-Medium',
  bold: 'Satoshi-Bold',
  display: 'ExposureTrial-0',
} as const;

const shared = {
  fonts,
  // Preserve Amber's established type ramp and bundled font weights.
  type: {
    hero: { fontFamily: fonts.display, fontSize: 48 },
    largeTitle: { fontFamily: fonts.display, fontSize: 26 },
    sheetTitle: { fontFamily: fonts.display, fontSize: 24 },
    title: { fontFamily: fonts.display, fontSize: 22 },
    header: { fontFamily: fonts.display, fontSize: 19 },
    displaySmall: { fontFamily: fonts.display, fontSize: 18 },
    reader: { fontFamily: fonts.regular, fontSize: 18 },
    headline: { fontFamily: fonts.bold, fontSize: 17 },
    body: { fontFamily: fonts.regular, fontSize: 16 },
    bodyLabel: { fontFamily: fonts.medium, fontSize: 16 },
    button: { fontFamily: fonts.bold, fontSize: 16 },
    subhead: { fontFamily: fonts.regular, fontSize: 15 },
    subheadLabel: { fontFamily: fonts.medium, fontSize: 15 },
    subheadStrong: { fontFamily: fonts.bold, fontSize: 15 },
    footnote: { fontFamily: fonts.regular, fontSize: 14 },
    secondaryLabel: { fontFamily: fonts.medium, fontSize: 14 },
    caption: { fontFamily: fonts.regular, fontSize: 13 },
    label: { fontFamily: fonts.medium, fontSize: 13 },
    labelStrong: { fontFamily: fonts.bold, fontSize: 13 },
    captionLabel: { fontFamily: fonts.medium, fontSize: 12 },
    captionStrong: { fontFamily: fonts.bold, fontSize: 12 },
    finePrint: { fontFamily: fonts.regular, fontSize: 11 },
    badge: { fontFamily: fonts.bold, fontSize: 10 },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 },
  // Existing layouts use this 8pt helper; new styles use named 4pt steps above.
  gap: (v: number) => v * 8,
  motion,
  opacity: { pressed: 0.7, disabled: 0.4 },
  control: { minHeight: 48, pressRetentionOffset: 12 },
  // Camera chrome and photo paper intentionally keep their contrast in both themes.
  media: {
    background: '#000000',
    surface: '#12100c',
    foreground: '#f4eddd',
    muted: '#a2977f',
    inactive: 'rgba(255, 255, 255, 0.55)',
    overlay: 'rgba(0, 0, 0, 0.45)',
    control: 'rgba(255, 255, 255, 0.12)',
    paper: '#ffffff',
  },
  shadows: {
    sticker: '0 3px 8px rgba(0, 0, 0, 0.18)',
    raised: '0 1px 4px rgba(0, 0, 0, 0.12)',
    camera: '0 2px 12px rgba(0, 0, 0, 0.4)',
    photoStack: '0 6px 14px rgba(0, 0, 0, 0.22)',
    text: { textShadowColor: 'rgba(0, 0, 0, 0.35)', textShadowRadius: 6 },
  },
  radius: {
    sm: 8,
    md: 11,
    lg: 16,
    xl: 24,
    full: 9999,
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
    onTint: '#ffffff',
    keep: '#34d399',
    onKeep: '#065f46',
    tabTint: '#c98a24',
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
    onTint: '#ffffff',
    keep: '#34d399',
    onKeep: '#065f46',
    tabTint: '#e6a23c',
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
