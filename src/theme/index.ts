import { buildColors, buildMedia, type Mode } from './colors';
import { control, opacity } from './controls';
import { motion } from './motion';
import { radius } from './radius';
import { colorSchemes, type ColorSchemeName } from './schemes';
import { shadows } from './shadows';
import { gap, spacing } from './spacing';
import { fonts, type } from './typography';

/**
 * Builds one complete Unistyles theme. Everything except color is shared by
 * every scheme and mode; colors come from the chosen scheme's two scales.
 */
export function createTheme(scheme: ColorSchemeName, mode: Mode) {
  const definition = colorSchemes[scheme];
  return {
    scheme,
    fonts,
    type,
    spacing,
    gap,
    motion,
    opacity,
    control,
    radius,
    shadows,
    colors: buildColors(definition, mode),
    media: buildMedia(definition),
  };
}

export type AppTheme = ReturnType<typeof createTheme>;

export { alpha, contrast, type AppColors, type MediaColors, type Mode } from './colors';
export { palette, type PaletteScaleName, type Scale, type Step } from './palette';
export {
  colorSchemes,
  defaultColorScheme,
  isColorSchemeName,
  type ColorSchemeDefinition,
  type ColorSchemeName,
} from './schemes';
