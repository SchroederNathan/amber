import type { ColorValue } from 'react-native';

// iOS scrolls content under a transparent header, insets it automatically, and
// lays the native progressive blur over it. Android does none of that, so there
// the header is an opaque bar in the screen color and content starts below it.
export function barHeaderOptions(background: ColorValue) {
  return process.env.EXPO_OS === 'ios'
    ? { headerTransparent: true }
    : { headerTransparent: false, headerStyle: { backgroundColor: background } };
}
