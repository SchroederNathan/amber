import { requireNativeView } from 'expo';
import { useHeaderHeight } from 'expo-router/build/react-navigation';
import { Platform, StyleSheet, type ViewProps } from 'react-native';

type NativeProps = ViewProps & {
  /** Max blur radius (points) at the fully-blurred top edge. */
  intensity?: number;
};

// View modules resolve on iOS only; on Android (or an unlinked build) there's no
// native view to require, so the component below no-ops.
const NativeBlur =
  Platform.OS === 'ios' ? requireNativeView<NativeProps>('ProgressiveBlur') : null;

/**
 * A progressive blur band pinned to the top of the screen, sized to the
 * navigation header. Sits behind the (transparent) native header so scrolling
 * content dissolves into blur as it passes underneath, and fades to perfectly
 * sharp at the header's bottom edge.
 *
 * Drop it in as an absolutely-positioned sibling AFTER the scrolling content so
 * it stays pinned while the feed scrolls beneath it.
 */
export function ProgressiveBlurHeader({ intensity = 16 }: { intensity?: number }) {
  const headerHeight = useHeaderHeight();

  if (!NativeBlur) return null;

  return (
    <NativeBlur
      intensity={intensity}
      pointerEvents="none"
      // useHeaderHeight() spans the status bar + nav bar — exactly the
      // screen-top -> header-bottom band we want to blur.
      style={[StyleSheet.absoluteFill, { bottom: undefined, height: headerHeight }]}
    />
  );
}
