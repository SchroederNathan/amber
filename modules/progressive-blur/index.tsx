import { requireNativeView } from 'expo';
import { useHeaderHeight } from 'expo-router/build/react-navigation';
import { Platform, StyleSheet, type ViewProps } from 'react-native';

// View modules resolve on iOS only; on Android (or an unlinked build) there's no
// native view to require, so the component below no-ops.
const NativeBlur =
  Platform.OS === 'ios' ? requireNativeView<ViewProps>('ProgressiveBlur') : null;

/**
 * A blurred band pinned to the top of the screen, sized to the
 * navigation header. Sits behind the (transparent) native header so scrolling
 * content dissolves into blur as it passes underneath, and the band's opacity
 * feathers out to clear near the header's bottom edge.
 *
 * This renders a standard public UIBlurEffect whose opacity feathers out across
 * the band via a gradient mask. iOS exposes no public API for a true
 * spatially-varying blur radius, so the falloff is an opacity fade rather than a
 * per-pixel radius change.
 *
 * Drop it in as an absolutely-positioned sibling AFTER the scrolling content so
 * it stays pinned while the feed scrolls beneath it.
 */
export function ProgressiveBlurHeader() {
  const headerHeight = useHeaderHeight();

  if (!NativeBlur) return null;

  return (
    <NativeBlur
      pointerEvents="none"
      // useHeaderHeight() spans the status bar + nav bar — exactly the
      // screen-top -> header-bottom band we want to blur.
      style={[StyleSheet.absoluteFill, { bottom: undefined, height: headerHeight }]}
    />
  );
}
