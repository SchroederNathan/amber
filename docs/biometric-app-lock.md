# Biometric app lock

Amber keeps Apple/Google sign-in and Clerk's supported token cache. A separate device lock protects an already authenticated session before any private routes or data providers mount. This is a privacy lock, not a new Clerk sign-in factor or server-side MFA requirement.

## Documentation review

Checked against Expo SDK 57 and the installed `@clerk/expo` 3.7.6 on September 22, 2026:

- [Expo local authentication](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/) supplies hardware/enrollment information.
- [Expo SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/) gates a per-account proof with `requireAuthentication`. Its native implementations use `biometryCurrentSet` on iOS and strong biometrics on Android. Enrollment changes invalidate the proof. No device-passcode fallback is configured.
- [Expo screen capture](https://docs.expo.dev/versions/v57.0.0/sdk/screen-capture/) supplies native app-switcher protection. iOS uses the maximum blur; Android uses `FLAG_SECURE`, which also blocks screenshots and recording.
- [Clerk local credentials](https://clerk.com/docs/reference/expo/native-hooks/use-local-credentials) saves and replays a password. Amber's production sign-in is Apple/Google, so this is unsuitable.
- [Clerk biometric credentials](https://clerk.com/docs/expo/guides/development/custom-flows/authentication/biometric-sign-in) documents device-key enrollment and Clerk sign-in. The installed SDK does not export this API. Even after an SDK upgrade, sign-in would still need a local session lock to cover reopening an already signed-in app.

No Clerk dashboard changes, stored account passwords, or Convex schema changes are needed for this implementation. Existing Clerk Native API, Apple/Google providers, and the Convex JWT configuration remain prerequisites.

## Behavior and boundaries

- Onboarding offers an optional biometric lock. Profile settings can enable it later or disable it after another biometric check. Settings are per account and device.
- Enabling creates a separate SecureStore proof and reads it back before saving the opt-in. iOS does not authenticate initial key creation. Android may prompt on both creation and readback.
- Cold starts and new Clerk sessions start locked. Backgrounding and iOS inactive interruptions relock immediately. Native biometric prompts may briefly make iOS inactive; those transitions do not launch another prompt. A background transition invalidates pending verification even if the app returns before it finishes.
- Unlock is user initiated. Cancel, lockout, revoked permissions, missing/invalidated keys, and storage errors do not reveal content. There is no timed grace period.
- The boundary wraps the entire router, including profile sheets, item links, and incoming shares. Private routes unmount while locked; unsaved screen state can be lost when the app is interrupted. This favors privacy over preserving an open editor.
- Clerk verifies account identity and Convex independently verifies the session before private queries mount. Existing item and space queries derive the user ID from `ctx.auth`; item reads/mutations check ownership. The biometric result is never treated as a Convex credential.
- Each unlocked mount owns its Convex client and TanStack cache. Locking, sign-out, and account changes dispose them. The old global unencrypted MMKV query cache is erased instead of hydrated. This intentionally removes offline persisted saves and requires a connection to load content again after unlocking. Image-library/download caches are not an encrypted vault and are outside this visual-lock guarantee.
- With the lock enabled, the Recent Saves widget is emptied, including its generated thumbnails. Pending updates cannot republish old account content. WidgetKit controls when home-screen snapshots refresh, so verify this on a device. Sign-out also clears the widget.
- Native app-switcher protection, once enabled, remains active for the rest of the app process, including after opting out. On Android this means screenshots remain blocked until the app restarts.
- The previous global onboarding flag is not migrated. Each account sees onboarding once again to receive the privacy choice.

Biometrics identify someone enrolled on the device, not a unique Clerk account owner. Someone else's enrolled face/fingerprint also unlocks the app. The lock does not encrypt server records, revoke Clerk tokens, protect a rooted device, or change the access properties of existing media URLs.

## Recovery

The lock screen's explicit reset action signs out through Clerk. The lock is only reset after the same account returns with a different active Clerk session. Cancellation, failed sign-out/sign-in, and another account do not reset the original account's preference. The recovery request is only kept in memory; after a restart, repeat the reset action.

Recovery relies on Apple/Google's authentication policy. A provider with an existing browser session may allow sign-in without asking for its password again. This is not a guarantee of fresh identity verification. This tradeoff was explicitly accepted for Amber. Do not describe it as a guarantee that the provider asks for fresh credentials. The Clerk instance currently has Apple/Google enabled and email-code sign-in disabled.

## Local validation

Automated controller tests cover initial locking, storage/protection failures, cancel/invalidated keys, interruptions, stale background results, duplicate requests, session disposal, enrollment failures, late opt-in writes, and opt-out failures. Recovery tests require an explicit request, the same account, and a different session ID. Run:

```sh
bun run test
bun run typecheck
bun run lint
```

Validation completed on September 22, 2026:

- 28 automated tests passed, including 13 new lock/recovery tests.
- TypeScript and ESLint on all changed source files passed. Full-project ESLint still reports two pre-existing `set-state-in-effect` errors in `manage-spaces.tsx` and `new-space.tsx`.
- iOS native build succeeded. Simulator checks covered the existing development-account sign-in, onboarding with unavailable biometrics, session persistence, a simulated enabled lock with a missing proof, failure to unlock, a profile deep link remaining locked, and explicit sign-out/new-session recovery.
- Interactive Apple/Google provider sign-in, actual biometric prompts, Android execution, and physical widget refresh were not exercised. No simulated check is evidence of real biometric enforcement.

This adds native dependencies and a Face ID usage description. Rebuild the development client, not just Metro or an OTA update:

```sh
bunx expo prebuild --platform ios
bunx expo run:ios --device
```

Use `bunx expo run:android --device` for Android. Face ID is not supported in Expo Go. SecureStore's biometric enforcement must be tested on a physical phone; simulator keychain behavior is not equivalent.

## Physical-device acceptance checklist

1. Sign in with Apple/Google. During onboarding, decline Face ID permission or cancel the prompt. The setting must stay off and onboarding must remain usable.
2. Enable it successfully. Finish onboarding, open a saved item and then profile. Verify that disabling the lock asks for biometrics again. Cancel and confirm it stays enabled.
3. With it enabled, background the app and inspect the app-switcher preview. Reopen it. Only the lock screen should appear until successful authentication. Repeat with a profile sheet open and with Control Center/an incoming interruption.
4. Fail/cancel authentication repeatedly. No saved text, images, navigation controls, or widget content should appear. Retry should still work after cancellation.
5. Start authentication, immediately background the app, then return. A late result must not unlock it. Verify again manually.
6. Kill and relaunch. Also open an `amber:///item/<id>` link and use the share extension while locked. Neither may bypass the lock.
7. Add/remove an enrolled biometric or revoke the Face ID permission in Settings. Existing proof retrieval must fail closed. Exercise explicit recovery, including cancellation and signing in to a different account.
8. Sign out from account A and sign in to B. Check that A's saves, onboarding preference, and widget thumbnails never appear for B. Sign back in to A normally; its lock remains enabled unless explicit recovery completed.
9. Add a Recent Saves widget before enabling the lock. Confirm its content clears on enrollment and stays empty after subsequent background/foreground cycles.
10. Repeat Android checks with strong fingerprint/face enrollment. A weak face-only device must not be offered an unusable enable flow. PIN/password must not substitute for the biometric proof.

Before production release, complete this checklist on both supported platforms.
