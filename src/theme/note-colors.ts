import type { Mode } from './colors';
import { palette } from './palette';

/**
 * Note card fills, one per color a note can be saved in (the names match
 * `NOTE_COLORS` in convex/model/noteColors.ts). Pale in light mode and deep in
 * dark mode, so `colors.foreground` text reads on every one. They don't follow
 * the color scheme, and they live outside colors.ts on purpose: the config
 * plugins bundle colors.ts for native resources, so a change there changes the
 * native fingerprint.
 */
export function buildNoteColors(mode: Mode) {
  const light = mode === 'light';
  return {
    yellow: light ? palette.yellow[200] : palette.yellow[900],
    green: light ? palette.green[200] : palette.green[900],
    blue: light ? palette.blue[200] : palette.blue[900],
    pink: light ? palette.pink[200] : palette.pink[900],
  };
}
