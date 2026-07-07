import { Image } from 'expo-image';
import { memo, useState, type FC } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';

import { TidyCardContainer } from './tidy-card-container';
import { TidyHints } from './tidy-hints';
import { useDeckAnimation } from '@/lib/tidy/deck-animation';
import type { TidyPhoto } from '@/lib/tidy/use-photo-batch';

/** How many cards below the top one keep their image decoded. */
const MOUNT_WINDOW = 3;

type Props = {
  photo: TidyPhoto;
  index: number;
  /** Top-card index when the batch mounts (batch length - 1). */
  topStart: number;
};

const inWindow = (index: number, top: number) =>
  index >= top - MOUNT_WINDOW && index <= top + 1;

const TidyCardComponent: FC<Props> = ({ photo, index, topStart }) => {
  const { isDragging, currentIndex } = useDeckAnimation();

  // Only cards near the top decode their image, keeping memory flat across a
  // batch of full-screen photos. Membership is derived from the shared
  // currentIndex on the UI thread, so advancing the deck re-renders only the
  // one or two cards whose visibility actually flips — not the whole stack.
  const [mounted, setMounted] = useState(() => inWindow(index, topStart));

  useAnimatedReaction(
    () => {
      // Inline the window check so it runs entirely on the UI thread — calling
      // an external helper here would break worklet compilation.
      const top = currentIndex.get();
      return index >= top - MOUNT_WINDOW && index <= top + 1;
    },
    (shouldMount, previous) => {
      if (shouldMount !== previous) {
        scheduleOnRN(setMounted, shouldMount);
      }
    },
  );

  const rHintsStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isDragging.get() ? 1 : 0, { duration: 150 }),
  }));

  return (
    <TidyCardContainer index={index}>
      {mounted && (
        <Image
          source={{ uri: photo.id }}
          style={styles.image}
          contentFit="cover"
          recyclingKey={photo.id}
          transition={100}
        />
      )}
      {mounted && photo.creationTime != null && (
        <View style={styles.dateChip}>
          <Text style={styles.dateText}>
            {new Date(photo.creationTime).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
      )}
      <Animated.View style={[styles.hints, rHintsStyle]} pointerEvents="none">
        <TidyHints />
      </Animated.View>
    </TidyCardContainer>
  );
};

export const TidyCard = memo(TidyCardComponent);

const styles = StyleSheet.create((theme) => ({
  image: {
    flex: 1,
  },
  hints: {
    ...StyleSheet.absoluteFillObject,
  },
  dateChip: {
    position: 'absolute',
    bottom: theme.gap(2),
    left: theme.gap(2),
    paddingHorizontal: theme.gap(1.5),
    paddingVertical: theme.gap(0.75),
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.overlay,
  },
  dateText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: 'white',
  },
}));
