import { useAnimatedReaction, withTiming } from 'react-native-reanimated';
import { motion } from '@/theme/motion';

import { useCardAnimation } from './card-animation';
import { useDeckAnimation } from './deck-animation';

/**
 * Re-inserts a dismissed card when the header Undo fires, adapted from the
 * Slack Catch Up recreation. The screen sets `undoIndex` to the last
 * dismissed card's index; that card's reaction walks the deck indices back
 * up and eases its own pan offsets home.
 */
export function useUndoAnimation(index: number) {
  const { isDragging, animatedIndex, currentIndex, prevIndex, undoIndex } = useDeckAnimation();
  const { panX, panY, absoluteYAnchor } = useCardAnimation();

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
      animatedIndex.set(withTiming(currentIndex.get() + 1, motion.timing.enter));
      currentIndex.set(currentIndex.get() + 1);

      panX.set(withTiming(0, motion.timing.enter));
      panY.set(withTiming(0, motion.timing.enter));

      undoIndex.set(null);
    },
  );
}
