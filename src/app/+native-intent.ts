// expo-sharing launches the app with a `<scheme>://expo-sharing` deep link when
// something is shared into Amber from another app. Route those to the receiver
// screen; leave every other deep link untouched.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/share';
    }
  } catch {
    // Relative/malformed paths aren't share intents — fall through.
  }
  return path;
}
