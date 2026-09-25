// Rewrites deep links the OS hands the app before Expo Router resolves them.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path);
    // expo-sharing launches the app with a `<scheme>://expo-sharing` deep link
    // when something is shared into Amber from another app.
    if (url.hostname === 'expo-sharing') {
      return '/share';
    }
    // Clerk's useSSO redirects the OAuth browser to `<scheme>:///sso-callback`.
    // On iOS the auth session swallows it, but on Android the Custom Tab hands
    // it to the app as a normal deep link, which has no route. The pending
    // startSSOFlow promise already reads the URL, so ignore it while the app is
    // running. On a cold start (Android killed the app during sign-in), go
    // home and let the auth guards pick the screen.
    if (url.hostname === 'sso-callback' || url.pathname === '/sso-callback') {
      return initial ? '/' : null;
    }
  } catch {
    // Relative/malformed paths aren't intents we handle — fall through.
  }
  return path;
}
