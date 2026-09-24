import { alpha } from '@/theme';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * A canvas-colored linear fade pinned behind the transparent native header.
 * The iOS 26 soft scroll edge only blurs and lightly washes content, so this
 * finishes the job: content fades fully into the background under the status
 * bar and header items, then clears just below the header.
 *
 * Render it as a sibling AFTER the scrolling content, so the scroll view stays
 * the screen's first descendant (the native scroll edge effect relies on that).
 */
export function HeaderFade() {
  const headerHeight = useHeaderHeight();
  // Read in JS, not in StyleSheet.create: Unistyles doesn't re-apply
  // `experimental_backgroundImage` on a live theme change.
  const { theme } = useUnistyles();
  const bg = theme.colors.background;

  // Solid behind the status bar, then eased so the fade has no visible band
  // where it ends.
  const stops = [
    `${bg} 0%`,
    `${bg} 40%`,
    `${alpha(bg, 0.85)} 62%`,
    `${alpha(bg, 0.45)} 82%`,
    `${alpha(bg, 0.12)} 94%`,
    `${alpha(bg, 0)} 100%`,
  ];

  return (
    <View
      pointerEvents="none"
      style={[
        styles.fade,
        {
          height: headerHeight + FADE_TAIL,
          experimental_backgroundImage: `linear-gradient(to bottom, ${stops.join(', ')})`,
        },
      ]}
    />
  );
}

// How far past the header's bottom edge the fade keeps going.
const FADE_TAIL = 24;

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
