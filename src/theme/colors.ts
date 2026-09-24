import { palette, steps, type Scale, type Step } from './palette';
import type { ColorSchemeDefinition } from './schemes';

export type Mode = 'light' | 'dark';

/** Adds an alpha channel to a `#rrggbb` color. */
export function alpha(hex: string, opacity: number): string {
  const channel = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${channel}`;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` colors. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mostReadable(on: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrast(on, c) > contrast(on, best) ? c : best));
}

// The first accent step, walking from `from` toward darker (`darken`) or
// lighter steps, that reaches `min` contrast against `against`. Chromatic fills
// are often too light for text (amber-500 on white is 2.1:1), so labels, icons,
// and switch tracks step away from the fill until they read.
function readableStep(scale: Scale, from: Step, darken: boolean, against: string, min = 4.5): string {
  const start = steps.indexOf(from);
  const walk = darken ? steps.slice(start) : steps.slice(0, start + 1).reverse();
  return scale[walk.find((step) => contrast(scale[step], against) >= min) ?? walk[walk.length - 1]];
}

/**
 * Maps a scheme's two scales onto the semantic roles components use. Screens
 * only ever see these names, so changing a scheme never touches a screen.
 */
export function buildColors(scheme: ColorSchemeDefinition, mode: Mode) {
  const { gray, accent } = scheme;
  const light = mode === 'light';
  const accentSteps = scheme[mode];
  const background = light ? gray[50] : gray[950];
  const primary = accent[accentSteps.fill];

  return {
    background,
    surface: light ? palette.white : gray[900],
    surfaceMuted: light ? gray[100] : gray[800],
    foreground: light ? gray[900] : gray[100],
    muted: light ? gray[500] : gray[400],
    faint: light ? gray[400] : gray[500],
    border: light ? gray[200] : gray[800],
    /** Filled actions: primary buttons, selection. */
    primary,
    /** Label and icon color on a `primary` fill. */
    onPrimary: mostReadable(primary, [palette.white, gray[950]]),
    /** Accent for text and icons on the canvas: tab bar, header buttons, spinners. */
    tint: readableStep(accent, accentSteps.fill, light, background),
    /** Native switch track. The thumb is always white, so the track darkens until it shows. */
    toggle: readableStep(accent, accentSteps.fill, true, palette.white, 3),
    /** Native switch thumb. iOS draws it white itself; Android needs it set. */
    toggleThumb: palette.white,
    /** Tinted chip / badge background, paired with `primaryText`. */
    primarySoft: accent[accentSteps.soft],
    primaryText: accent[accentSteps.text],
    // Secondary glass needs a faint fill to read on a flat canvas.
    glassTint: light ? alpha(gray[900], 0.06) : alpha(gray[50], 0.1),
    imageBorder: light ? alpha(palette.black, 0.07) : alpha(palette.white, 0.07),
    overlay: light ? alpha(gray[950], 0.45) : alpha(palette.black, 0.55),
    onOverlay: palette.white,
    danger: light ? palette.red[600] : palette.red[400],
    keep: palette.emerald[400],
    onKeep: palette.emerald[800],
  };
}

/**
 * Camera chrome and photo paper keep their contrast in both modes: they sit on
 * black viewfinders and photographs, never on the app canvas.
 */
export function buildMedia(scheme: ColorSchemeDefinition) {
  const dark = buildColors(scheme, 'dark');
  const paperAccent = readableStep(scheme.accent, scheme.light.fill, true, palette.white);
  return {
    background: palette.black,
    surface: scheme.gray[950],
    foreground: scheme.gray[100],
    muted: scheme.gray[400],
    inactive: alpha(palette.white, 0.55),
    overlay: alpha(palette.black, 0.45),
    control: alpha(palette.white, 0.12),
    paper: palette.white,
    /** Accent on dark chrome (the camera mode switch, filled media buttons). */
    accent: dark.primary,
    onAccent: dark.onPrimary,
    /** Accent on white paper (the shutter ring, swipe badges over photos). */
    paperAccent,
  };
}

export type AppColors = ReturnType<typeof buildColors>;
export type MediaColors = ReturnType<typeof buildMedia>;
