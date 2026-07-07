import { createContext, useContext, useMemo, type FC, type PropsWithChildren } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

// Deck-level animation coordination, adapted from the Slack Catch Up
// recreation (rn-makeitanimated). The stack is indexed top-card-last:
// currentIndex starts at total-1 and counts DOWN to -1 as cards are
// dismissed. animatedIndex is the fractional twin of currentIndex so cards
// behind the top one can interpolate scale/parallax mid-drag.
type DeckAnimationValue = {
  isDragging: SharedValue<boolean>;
  animatedIndex: SharedValue<number>;
  currentIndex: SharedValue<number>;
  prevIndex: SharedValue<number>;
  // Set to a card index to run the undo re-insertion animation on that card.
  undoIndex: SharedValue<number | null>;
};

const DeckAnimationContext = createContext<DeckAnimationValue | null>(null);

type Props = PropsWithChildren<{
  /** Index of the top card (batch length - 1). */
  lastIndex: number;
}>;

export const DeckAnimationProvider: FC<Props> = ({ lastIndex, children }) => {
  const isDragging = useSharedValue(false);
  const animatedIndex = useSharedValue(lastIndex);
  const currentIndex = useSharedValue(lastIndex);
  const prevIndex = useSharedValue(lastIndex);
  const undoIndex = useSharedValue<number | null>(null);

  const value = useMemo(
    () => ({ isDragging, animatedIndex, currentIndex, prevIndex, undoIndex }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <DeckAnimationContext.Provider value={value}>{children}</DeckAnimationContext.Provider>
  );
};

export const useDeckAnimation = () => {
  const context = useContext(DeckAnimationContext);
  if (!context) {
    throw new Error('useDeckAnimation must be used within a DeckAnimationProvider');
  }
  return context;
};
