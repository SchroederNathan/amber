import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const devices = {
  camera: require('@assets/images/onboarding/device-camera.png'),
  photos: require('@assets/images/onboarding/device-photos.png'),
  biometrics: require('@assets/images/onboarding/device-biometrics.png'),
};

// Mount the native image views up front so the next device can load before its slide.
export function PermissionDevice({ kind, index, progress, width, size, top, reducedMotion }: {
  kind: keyof typeof devices;
  index: number;
  progress: SharedValue<number>;
  width: number;
  size: number;
  top: number;
  reducedMotion: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = index - progress.get();
    return {
      transform: [{ translateX: reducedMotion ? 0 : offset * width }],
      opacity: reducedMotion ? Math.max(0, 1 - Math.abs(offset)) : 1,
    };
  });
  return (
    <Animated.Image
      source={devices[kind]}
      style={[
        { position: 'absolute', top, left: (width - size) / 2, width: size, height: size },
        animatedStyle,
      ]}
      resizeMode="contain"
      fadeDuration={0}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onError={({ nativeEvent }) => {
        if (__DEV__) console.warn(`Could not load the ${kind} onboarding device: ${nativeEvent.error}`);
      }}
    />
  );
}
