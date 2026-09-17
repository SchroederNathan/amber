import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const BADGE_SIZE = 26;

/**
 * The "Amber suggested this" marker: a sparkles symbol in a glass circle,
 * overlaid on a corner of the item image. When `onPress` is given, tapping
 * the badge IS the accept gesture — one tap files the item into the space.
 */
export function SuggestedBadge({
  size = BADGE_SIZE,
  onPress,
}: {
  size?: number;
  onPress?: () => void;
}) {
  const { theme } = useUnistyles();
  const circle = (
    <GlassView
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      glassEffectStyle="regular"
      isInteractive={onPress !== undefined}
    >
      <SymbolView
        name="sparkles"
        size={size * 0.55}
        tintColor={theme.colors.primary}
      />
    </GlassView>
  );
  if (onPress === undefined) {
    return <View pointerEvents="none">{circle}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add suggestion to space"
      onPress={onPress}
      hitSlop={Math.max(0, (theme.control.minHeight - size) / 2)}
      pressRetentionOffset={theme.control.pressRetentionOffset}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {circle}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
