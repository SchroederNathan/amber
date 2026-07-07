import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { type FC } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useCardAnimation } from '@/lib/tidy/card-animation';

// Direction hint overlay, adapted from the Slack Catch Up recreation's
// color-background + mark-view: a solid tint per swipe direction plus a badge
// whose circular arc fills as the drag approaches the commit threshold.

const BADGE_SIZE = 60;
const STROKE_WIDTH = 3;
const ICON_SIZE = 24;

const KEEP_TINT = '#34d399';
const KEEP_ACCENT = '#065f46';

type Direction = 'keep' | 'delete' | 'save';

/** Fraction of the commit threshold covered, 0 at rest, 1 at commit. */
function useDirectionProgress(direction: Direction) {
  const { panX, panY, panDistanceX, panDistanceY } = useCardAnimation();

  return useDerivedValue(() => {
    switch (direction) {
      case 'keep':
        return panX.get() / panDistanceX;
      case 'delete':
        return -panX.get() / panDistanceX;
      case 'save':
        return -panY.get() / panDistanceY;
    }
  });
}

const Tint: FC<{ direction: Direction; color: string }> = ({ direction, color }) => {
  const progress = useDirectionProgress(direction);

  const rTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 0.55], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.tint, rTintStyle, { backgroundColor: color }]} />
  );
};

type BadgeProps = {
  direction: Direction;
  label: string;
  icon: SFSymbol;
  accentColor: string;
};

const Badge: FC<BadgeProps> = ({ direction, label, icon, accentColor }) => {
  const progress = useDirectionProgress(direction);

  const rBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // Small buffer so the fill flips as the arc looks visually complete.
  const buffer = STROKE_WIDTH / 2 / BADGE_SIZE;

  const rCircleStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      progress.get() + buffer > 1 ? 'white' : 'transparent',
      { duration: 50 },
    ),
  }));

  const rAccentIconStyle = useAnimatedStyle(() => ({
    opacity: withTiming(progress.get() + buffer > 1 ? 1 : 0, { duration: 200 }),
  }));

  const arcPath = useDerivedValue(() => {
    const skPath = Skia.Path.Make();
    const sweepDegrees = Math.max(0, progress.get()) * 360;
    skPath.addArc(
      {
        x: STROKE_WIDTH / 2,
        y: STROKE_WIDTH / 2,
        width: BADGE_SIZE - STROKE_WIDTH,
        height: BADGE_SIZE - STROKE_WIDTH,
      },
      -90,
      sweepDegrees,
    );
    return skPath;
  });

  return (
    <Animated.View style={[styles.badge, rBadgeStyle]}>
      <Animated.View style={[styles.badgeCircle, rCircleStyle]}>
        <Canvas style={styles.badgeCanvas}>
          <Path
            path={arcPath}
            color="white"
            style="stroke"
            strokeWidth={STROKE_WIDTH}
            strokeCap="round"
          />
        </Canvas>
        <View style={styles.badgeIconStack}>
          <Animated.View style={styles.badgeIcon}>
            <SymbolView name={icon} size={ICON_SIZE} tintColor="white" />
          </Animated.View>
          <Animated.View style={[styles.badgeIcon, rAccentIconStyle]}>
            <SymbolView name={icon} size={ICON_SIZE} tintColor={accentColor} />
          </Animated.View>
        </View>
      </Animated.View>
      <Text style={styles.badgeLabel}>{label}</Text>
    </Animated.View>
  );
};

export const TidyHints: FC = () => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container} pointerEvents="none">
      <Tint direction="keep" color={KEEP_TINT} />
      <Tint direction="delete" color={theme.colors.danger} />
      <Tint direction="save" color={theme.colors.primary} />
      <View style={styles.topRow}>
        <Badge direction="keep" label="Keep" icon="checkmark" accentColor={KEEP_ACCENT} />
        <Badge
          direction="delete"
          label="Delete"
          icon="trash"
          accentColor={theme.colors.danger}
        />
      </View>
      <View style={styles.bottomRow}>
        <Badge
          direction="save"
          label="Save to Amber"
          icon="arrow.up"
          accentColor={theme.colors.primary}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    position: 'absolute',
    top: theme.gap(3),
    left: theme.gap(3),
    right: theme.gap(3),
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bottomRow: {
    position: 'absolute',
    bottom: theme.gap(4),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    gap: theme.gap(1),
  },
  badgeCircle: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCanvas: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
  },
  badgeIconStack: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
  },
}));
