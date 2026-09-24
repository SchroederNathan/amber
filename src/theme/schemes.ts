import { palette, type Scale, type Step } from './palette';

/** Which accent steps become the fill, the soft chip background, and the chip label. */
export type AccentSteps = { fill: Step; soft: Step; text: Step };

/**
 * A color scheme is two Tailwind scales and nothing else. `gray` paints the
 * canvas, text, and hairlines; `accent` paints primary fills and tinted
 * controls. Every semantic role in ./colors.ts is derived from these, so a new
 * scheme is one entry below.
 */
export type ColorSchemeDefinition = {
  label: string;
  gray: Scale;
  accent: Scale;
  light: AccentSteps;
  dark: AccentSteps;
};

// A monochrome scheme's accent is its own gray: ink fills in light mode, paper
// fills in dark mode.
function monochrome(label: string, gray: Scale): ColorSchemeDefinition {
  return {
    label,
    gray,
    accent: gray,
    light: { fill: 900, soft: 200, text: 800 },
    dark: { fill: 50, soft: 700, text: 100 },
  };
}

// A chromatic accent over a gray. The defaults suit mid-bright hues (amber,
// sky, emerald); pass steps to darken the fill for deeper hues (blue, violet).
function accented(
  label: string,
  gray: Scale,
  accent: Scale,
  steps: { light?: Partial<AccentSteps>; dark?: Partial<AccentSteps> } = {},
): ColorSchemeDefinition {
  return {
    label,
    gray,
    accent,
    light: { fill: 500, soft: 100, text: 800, ...steps.light },
    dark: { fill: 400, soft: 950, text: 200, ...steps.dark },
  };
}

export const colorSchemes = {
  neutral: monochrome('Neutral', palette.neutral),
  stone: monochrome('Stone', palette.stone),
  zinc: monochrome('Zinc', palette.zinc),
  slate: monochrome('Slate', palette.slate),
  amber: accented('Amber', palette.stone, palette.amber),
  sky: accented('Sky', palette.slate, palette.sky, { light: { fill: 600 } }),
  violet: accented('Violet', palette.zinc, palette.violet, { light: { fill: 600 } }),
} as const satisfies Record<string, ColorSchemeDefinition>;

export type ColorSchemeName = keyof typeof colorSchemes;

export const defaultColorScheme: ColorSchemeName = 'neutral';

export function isColorSchemeName(value: unknown): value is ColorSchemeName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(colorSchemes, value);
}
