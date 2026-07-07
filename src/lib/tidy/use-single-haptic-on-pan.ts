import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import type {
  GestureUpdateEvent,
  PanGestureChangeEventPayload,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type Params = {
  thresholdX: number;
  /** Upward-drag threshold (positive number; compared against -translationY). */
  thresholdY: number;
};

/**
 * Fires one light impact when a pan first crosses a commit threshold on
 * either axis, re-arming once the drag falls back under both. Adapted from
 * the Slack Catch Up recreation's single-axis hook.
 */
export function useSingleHapticOnPan({ thresholdX, thresholdY }: Params) {
  const isTriggered = useSharedValue(false);

  const fire = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    isTriggered.set(true);
  };

  // Stable identity so the gesture that captures it can be memoized — a
  // recreated gesture instance re-attaches mid-pan and drops touches.
  const singleHapticOnChange = useCallback(
    (
      event: GestureUpdateEvent<PanGestureHandlerEventPayload & PanGestureChangeEventPayload>,
    ) => {
      'worklet';
      const overThreshold =
        Math.abs(event.translationX) > thresholdX || -event.translationY > thresholdY;

      if (overThreshold && !isTriggered.get()) {
        scheduleOnRN(fire);
      }
      if (!overThreshold && isTriggered.get()) {
        isTriggered.set(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thresholdX, thresholdY, isTriggered],
  );

  return { singleHapticOnChange };
}
