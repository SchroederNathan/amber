import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Compact 40×26 switch (Discord-style port from rn-makeitanimated), recolored
// for the amber palette and with SF Symbols in the thumb instead of lucide.
const SWITCH_WIDTH = 40;
const THUMB_SIZE = 20;
const PADDING = 3;
const SWITCH_HEIGHT = THUMB_SIZE + PADDING * 2;
const MAX_OFFSET = SWITCH_WIDTH - THUMB_SIZE - PADDING * 2;

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function AnimatedSwitch({ value, onValueChange }: Props) {
  const { theme } = useUnistyles();
  const offset = useSharedValue(value ? MAX_OFFSET : 0);

  // Controlled: the thumb follows the prop, so an external change (e.g. form
  // prefill on the edit screen) animates the same as a tap.
  useEffect(() => {
    offset.set(
      withSpring(value ? MAX_OFFSET : 0, {
        damping: 100, // moderate bounce — not too springy
        stiffness: 1200, // fast response for immediate feedback
      }),
    );
  }, [value, offset]);

  const toggle = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onValueChange(!value);
  };

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));

  const trackOff = theme.colors.faint;
  const trackOn = theme.colors.primary;
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      offset.get(),
      [0, MAX_OFFSET],
      [trackOff, trackOn],
    ),
  }));

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          {/* Key swap re-triggers the ZoomIn as the state icon changes. */}
          {value ? (
            <Animated.View key="on" entering={ZoomIn}>
              <SymbolView name="checkmark" size={11} weight="black" tintColor={trackOn} />
            </Animated.View>
          ) : (
            <Animated.View key="off" entering={ZoomIn}>
              <SymbolView name="xmark" size={11} weight="bold" tintColor={trackOff} />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create(() => ({
  track: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: SWITCH_HEIGHT / 2,
    paddingHorizontal: PADDING,
    paddingVertical: PADDING,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#f8f5ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
