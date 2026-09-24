import { layoutMorphText, reconcileMorphCells, pruneMorphCells } from '@/lib/text-morph';
import { motion } from '@/theme/motion';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Text as RNText,
  StyleSheet as RNStyleSheet,
  View,
  useWindowDimensions,
  type TextProps,
  type TextStyle,
  type ViewProps,
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
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
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
// characters animate in (rise from below, grow, sharpen, fade), staggered left to right.
// Adapted from https://rnmotion.dev/animations/blurred-text-morph.

const FONTS: Record<string, number> = {
  'ExposureTrial-0': require('../../assets/fonts/ExposureTrial-0.otf'),
  'Satoshi-Regular': require('../../assets/fonts/Satoshi-Regular.otf'),
  'Satoshi-Medium': require('../../assets/fonts/Satoshi-Medium.otf'),
  'Satoshi-Bold': require('../../assets/fonts/Satoshi-Bold.otf'),
};

const morph = motion.textMorph;
const CANVAS_HEIGHT = 56;
// Fixed layout width. Kept just under the native header's title slot (~242pt
// between the bar buttons) so it is never clamped — iOS then centers the whole
// canvas on screen and the text, centered within it, lands dead-center.
const DEFAULT_WIDTH = 240;

type CharGlyphProps = {
  char: string;
  x: number;
  glyphWidth: number;
  charIndex: number;
  isExiting: boolean;
  animateIn: boolean;
  interrupted: boolean;
  font: SkFont;
  color: string;
  fontSize: number;
  baselineY: number;
  blurMax: number;
};

// Primitive props let unchanged glyphs skip reconciliation work.
const CharGlyph = memo(function CharGlyph({
  char,
  x,
  glyphWidth,
  charIndex,
  isExiting,
  animateIn,
  interrupted,
  font,
  color,
  fontSize,
  baselineY,
  blurMax,
}: CharGlyphProps) {
  const gx = useSharedValue(x);
  const progress = useSharedValue(animateIn || isExiting ? 0 : 1);
  const fade = useSharedValue(animateIn || isExiting ? 0 : 1);
  const direction = useSharedValue(1);

  const isFirstLayout = useRef(true);
  useEffect(() => {
    if (isFirstLayout.current) {
      isFirstLayout.current = false;
      return;
    }
    cancelAnimation(gx);
    gx.set(interrupted
      ? withTiming(x, motion.timing.feedback)
      : withDelay(morph.glideDelay, withTiming(x, morph.glide)));
  }, [x, interrupted, gx]);

  const firstAppearance = useRef(true);
  useEffect(() => {
    const staggerEntrance = firstAppearance.current && animateIn;
    firstAppearance.current = false;

    // withDelay keeps the PREVIOUS animation running during its delay. Stop
    // it explicitly, otherwise a returning letter continues fading to zero.
    cancelAnimation(progress);
    cancelAnimation(fade);

    if (!isExiting) {
      direction.set(1);
      // Reversals resume immediately from the current value. Only a newly
      // added letter receives the signature stagger.
      const delay = staggerEntrance ? morph.enterDelay + charIndex * morph.stagger : 0;
      progress.set(interrupted
        ? withTiming(1, motion.timing.feedback)
        : withDelay(delay, withSpring(1, morph.enter)));
      fade.set(interrupted
        ? withTiming(1, motion.timing.feedback)
        : withDelay(delay, withTiming(1, morph.reveal)));
    } else {
      direction.set(-1);
      const delay = charIndex * morph.stagger;
      progress.set(withDelay(delay, withTiming(0, morph.exit)));
      fade.set(withDelay(delay, withTiming(0, morph.exit)));
    }

    // Effect reactivation must always restore the target. A persistent phase
    // guard would skip setup after Reanimated cancels values during cleanup.
    return () => {
      cancelAnimation(progress);
      cancelAnimation(fade);
    };
  }, [isExiting, animateIn, interrupted, charIndex, direction, progress, fade]);

  const transform = useDerivedValue(() => {
    const settled = progress.get();
    const away = 1 - settled;
    const leaving = direction.get() < 0;
    return [
      { translateX: gx.get() + (leaving ? morph.exitRight * away : 0) },
      { translateY: baselineY + (leaving ? -morph.exitUp : morph.enterRise) * away },
      { scale: morph.scale + (1 - morph.scale) * settled },
    ];
  });
  const blur = useDerivedValue(() => blurMax * (1 - fade.get()));
  // Scale around the glyph's centre rather than the baseline origin.
  const origin = useMemo(
    () => ({ x: glyphWidth / 2, y: -fontSize * 0.34 }),
    [glyphWidth, fontSize],
  );

  return (
    <Group transform={transform} origin={origin} opacity={fade}>
      <SkiaText x={0} y={0} text={char} font={font} color={color} />
      <BlurMask blur={blur} style="normal" />
    </Group>
  );
});

export type AnimatedTextProps = {
  text: string;
  style?: TextProps['style'];
  containerStyle?: ViewProps['style'];
  width?: number;
  /** Layout height. The canvas includes overflow for the glyph travel and blur. */
  height?: number;
  blurMax?: number;
  /**
   * Glyph color; defaults to the theme's foreground. Pass it from `useUnistyles()`
   * rather than in `style`: Skia reads it in JS, so a Unistyles style's color
   * would stay stale when the appearance or color scheme changes.
   */
  color?: string;
};

export function AnimatedText({
  text,
  style,
  containerStyle,
  width = DEFAULT_WIDTH,
  height = CANVAS_HEIGHT,
  blurMax = morph.blur,
  color: colorProp,
}: AnimatedTextProps) {
  const { theme } = useUnistyles();
  // Expo's web typings widen TextStyle (e.g. `cursor: string`) past what RN 0.88's
  // strict `flatten` accepts, so hand it the parameter type it expects.
  const flat = (RNStyleSheet.flatten(style as Parameters<typeof RNStyleSheet.flatten>[0]) ?? {}) as TextStyle;
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : theme.type.sheetTitle.fontSize;
  const color = colorProp ?? theme.colors.foreground;
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const usePlainText = reducedMotion || fontScale > 1;
  const font = useFont(FONTS[flat.fontFamily ?? theme.fonts.display] ?? FONTS[theme.fonts.display], fontSize);

  // Compact header slots must not crop the rising/blurred letters at their edges.
  const overscan = Math.ceil(Math.max(morph.enterRise, morph.exitUp, morph.exitRight) + blurMax * 3);
  const baselineY = overscan + height / 2 + fontSize * 0.34;

  // Native text supports Dynamic Type; Reduce Motion skips spatial glyph effects.
  if (!font || usePlainText) {
    return (
      <View style={[styles.container, { width }, containerStyle]}>
        <RNText numberOfLines={1} style={[theme.type.sheetTitle, style, { color, maxWidth: '100%' }]}>{text}</RNText>
      </View>
    );
  }

  return (
    <MorphText
      text={text}
      font={font}
      fontSize={fontSize}
      color={color}
      width={width}
      height={height}
      overscan={overscan}
      baselineY={baselineY}
      blurMax={blurMax}
      containerStyle={containerStyle}
    />
  );
}

// Mount only when the font is ready, with a complete, opaque initial scene.
// Replacing the native font-loading fallback with an empty canvas caused a
// visible gap; rebuilding a native header must not replay a transparent title.
function MorphText({ text, font, fontSize, color, width, height, overscan, baselineY, blurMax, containerStyle }: {
  text: string;
  font: SkFont;
  fontSize: number;
  color: string;
  width: number;
  height: number;
  overscan: number;
  baselineY: number;
  blurMax: number;
  containerStyle?: ViewProps['style'];
}) {
  const measure = useMemo(() => (char: string) =>
    font.getGlyphWidths(font.getGlyphIDs(char)).reduce((sum, advance) => sum + advance, 0), [font]);
  const [{ cells, interrupted }, setTransition] = useState(() => ({
    cells: layoutMorphText(text, width, overscan, measure),
    interrupted: false,
  }));
  const scene = useRef(cells);
  const lastChange = useRef<{ text: string; at: number | null }>({ text, at: null });

  useEffect(() => {
    let cancelled = false;
    const now = performance.now();
    const present = layoutMorphText(text, width, overscan, measure);
    const textChanged = text !== lastChange.current.text;
    const morphWindow = morph.enterDelay + Math.max(0, present.length - 1) * morph.stagger + morph.enter.duration;
    const interrupted = textChanged && lastChange.current.at !== null && now - lastChange.current.at < morphWindow;
    if (textChanged) lastChange.current = { text, at: now };
    const next = reconcileMorphCells(scene.current, present, now, morph.exit.duration, morph.stagger, interrupted);
    scene.current = next;
    // This reconciles a stateful transition against the previous glyph scene.
    setTransition({ cells: next, interrupted });

    // Keep completion entirely on RN. A callback for each departing letter
    // crossed Worklets' remote-function registry and rebuilt the Skia scene N
    // times. One cancellable batch also prevents an old exit from deleting a
    // letter that returned and started another exit in the meantime.
    const lastExit = next.reduce((latest, cell) => Math.max(latest, cell.exitAt ?? 0), 0);
    const timer = lastExit > now ? setTimeout(() => {
      if (cancelled) return;
      const settled = pruneMorphCells(scene.current, performance.now());
      scene.current = settled;
      setTransition((current) => ({ ...current, cells: settled }));
    }, lastExit - now + 80) : undefined;

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, width, overscan, measure]);

  return (
    <View
      style={[styles.container, { width, height }, containerStyle]}
      accessible
      accessibilityLabel={text}
    >
      <Canvas
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -overscan,
          top: -overscan,
          width: width + overscan * 2,
          height: height + overscan * 2,
        }}
      >
        {cells.map((cell) => (
          <CharGlyph
            key={cell.key}
            char={cell.char}
            x={cell.x}
            glyphWidth={cell.width}
            charIndex={cell.index}
            isExiting={cell.phase === 'exit'}
            animateIn={cell.animateIn ?? false}
            interrupted={interrupted}
            font={font}
            color={color}
            fontSize={fontSize}
            baselineY={baselineY}
            blurMax={blurMax}
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
