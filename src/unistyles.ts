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
  // `held` is a Button's pressed and loading look: dimmed, never replaced by a spinner.
  opacity: { pressed: 0.7, held: 0.85, disabled: 0.4 },
  control: { minHeight: 48, largeHeight: 56, pressRetentionOffset: 12 },
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
  // Soft, capsule-adjacent corners to match the capsule buttons. Steps are
  // concentric: a matted photo's inner radius is its frame's radius minus the
  // mat (md 20 - 4pt mat = sm 16; lg 28 - 8pt mat = md 20).
  radius: {
    sm: 16,
    md: 20,
    lg: 28,
    xl: 32,
    full: 9999,
  },
} as const;

const lightTheme = {
  ...shared,
  // Tailwind stone. Onboarding has a brighter, neutral canvas; its actions use
  // the one brand fill, `colors.primary`, like the rest of the app.
  onboarding: {
    background: '#fafaf9',
    hero: '#f0eeec',
    foreground: '#1c1917',
    muted: '#57534e',
    secondary: '#ffffff',
    border: '#d6d3d1',
    // Secondary glass needs a faint fill to read on a flat canvas.
    glassTint: 'rgba(28, 25, 23, 0.06)',
  },
  colors: {
    background: '#faf6ee',
    surface: '#fffdf8',
    surfaceMuted: '#f3ecdd',
    foreground: '#2b2418',
    muted: '#7a6f5f',
    faint: '#978c7a',
    primary: '#e6a23c',
    primarySoft: '#f7e8cd',
    primaryText: '#935d09',
    border: '#ece3d1',
    // Secondary glass needs a faint fill to read on a flat canvas.
    glassTint: 'rgba(43, 36, 24, 0.07)',
    imageBorder: 'rgba(0, 0, 0, 0.07)',
    danger: '#b75232',
    overlay: 'rgba(43, 36, 24, 0.45)',
    // Dark label on the amber fill; white on #e6a23c is 2.19:1.
    onTint: '#2b2418',
    onOverlay: '#ffffff',
    keep: '#34d399',
    onKeep: '#065f46',
    tabTint: '#bf8114',
  },
} as const;

const darkTheme = {
  ...shared,
  onboarding: {
    background: '#0c0a09',
    hero: '#1c1917',
    foreground: '#fafaf9',
    muted: '#a8a29e',
    secondary: '#292524',
    border: '#57534e',
    glassTint: 'rgba(250, 250, 249, 0.1)',
  },
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
    glassTint: 'rgba(244, 237, 221, 0.1)',
    imageBorder: 'rgba(255, 255, 255, 0.07)',
    danger: '#e07a58',
    overlay: 'rgba(0, 0, 0, 0.55)',
    // The amber fill is shared, so the dark label is too.
    onTint: '#2b2418',
    onOverlay: '#ffffff',
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
