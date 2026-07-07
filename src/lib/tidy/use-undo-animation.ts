import { useAnimatedReaction, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useCardAnimation } from './card-animation';
import { useDeckAnimation } from './deck-animation';

const DURATION = 300;

const UNDO_SPRING = {
  damping: 90,
  stiffness: 1000,
};

/**
 * Re-inserts a dismissed card when the header Undo fires, adapted from the
 * Slack Catch Up recreation. The screen sets `undoIndex` to the last
 * dismissed card's index; that card's reaction walks the deck indices back
 * up and springs its own pan offsets home.
 */
export function useUndoAnimation(index: number) {
  const { isDragging, animatedIndex, currentIndex, prevIndex, undoIndex } = useDeckAnimation();
  const { panX, panY, absoluteYAnchor } = useCardAnimation();

  // Re-arm after the animation settles so the same card can be dismissed and
  // undone again.
  const clearUndo = () => {
    setTimeout(() => {
      undoIndex.set(null);
    }, 250);
  };

  useAnimatedReaction(
    () => undoIndex.get(),
    (undoValue) => {
      if (undoValue === null || undoValue !== index) {
        return;
      }

      // Neutralize gesture side-effects during the programmatic re-insert.
      isDragging.set(false);
      absoluteYAnchor.set(0);

      // Order matters: consumers key off the integer currentIndex once
      // animatedIndex settles, so it moves last.
      prevIndex.set(currentIndex.get());
      animatedIndex.set(withTiming(currentIndex.get() + 1, { duration: DURATION }));
      currentIndex.set(currentIndex.get() + 1);

      panX.set(withSpring(0, UNDO_SPRING));
      panY.set(withSpring(0, UNDO_SPRING));

      scheduleOnRN(clearUndo);
    },
  );
}
