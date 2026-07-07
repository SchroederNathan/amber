import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type FC,
  type PropsWithChildren,
} from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useDeckAnimation } from './deck-animation';
import { useSingleHapticOnPan } from './use-single-haptic-on-pan';

export type TidyAction = 'keep' | 'delete' | 'save';

const SPRING_CONFIG = {
  damping: 60,
  stiffness: 900,
};

// Short fling so the dismissed card clears the screen quickly and the next
// card is immediately swipeable.
const FLING_CONFIG = {
  duration: 220,
};

type CardAnimationValue = {
  panX: SharedValue<number>;
  panY: SharedValue<number>;
  absoluteYAnchor: SharedValue<number>;
  panDistanceX: number;
  panDistanceY: number;
};

const CardAnimationContext = createContext<CardAnimationValue | null>(null);

type Props = PropsWithChildren<{
  index: number;
  onDecision: (index: number, action: TidyAction) => void;
}>;

// One provider per card scopes pan shared values to a single stack element,
// mirroring the Slack Catch Up recreation. The gesture commits horizontally
// (keep/delete) like the reference and adds an upward commit (save); the
// dominant axis on release wins.
export const CardAnimationProvider: FC<Props> = ({ index, onDecision, children }) => {
  const { isDragging, animatedIndex, currentIndex, prevIndex } = useDeckAnimation();
  const { width, height } = useWindowDimensions();

  // Quarter-width matches the reference feel; the up-swipe threshold is a
  // taller fraction so accidental vertical drift doesn't trigger a save.
  const panDistanceX = width / 4;
  const panDistanceY = height / 5;

  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  // Grab point picks the rotation hinge direction (top half vs bottom half).
  const absoluteYAnchor = useSharedValue(0);

  const { singleHapticOnChange } = useSingleHapticOnPan({
    thresholdX: panDistanceX,
    thresholdY: panDistanceY,
  });

  const handleDecision = useCallback(
    (action: TidyAction) => {
      if (index === 0 && process.env.EXPO_OS === 'ios') {
        // Batch finished — the checkpoint state takes over after this card.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      // Commit immediately. The fling runs on the UI thread via shared values,
      // so a JS-side state update here can't jank it — and deferring would make
      // rapid successive swipes feel laggy.
      onDecision(index, action);
    },
    [index, onDecision],
  );

  // Memoized so decision-driven re-renders (mount window, counters) hand
  // GestureDetector the SAME instance — a fresh instance re-attaches the
  // native handler and cancels any pan that is already in flight.
  const gesture = useMemo(() => Gesture.Pan()
    .onBegin((event) => {
      isDragging.set(true);
      absoluteYAnchor.set(event.absoluteY);
    })
    .onChange((event) => {
      // Progress in card-index space: 1.0 of shift equals one card dismissed.
      // Horizontal and upward drags both advance; downward drag does not.
      const shift = Math.min(
        1,
        Math.max(
          Math.abs(event.translationX) / panDistanceX,
          Math.max(0, -event.translationY) / panDistanceY,
        ),
      );
      const progress = currentIndex.get() - shift;
      animatedIndex.set(
        progress < currentIndex.get() - 1 ? currentIndex.get() - 1 : progress,
      );

      panX.set(event.translationX);
      panY.set(event.translationY);

      singleHapticOnChange(event);
    })
    .onEnd((event) => {
      isDragging.set(false);

      const horizontal = Math.abs(event.translationX);
      const upward = -event.translationY;
      const commitUp = upward > panDistanceY && upward > horizontal;
      const commitSide = horizontal > panDistanceX && horizontal >= upward;

      if (commitUp || commitSide) {
        // The drag already walked animatedIndex to the next card (shift clamps
        // at 1 past the threshold), so only the integer indices move here.
        prevIndex.set(Math.round(currentIndex.get()));
        currentIndex.set(Math.round(currentIndex.get() - 1));

        // Fling the card fully off-screen with a short, snappy timing (no
        // withDecay — a long decay animation on an off-screen card keeps the
        // UI thread busy and makes the next card feel unresponsive). The
        // perpendicular axis snaps home quickly.
        if (commitUp) {
          panY.set(withTiming(-height * 1.15, FLING_CONFIG));
          panX.set(withTiming(0, { duration: 150 }));
          scheduleOnRN(handleDecision, 'save');
        } else {
          const sign = event.translationX > 0 ? 1 : -1;
          panX.set(withTiming(sign * width * 1.25, FLING_CONFIG));
          panY.set(withTiming(0, { duration: 150 }));
          scheduleOnRN(handleDecision, sign > 0 ? 'keep' : 'delete');
        }
      } else {
        panX.set(withSpring(0, SPRING_CONFIG));
        panY.set(withSpring(0, SPRING_CONFIG));
        // The index can be fractional on release; settle it back to the card.
        animatedIndex.set(withTiming(Math.ceil(currentIndex.get()), { duration: 200 }));
      }
    }),
    // Shared values are stable refs; everything else is a stable callback or
    // a screen dimension.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleDecision, singleHapticOnChange, width, height, panDistanceX, panDistanceY],
  );

  const value = useMemo(
    () => ({
      panX,
      panY,
      absoluteYAnchor,
      panDistanceX,
      panDistanceY,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panDistanceX, panDistanceY],
  );

  return (
    <CardAnimationContext.Provider value={value}>
      <GestureDetector gesture={gesture}>{children}</GestureDetector>
    </CardAnimationContext.Provider>
  );
};

export const useCardAnimation = () => {
  const context = useContext(CardAnimationContext);
  if (!context) {
    throw new Error('useCardAnimation must be used within a CardAnimationProvider');
  }
  return context;
};
