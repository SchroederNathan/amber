import { memo, type FC, type PropsWithChildren } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { useCardAnimation } from '@/lib/tidy/card-animation';
import { useDeckAnimation } from '@/lib/tidy/deck-animation';
import { useUndoAnimation } from '@/lib/tidy/use-undo-animation';

type Props = {
  index: number;
};

// Animated card shell, ported from the Slack Catch Up recreation's
// channel-container: behind-cards sit at 0.95 scale with a slight downward
// parallax and interpolate up as the top card leaves; the top card follows
// the pan and tilts up to 4° with the hinge direction picked by grab point.
const TidyCardContainerComponent: FC<PropsWithChildren<Props>> = ({ children, index }) => {
  const { width, height } = useWindowDimensions();
  const { animatedIndex, currentIndex } = useDeckAnimation();
  const { panX, panY, absoluteYAnchor, panDistanceX } = useCardAnimation();

  useUndoAnimation(index);

  const rContainerStyle = useAnimatedStyle(() => {
    const current = currentIndex.get();
    // Cull cards beyond the visible stack (top, two behind, one just
    // dismissed) to cut overdraw.
    const isVisible =
      index === current || index === current - 1 || index === current - 2 || index === current + 1;

    const inputRange = [index - 2, index - 1, index, index + 1, index + 2];

    const sign = absoluteYAnchor.get() > height / 2 ? -1 : 1;

    const top = interpolate(
      animatedIndex.get(),
      inputRange,
      [0, 0, 0, width * 0.07, width * 0.01],
      Extrapolation.CLAMP,
    );

    const rotate = interpolate(panX.get(), [0, panDistanceX], [0, sign * 4]);

    const scale = interpolate(
      animatedIndex.get(),
      inputRange,
      [1, 1, 1, 0.95, 0.95],
      Extrapolation.CLAMP,
    );

    return {
      top,
      opacity: isVisible ? 1 : 0,
      transform: [
        { translateX: panX.get() },
        { translateY: panY.get() },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });

  return <Animated.View style={[styles.container, rContainerStyle]}>{children}</Animated.View>;
};

export const TidyCardContainer = memo(TidyCardContainerComponent);

const styles = StyleSheet.create((theme) => ({
  container: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.imageBorder,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
}));
