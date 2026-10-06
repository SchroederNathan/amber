# Biometric app lock

Amber keeps Apple/Google sign-in and Clerk's supported token cache. One biometric setting does two jobs, and both use a Clerk biometric credential:

- **Lock.** While signed in, the lock covers every private route and data provider. Unlocking reverifies the Clerk session with the credential.
- **Sign-in.** After a sign-out or an expired session, the sign-in screen offers "Sign in with Face ID" (or Touch ID / Biometrics). This creates a new Clerk session from the same credential.

## Documentation review

Checked against `@clerk/expo` 4.8.1 and `@clerk/expo-biometrics` 1.0.0 on October 5, 2026:

- [useBiometricCredentials()](https://clerk.com/docs/reference/expo/native-hooks/use-biometric-credentials) (from `@clerk/expo/biometrics`) enrolls, lists, revokes, signs in and reverifies.
- [Biometric sign-in guide](https://clerk.com/docs/expo/guides/development/custom-flows/authentication/biometric-sign-in). Enrollment creates a P-256 key in the Secure Enclave or Android Keystore and registers its public key with Clerk. Each sign-in or reverification signs a one-time Clerk challenge after the system prompt.
- Amber uses the default `biometry_current_set` policy. It is the only policy that `reverify()` accepts, and adding or removing a face or fingerprint invalidates the key. There is no device-passcode fallback.
- The `@clerk/expo` config plugin's `faceIDPermission` sets `NSFaceIDUsageDescription`. `expo-secure-store` also writes this key, so both plugins in `app.json` must use the same string.
- Both Clerk packages declare `expo >=54 <58` as a peer. The 3.7.6 release declared the same range, so bun prints the same peer warning as before. The iOS build compiles on SDK 58 with Xcode 27.1.

### Clerk Dashboard prerequisites

1. **Native applications**: the Native API is on (it already was).
2. **User & Authentication → Biometric**: turn on **Sign-in with mobile biometrics**. Leave the prebuilt-view prompts off, because Amber uses a custom flow.

When this setting is off, Clerk reports `feature_disabled`. The switch in Settings is then disabled, the footer says the lock is not available, and onboarding skips the step.

## Behavior and boundaries

- **Turn on** (onboarding or Settings): `enroll()` shows one biometric prompt. Amber saves the returned credential ID (`amber.lock-credential.<userId>`, SecureStore, this device only) next to the per-account opt-in (`amber.lock.<userId>`).
- **Unlock**: `reverify({ level: 'first_factor' })`. Clerk checks the signature on its server, updates the session's verification and refreshes its token. No new session is created. Each unlock makes four network calls. Two of them happen before the prompt shows, so unlocking needs a connection. Amber already needs one to load saves after an unlock.
- **Turn off**: Amber reverifies, then revokes this device's credential, then saves the opt-out. If the revoke fails (for example, offline), the lock stays on and the footer says why. Clerk also deletes the local key when it revokes.
- **Biometric sign-in**: signed out, `getAvailability()` checks only local state. If Clerk later reports that the credential is gone, the SDK deletes the local copy, and Amber hides the button again. The new session opens without a second prompt (`biometric-session.ts`, valid for 30 seconds). Later locks work as usual.
- Cold starts and new Apple/Google sessions start locked. The two-minute grace period, the app-switcher protection and the widget behavior did not change.
- Cancel, lockout, a changed biometric set, a missing credential and network errors never reveal content. The lock screen tells the user to connect, to try again, or to sign out to reset.
- Enrolling on iOS deletes the other local credentials for the same app identifier, including other accounts' credentials (Clerk's `removeOtherRecordsForApp`). If two accounts use the lock on one phone, the account that enrolled first must reset its lock.

Biometrics identify someone enrolled on the device, not a unique Clerk account owner. The client-side lock does not protect Convex data on its own. Convex still checks the Clerk session, and nothing on the server requires a fresh reverification today.

## Migration from the SecureStore lock

Before this change, the lock stored a biometric-protected SecureStore proof (`amber.lock-proof.<userId>`). An account that has the opt-in but no Clerk credential ID uses the old proof one last time. After that unlock, Amber enrolls the device (a second prompt) and deletes the proof. If enrollment fails (for example, the dashboard setting is off), the old proof keeps working and the next unlock tries again. Remove this path once old builds are gone.

## Recovery

The lock screen's reset action signs out through Clerk. The lock resets only after the same account returns with a different session from Apple/Google sign-in. The reset revokes the stored credential (best effort) and deletes local state. A biometric sign-in proves the lock still works, so it cancels a pending reset.

Recovery relies on Apple/Google's authentication policy. A provider with an existing browser session may allow sign-in without asking for its password again. This tradeoff was explicitly accepted for Amber.

## Local validation

```sh
bun run test
bun run typecheck
bun run lint
```

The iOS Simulator has no Secure Enclave, so `enroll()` cannot run there. The simulator reports the lock as unavailable. Test every biometric path on a physical phone with a dev-client build:

```sh
bunx expo prebuild --platform ios
bunx expo run:ios --device
```

## Physical-device acceptance checklist

1. Turn on the dashboard setting first. Sign in with Apple/Google. In onboarding, cancel the prompt. The setting must stay off and onboarding must stay usable.
2. Turn the lock on. In the Clerk Dashboard, the user must have one biometric credential named "Amber on iPhone".
3. Background the app for more than two minutes and reopen it. Only the splash or lock screen may show until Face ID succeeds. Repeat in airplane mode: Amber must stay locked and ask you to connect.
4. Turn the lock off. Face ID must be asked again, and the credential must show as revoked in the dashboard. Repeat offline: the lock must stay on.
5. Turn it on, sign out, and use "Sign in with Face ID". No second prompt may follow, and saves must load.
6. Revoke the credential in the dashboard while signed out. Biometric sign-in must fail and no session may start. Note whether the button disappears afterwards (it does when Clerk reports the credential as missing).
7. Add or remove a face or fingerprint. Unlock must fail with the "set up again" message. Reset through sign-out, then turn the lock on again.
8. With an older build, turn the lock on, then install this build. The first unlock must ask twice (the old proof, then enrollment). After that, it must ask once.
9. Repeat on Android with a strong (Class 3) biometric.
