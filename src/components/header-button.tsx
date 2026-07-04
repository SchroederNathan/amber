import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { PlatformColor, Pressable } from 'react-native';

type Props = {
  icon: SFSymbol;
  onPress: () => void;
  size?: number;
  tint?: string;
};

/**
 * A bare header bar-button. On iOS 26 the native stack header already renders
 * headerLeft/headerRight items inside a liquid-glass container, so this must
 * stay unwrapped — no GlassView/BlurView of its own.
 */
export function HeaderButton({ icon, onPress, size = 17, tint }: Props) {
  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <SymbolView
        name={icon}
        size={size}
        tintColor={(tint ?? PlatformColor('label')) as string}
        weight="semibold"
      />
    </Pressable>
  );
}
