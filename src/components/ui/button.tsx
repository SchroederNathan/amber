import { GlassView, isLiquidGlassAvailable, type GlassColorScheme } from 'expo-glass-effect';
import { useState, type ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { motion, motionCSS } from '@/theme/motion';
import { ThemedText } from './themed-text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const glass = isLiquidGlassAvailable();

type Variant = 'primary' | 'secondary' | 'destructive';
type Size = 'md' | 'lg';
/** The surface the button sits on, which picks its palette. */
type Tone = 'app' | 'media';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  tone?: Tone;
  icon?: ReactNode;
  loading?: boolean;
  style?: React.ComponentProps<typeof AnimatedPressable>['style'];
};

/**
 * Amber's capsule action. Where iOS supports Liquid Glass it is interactive glass
 * and the system owns the press response; elsewhere it is a solid fill that dims
 * and scales in. Loading dims the button instead of swapping in a spinner, so the
 * label stays put and nothing around the button reflows.
 */
export function Button({
  title, variant = 'primary', size = 'md', tone = 'app', icon, loading = false,
  disabled, style, onPressIn, onPressOut, ...props
}: Props) {
  const { theme } = useUnistyles();
  const reducedMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  // Glass animates its own press natively; the solid fallback mimics it in JS.
  const held = loading || (!glass && pressed);
  const palette: Record<Tone, {
    fill: string; onFill: string; tint: string; surface: string; label: string; border: string; scheme: GlassColorScheme;
  }> = {
    app: {
      fill: theme.colors.primary,
      onFill: theme.colors.onPrimary,
      tint: theme.colors.glassTint,
      surface: theme.colors.surface,
      label: theme.colors.foreground,
      border: theme.colors.border,
      scheme: 'auto',
    },
    media: {
      fill: theme.media.accent,
      onFill: theme.media.onAccent,
      tint: theme.media.control,
      surface: theme.media.control,
      label: theme.media.foreground,
      border: theme.media.control,
      scheme: 'dark',
    },
  };
  const colors = palette[tone];
  const filled = variant === 'primary';
  const labelColor = filled ? colors.onFill : variant === 'destructive' ? theme.colors.danger : colors.label;
  const content = (
    <>
      {icon}
      <ThemedText variant="button" style={[styles.label, { color: labelColor }]}>{title}</ThemedText>
    </>
  );

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      pressRetentionOffset={theme.control.pressRetentionOffset}
      {...props}
      disabled={inactive}
      onPressIn={(event) => { setPressed(true); onPressIn?.(event); }}
      onPressOut={(event) => { setPressed(false); onPressOut?.(event); }}
      style={[
        {
          opacity: held ? theme.opacity.held : inactive ? theme.opacity.disabled : 1,
          transform: [{ scale: held && !glass && !reducedMotion ? motion.scale.pressed : 1 }],
          transitionProperty: ['opacity', 'transform'],
          transitionDuration: motion.duration.feedback,
          transitionTimingFunction: motionCSS.out,
        },
        style,
      ]}
    >
      {glass ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive={!inactive}
          tintColor={filled ? colors.fill : colors.tint}
          colorScheme={colors.scheme}
          style={[styles.surface, styles[size]]}
        >
          {content}
        </GlassView>
      ) : (
        <View
          style={[
            styles.surface,
            styles[size],
            styles.solid,
            filled
              ? { backgroundColor: colors.fill }
              : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
          ]}
        >
          {content}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.full,
  },
  // Only the solid fallback clips. GlassView shapes its own corners natively, and
  // clipping it would cut off the interactive glass as it swells on press.
  solid: { overflow: 'hidden' },
  md: { minHeight: theme.control.minHeight, paddingVertical: theme.spacing.md },
  lg: { minHeight: theme.control.largeHeight, paddingVertical: theme.spacing.lg },
  label: { flexShrink: 1, textAlign: 'center' },
}));
