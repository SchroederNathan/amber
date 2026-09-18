// Bound both the visible title and its retiring scene, including zero-width
// glyphs. Long saved notes must not allocate thousands of Skia/worklet nodes.
export const MAX_MORPH_GLYPHS = 48;

export type MorphCell = {
  key: string;
  char: string;
  x: number;
  width: number;
  index: number;
  phase: 'present' | 'exit';
  // Only glyphs added by a text change start transparent. A newly mounted
  // header must display its current title without waiting for an entrance.
  animateIn?: boolean;
  exitAt?: number;
};

export function layoutMorphText(
  text: string,
  width: number,
  overscan: number,
  measure: (char: string) => number,
): MorphCell[] {
  if (width <= 0) return [];
  const glyphs: { char: string; width: number }[] = [];
  let total = 0;
  let truncated = false;
  // Iterate only as far as the visible slot, without expanding a long note.
  for (const char of text) {
    const advance = Math.max(0, measure(char));
    if (glyphs.length === MAX_MORPH_GLYPHS || total + advance > width) {
      truncated = true;
      break;
    }
    glyphs.push({ char, width: advance });
    total += advance;
  }
  if (truncated) {
    const ellipsisWidth = Math.max(0, measure('…'));
    while (glyphs.length && (total + ellipsisWidth > width || glyphs.length === MAX_MORPH_GLYPHS)) {
      total -= glyphs.pop()!.width;
    }
    if (ellipsisWidth <= width) {
      glyphs.push({ char: '…', width: ellipsisWidth });
      total += ellipsisWidth;
    }
  }
  let cursor = overscan + (width - total) / 2;
  const counts = new Map<string, number>();
  return glyphs.map(({ char, width: advance }, index) => {
    const occurrence = counts.get(char) ?? 0;
    counts.set(char, occurrence + 1);
    const cell: MorphCell = {
      key: `${char}#${occurrence}`, char, x: cursor, width: advance, index, phase: 'present',
    };
    cursor += advance;
    return cell;
  });
}

export function reconcileMorphCells(
  previous: MorphCell[],
  present: MorphCell[],
  now: number,
  exitDuration: number,
  stagger: number,
  interrupted = false,
): MorphCell[] {
  // Rapid paging needs a readable current title. Do not stack another full
  // stagger on an unfinished morph, or keep fading-out fragments around it.
  if (interrupted) return present.map((cell) => ({ ...cell, animateIn: false }));
  const previousByKey = new Map(previous.map((cell) => [cell.key, cell]));
  const current = present.map((cell) => ({
    ...cell,
    animateIn: previousByKey.get(cell.key)?.animateIn ?? !previousByKey.has(cell.key),
  }));
  const keys = new Set(present.map((cell) => cell.key));
  const retiring: MorphCell[] = [];
  for (const old of previous) {
    if (keys.has(old.key)) continue;
    if (old.phase === 'exit') {
      if ((old.exitAt ?? 0) > now) retiring.push(old);
    } else {
      retiring.push({ ...old, phase: 'exit', exitAt: now + exitDuration + old.index * stagger });
    }
  }
  // Present cells precede previous exits, so newest departures have priority
  // when an extreme burst fills the bounded retiring layer.
  return [...current, ...retiring.slice(0, MAX_MORPH_GLYPHS)];
}

export function pruneMorphCells(cells: MorphCell[], now: number): MorphCell[] {
  return cells.filter((cell) => cell.phase === 'present' || (cell.exitAt ?? 0) > now);
}
