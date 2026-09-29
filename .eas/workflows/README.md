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

# PR E2E: TesterArmy `e2e` on EAS Simulator

`pr-e2e.yml` runs on pull requests to `main` that touch app code, and on
manual dispatches. It has five jobs:

1. `fingerprint` and `get_build` look for an `e2e` simulator build with the
   same native fingerprint.
2. `repack` puts the PR's JavaScript into that build. If no build matches,
   `build` makes a new one. The `e2e` profile is a Release simulator build
   (`APP_VARIANT=preview`, `EXPO_PUBLIC_E2E=1`), so it shows the Dev login
   button.
3. `e2e` starts an EAS Simulator session with the build installed. It runs
   `bun run e2e` (the scripted suite in `e2e/`) through `simulator:exec`.
   Then it runs `bun run e2e:explore` with a goal made from the PR title,
   description, and changed screens. The suite blocks the PR. Explore only
   reports.
4. `comment` posts a summary on the PR. Screenshots, videos, `report.json`,
   and `junit.xml` are in the `e2e-results` artifact.

Run it by hand, with an optional explore goal:

```sh
bunx eas-cli@latest workflow:run .eas/workflows/pr-e2e.yml -F goal="Save a link and check its detail screen"
```

Run the suite locally against a booted simulator. The runner does not read
`.env.local`, so load it for `AI_GATEWAY_API_KEY`. Set `E2E_DEVICE` (name or
UDID) when several simulators are booted, and `E2E_APP_ID` to test a dev
client (`com.schroedernathan.dev`) instead of an `e2e` build:

```sh
(set -a; . ./.env.local; set +a; E2E_DEVICE=<udid> bun run e2e)
```

Quirks the suite works around (see comments in `e2e/amber.e2e.ts`):

- Home feed cards are missing from agent-device's accessibility snapshot
  (expo-router's `Link.Preview` wrapper hides them), so feed checks use
  `vision: 'only'` and the delete step taps from a screenshot.
- agent-device calls every control in a form sheet "covered", so the Add
  sheet taps by position and the agent types into the focused field.
- A gesture handler `Pressable` shows as two nested buttons with one name;
  select them by `testID`, which only the inner node has.

## One-time setup

1. EAS `development` environment: add `EXPO_PUBLIC_DEV_PASSWORD` (the
   password of `dev+clerk_test@example.com`, sensitive). The `e2e` build
   embeds it, as dev builds do. `AI_GATEWAY_API_KEY` is already there; the
   test agents call Claude through the AI Gateway.
2. If the "Check EAS credentials" step fails, add an `EXPO_TOKEN` secret
   (a robot token with access to this project) to the `development`
   environment. `simulator:start` needs it.
3. `e2e` and `@e2e-dev/mobile` are canary releases. Keep them pinned to
   exact versions and bump both together.
