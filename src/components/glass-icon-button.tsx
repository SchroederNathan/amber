import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { PlatformColor, Pressable, type ViewStyle } from 'react-native';

type Props = {
  icon: SFSymbol;
  onPress: () => void;
  size?: number;
  tint?: string;
  style?: ViewStyle;
};

export function GlassIconButton({ icon, onPress, size = 17, tint, style }: Props) {
  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const symbol = (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => ({
        padding: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <SymbolView
        name={icon}
        size={size}
        tintColor={(tint ?? PlatformColor('label')) as string}
        weight="semibold"
      />
    </Pressable>
  );

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView isInteractive style={[{ borderRadius: 50 }, style]}>
        {symbol}
      </GlassView>
    );
  }

  return (
    <BlurView
      tint="systemMaterial"
      intensity={90}
      style={[{ borderRadius: 50, overflow: 'hidden' }, style]}
    >
      {symbol}
    </BlurView>
  );
}
