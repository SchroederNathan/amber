# Amber iOS delivery: TestFlight or OTA

`deploy-to-testflight.yml` runs on pushes to `main` and manual dispatches.
It first runs type checks and the `tests/` regression suite. It then
fingerprints the production native configuration and looks for a completed
iOS store build with the same fingerprint, runtime, profile, and `production`
channel. A match publishes an iOS OTA update. No match creates a full
production build and uploads it to TestFlight. Upload only runs after a
successful build; the workflow never repacks an IPA.

Production uses fingerprint runtime versions so native changes cannot send
incompatible JavaScript to older builds. Preview and development keep their
app-version runtime policy. The first run after this configuration change
needs a new native build. Testers must install it from TestFlight before
they can receive OTA updates. OTA updates do not create new TestFlight build
numbers and normally apply after the app downloads them and restarts.

The `production` channel is embedded in production binaries. A TestFlight
binary promoted to the App Store also receives compatible updates from this
channel. This workflow only publishes iOS updates; it does not deploy Convex
functions.

To force a new TestFlight binary, run:

```sh
bunx eas-cli workflow:run .eas/workflows/deploy-to-testflight.yml -F force_native=true
```

Use this for a release that needs a new binary or after a failed/canceled
upload. `get-build` proves that a build completed, not that Apple accepted it
or that testers installed it. A failed upload must be recovered before
relying on OTA delivery for that runtime. The forced run builds and uploads,
and skips OTA.

## One-time setup

1. Connect the GitHub repository (`SchroederNathan/amber`) to the EAS
   project in the EAS dashboard, or the `push` trigger never fires. Manual
   runs via `eas workflow:run` work without it.
2. EAS `production` environment variables must include
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_CONVEX_URL` (already
   set). The `update` and `fingerprint` jobs read them through
   `environment: production`.
3. The first native build after adding `expo-updates` must reach TestFlight
   before any OTA update can be delivered.
