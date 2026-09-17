import { motion } from '@/styles/motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Text as RNText,
  StyleSheet as RNStyleSheet,
  View,
  useWindowDimensions,
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
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// A character-diffing text morph rendered through Skia so each glyph can carry a
// real Gaussian blur. When `text` changes, characters shared with the previous
// string persist (same key → same glyph) and glide to their new position, while
// removed characters animate out (up + right, shrink, blur, fade) and added
// characters animate in (rise from below, grow, sharpen, fade) within one short transition.

const FONTS: Record<string, number> = {
  'ExposureTrial-0': require('../../assets/fonts/ExposureTrial-0.otf'),
  'Satoshi-Regular': require('../../assets/fonts/Satoshi-Regular.otf'),
  'Satoshi-Medium': require('../../assets/fonts/Satoshi-Medium.otf'),
  'Satoshi-Bold': require('../../assets/fonts/Satoshi-Bold.otf'),
};

// Glyph-only optical travel, independent of layout spacing.
const ENTER_RISE = 14;
const EXIT_UP = 12;
const EXIT_RIGHT = 8;
const BLUR_MAX = 6;
const CANVAS_HEIGHT = 56;
// Fixed canvas width. Kept just under the native header's title slot (~242pt
// between the bar buttons) so it is never clamped — iOS then centers the whole
// canvas on screen and the text, centered within it, lands dead-center.
const DEFAULT_WIDTH = 240;

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
  blurMax: number;
  onExited: (key: string) => void;
};

// Memoized so removing one exited glyph (a setCells that keeps every other
// cell's reference) doesn't re-render the whole string — only cells whose props
// actually changed (e.g. a new x on a text swap, which drives the glide) rerun.
const CharGlyph = memo(function CharGlyph({
  cell,
  font,
  color,
  fontSize,
  baselineY,
  blurMax,
  onExited,
}: CharGlyphProps) {
  // gx = glide X (animates between layout positions); tx/ty = enter/exit offset.
  const gx = useSharedValue(cell.x);
  const tx = useSharedValue(0);
  const ty = useSharedValue(ENTER_RISE);
  const sc = useSharedValue<number>(motion.scale.enter);
  const op = useSharedValue(0);
  const bl = useSharedValue(blurMax);

  // A title changes during frequent navigation: keep the entire morph within
  // the feedback budget, with no per-character delay or unprompted bounce.
  useEffect(() => {
    const exiting = cell.phase === 'exit';
    ty.set(withTiming(exiting ? -EXIT_UP : 0, motion.timing.feedback));
    tx.set(withTiming(exiting ? EXIT_RIGHT : 0, motion.timing.feedback));
    sc.set(withTiming(exiting ? motion.scale.enter : 1, motion.timing.feedback));
    bl.set(withTiming(exiting ? blurMax : 0, motion.timing.feedback));
    op.set(withTiming(exiting ? 0 : 1, motion.timing.fade));
    if (!exiting) return;
    const timer = setTimeout(() => onExited(cell.key), motion.duration.feedback);
    return () => clearTimeout(timer);
  }, [cell.phase, cell.key, blurMax, onExited, ty, tx, sc, bl, op]);

  useEffect(() => {
    gx.set(withTiming(cell.x, motion.timing.textMove));
  }, [cell.x, gx]);

  const transform = useDerivedValue(() => [
    { translateX: gx.get() + tx.get() },
    { translateY: baselineY + ty.get() },
    { scale: sc.get() },
  ]);
  // Scale around the glyph's centre rather than the baseline origin.
  const origin = { x: cell.width / 2, y: -fontSize * 0.34 };

  return (
    <Group transform={transform} origin={origin} opacity={op}>
      <SkiaText x={0} y={0} text={cell.char} font={font} color={color} />
      <BlurMask blur={bl} style="normal" />
    </Group>
  );
});

export type AnimatedTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  width?: number;
  /** Canvas height; shrink it to sit the morph in a compact slot like a header. */
  height?: number;
  blurMax?: number;
};

export function AnimatedText({
  text,
  style,
  containerStyle,
  width = DEFAULT_WIDTH,
  height = CANVAS_HEIGHT,
  blurMax = BLUR_MAX,
}: AnimatedTextProps) {
  const { theme } = useUnistyles();
  const flat = (RNStyleSheet.flatten(style) ?? {}) as TextStyle;
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : theme.type.sheetTitle.fontSize;
  const color = typeof flat.color === 'string' ? flat.color : theme.colors.foreground;
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const usePlainText = reducedMotion || fontScale > 1;
  const font = useFont(FONTS[flat.fontFamily ?? theme.fonts.display] ?? FONTS[theme.fonts.display], fontSize);

  const baselineY = height / 2 + fontSize * 0.34;

  const seenRef = useRef<Map<string, Cell>>(new Map());
  const [cells, setCells] = useState<Cell[]>([]);

  useEffect(() => {
    if (!font || usePlainText) return;

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
  }, [text, font, width, usePlainText]);

  const removeCell = useCallback(
    (key: string) => setCells((prev) => prev.filter((c) => c.key !== key || c.phase !== 'exit')),
    [],
  );

  // Native text supports Dynamic Type; Reduce Motion skips spatial glyph effects.
  if (!font || usePlainText) {
    return (
      <View style={[styles.container, containerStyle]}>
        <RNText style={[theme.type.sheetTitle, { color }, style]}>{text}</RNText>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <Canvas style={{ width, height }} accessible accessibilityLabel={text}>
        {cells.map((cell) => (
          <CharGlyph
            key={cell.key}
            cell={cell}
            font={font}
            color={color}
            fontSize={fontSize}
            baselineY={baselineY}
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
