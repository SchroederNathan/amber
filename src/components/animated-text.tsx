import { useEffect, useRef, useState } from 'react';
import {
  Text as RNText,
  StyleSheet as RNStyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  BlurMask,
  Canvas,
  Group,
  Text as SkiaText,
  useFont,
  type SkFont,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// A character-diffing text morph rendered through Skia so each glyph can carry a
// real Gaussian blur. When `text` changes, characters shared with the previous
// string persist (same key → same glyph) and glide to their new position, while
// removed characters animate out (up + right, shrink, blur, fade) and added
// characters animate in (rise from below, grow, sharpen, fade) — each staggered.

const FONT = require('../../assets/fonts/ExposureTrial-0.otf');

const STAGGER_MS = 25; // per-character delay
const ENTER_DELAY_MS = 120; // lead so exiting letters clear before new ones arrive
const ENTER_RISE = 14; // px the incoming char rises from (below its target)
const EXIT_UP = 12; // px the outgoing char translates up
const EXIT_RIGHT = 8; // px the outgoing char translates right
const SHRINK = 0.7; // scale a char starts/ends at while entering/exiting
const BLUR_MAX = 6; // Gaussian blur (px) at the start of enter / end of exit
const MOVE_DURATION = 260;
const EXIT_DURATION = 240;
const GLIDE_DELAY_MS = 140; // persistent chars wait before sliding to their new spot
const GLIDE_DURATION = 320;
const CANVAS_HEIGHT = 56;
// Fixed canvas width. Kept just under the native header's title slot (~242pt
// between the bar buttons) so it is never clamped — iOS then centers the whole
// canvas on screen and the text, centered within it, lands dead-center.
const DEFAULT_WIDTH = 240;
const DEFAULT_FONT_SIZE = 24;

// Key each character by value + running occurrence count, so the n-th "a" keeps
// a stable identity across a swap and reconciles to the same glyph.
function toKeyedChars(text: string): { char: string; key: string }[] {
  const counts: Record<string, number> = {};
  return [...text].map((char) => {
    const n = counts[char] ?? 0;
    counts[char] = n + 1;
    return { char, key: `${char}#${n}` };
  });
}

type Cell = {
  key: string;
  char: string;
  x: number; // absolute left within the canvas
  width: number;
  index: number; // position used for stagger
  phase: 'present' | 'exit';
};

type CharGlyphProps = {
  cell: Cell;
  font: SkFont;
  color: string;
  fontSize: number;
  baselineY: number;
  staggerMs: number;
  blurMax: number;
  onExited: (key: string) => void;
};

function CharGlyph({
  cell,
  font,
  color,
  fontSize,
  baselineY,
  staggerMs,
  blurMax,
  onExited,
}: CharGlyphProps) {
  // gx = glide X (animates between layout positions); tx/ty = enter/exit offset.
  const gx = useSharedValue(cell.x);
  const tx = useSharedValue(0);
  const ty = useSharedValue(ENTER_RISE);
  const sc = useSharedValue(SHRINK);
  const op = useSharedValue(0);
  const bl = useSharedValue(blurMax);

  // Enter: on mount, cascade from below/blurred/faded/small into place.
  useEffect(() => {
    const delay = ENTER_DELAY_MS + cell.index * staggerMs;
    ty.set(withDelay(delay, withSpring(0)));
    sc.set(withDelay(delay, withSpring(1)));
    op.set(withDelay(delay, withTiming(1, { duration: MOVE_DURATION })));
    bl.set(withDelay(delay, withTiming(0, { duration: MOVE_DURATION })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Glide: persistent characters slide (after a short wait) to their new x.
  const firstX = useRef(true);
  useEffect(() => {
    if (firstX.current) {
      firstX.current = false;
      return;
    }
    gx.set(withDelay(GLIDE_DELAY_MS, withTiming(cell.x, { duration: GLIDE_DURATION })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.x]);

  // Exit: continue up + right, shrink, blur and fade, then drop the cell.
  useEffect(() => {
    if (cell.phase !== 'exit') return;
    const delay = cell.index * staggerMs;
    ty.set(withDelay(delay, withTiming(-EXIT_UP, { duration: EXIT_DURATION })));
    tx.set(withDelay(delay, withTiming(EXIT_RIGHT, { duration: EXIT_DURATION })));
    sc.set(withDelay(delay, withTiming(SHRINK, { duration: EXIT_DURATION })));
    bl.set(withDelay(delay, withTiming(blurMax, { duration: EXIT_DURATION })));
    op.set(withDelay(delay, withTiming(0, { duration: EXIT_DURATION })));
    const timer = setTimeout(() => onExited(cell.key), delay + EXIT_DURATION + 40);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.phase]);

  const transform = useDerivedValue(() => [
    { translateX: gx.value + tx.value },
    { translateY: baselineY + ty.value },
    { scale: sc.value },
  ]);
  // Scale around the glyph's centre rather than the baseline origin.
  const origin = { x: cell.width / 2, y: -fontSize * 0.34 };

  return (
    <Group transform={transform} origin={origin} opacity={op}>
      <SkiaText x={0} y={0} text={cell.char} font={font} color={color} />
      <BlurMask blur={bl} style="normal" />
    </Group>
  );
}

export type AnimatedTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  width?: number;
  staggerMs?: number;
  blurMax?: number;
};

export function AnimatedText({
  text,
  style,
  containerStyle,
  width = DEFAULT_WIDTH,
  staggerMs = STAGGER_MS,
  blurMax = BLUR_MAX,
}: AnimatedTextProps) {
  const { theme } = useUnistyles();
  const flat = (RNStyleSheet.flatten(style) ?? {}) as TextStyle;
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : DEFAULT_FONT_SIZE;
  const color = typeof flat.color === 'string' ? flat.color : theme.colors.foreground;
  const font = useFont(FONT, fontSize);

  const baselineY = CANVAS_HEIGHT / 2 + fontSize * 0.34;

  const seenRef = useRef<Map<string, Cell>>(new Map());
  const [cells, setCells] = useState<Cell[]>([]);

  useEffect(() => {
    if (!font) return;

    const keyed = toKeyedChars(text);
    // Use true glyph advance widths (not tight bounds) so spacing/positioning
    // is accurate — tight bounds drop trailing spaces and side bearings.
    const advances = font.getGlyphWidths(font.getGlyphIDs(text));
    const total = advances.reduce((sum, w) => sum + w, 0);
    // Center the string within the fixed-width canvas.
    const originX = (width - total) / 2;

    let cursor = originX;
    const present: Cell[] = keyed.map((k, index) => {
      const w = advances[index] ?? 0;
      const cell: Cell = { key: k.key, char: k.char, x: cursor, width: w, index, phase: 'present' };
      cursor += w;
      return cell;
    });

    const presentKeys = new Set(present.map((c) => c.key));
    const exiting: Cell[] = [];
    seenRef.current.forEach((cell, key) => {
      if (!presentKeys.has(key)) exiting.push({ ...cell, phase: 'exit' });
    });

    const nextSeen = new Map<string, Cell>();
    present.forEach((c) => nextSeen.set(c.key, c));
    seenRef.current = nextSeen;

    // Reconciling the previous glyph set against the new text is a stateful
    // transition (persist / enter / exit animations keyed off the prior set),
    // not a pure render derivation — so state is set from the effect by design.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCells([...present, ...exiting]);
  }, [text, font, width]);

  const removeCell = (key: string) => setCells((prev) => prev.filter((c) => c.key !== key));

  // Until the Skia font loads, fall back to plain text so the title still shows.
  if (!font) {
    return (
      <View style={[styles.container, containerStyle]}>
        <RNText style={style}>{text}</RNText>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <Canvas style={{ width, height: CANVAS_HEIGHT }}>
        {cells.map((cell) => (
          <CharGlyph
            key={cell.key}
            cell={cell}
            font={font}
            color={color}
            fontSize={fontSize}
            baselineY={baselineY}
            staggerMs={staggerMs}
            blurMax={blurMax}
            onExited={removeCell}
          />
        ))}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
