import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

function fire() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/** Latch on the UI thread: at most one haptic per pan, including a short flick. */
export function useSingleHapticOnPan({ thresholdX, thresholdY }: {
  thresholdX: number;
  thresholdY: number;
}) {
  const isTriggered = useSharedValue(false);
  const resetHaptic = useCallback(() => {
    'worklet';
    isTriggered.set(false);
  }, [isTriggered]);
  const commitHaptic = useCallback(() => {
    'worklet';
    if (!isTriggered.get()) {
      isTriggered.set(true);
      scheduleOnRN(fire);
    }
  }, [isTriggered]);
  const singleHapticOnChange = useCallback((x: number, y: number) => {
    'worklet';
    if (Math.abs(x) > thresholdX || -y > thresholdY) commitHaptic();
  }, [thresholdX, thresholdY, commitHaptic]);
  return { singleHapticOnChange, resetHaptic, commitHaptic };
}
