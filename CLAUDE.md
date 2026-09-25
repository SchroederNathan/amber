# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> Expo SDK 58 changed a lot. Before writing app code, read the exact versioned docs at
> https://docs.expo.dev/versions/v58.0.0/ (or use the `expo` MCP `read_documentation` /
> `search_documentation` tools). Do not rely on pre-SDK-58 API memory.

## What this is

**Amber** is a "save-it-for-later" hub. Users capture links, images, and notes; a Convex
backend action fetches/extracts content and an LLM classifies each item (title, description,
tags, and which "spaces" it belongs to). The client renders everything as a masonry feed.
Items can be organized into **spaces** (themed collections), and creating a new space
retroactively pulls in matching existing items.

## Toolchain & commands

**Use `bun` — never `npm`/`npx`/`yarn`.** Despite `package.json` declaring `packageManager: yarn`,
the lockfile is `bun.lock` and every command runs through bun. Use `bunx` for one-off tools.

- `bun install` — install deps. (On macOS, if you hit `esbuild` exit 137 / SIGKILL after install,
  it's the hardlinked-binary code-signing issue — see auto-memory `macos-bun-esbuild-sigkill-fix`.)
- `bun start` / `bunx expo start` — Metro dev server (dev client, not Expo Go — this app has
  custom native modules).
- `bunx expo run:ios` / `bunx expo run:android` — build & run the native dev client.
- `bun run lint` (`expo lint`) — ESLint (flat config, `eslint-config-expo`).
- `bunx tsc --noEmit` — typecheck (strict mode; TS ~6.0).
- `bunx convex dev` — run/deploy the Convex backend locally against the dev deployment and
  keep `convex/_generated/*` in sync. Required whenever backend functions or schema change.

There is no test suite.

### Native builds

Custom native modules (`modules/subject-lift`, `modules/progressive-blur`) and a share extension
(`expo-sharing`) mean **Expo Go will not work** — you need a dev-client build. EAS build images are
pinned to Xcode 26.6 in `eas.json`; note (from auto-memory) EAS *cloud* iOS builds have failed on
Xcode 26.4 while local Xcode 26.6 works.

### Version pins that must not drift (from hard-won auto-memory)

- `react-native-worklets` must match the version the dev client was built with — a stale
  binary against newer worklets JS SIGABRTs at launch (`getNumber`). Rebuild after bumping it.
- `react-native-reanimated` **>= 4.5.1** — 4.5.0 crashes on empty Unistyles style objects.

## Architecture

### Backend (`convex/`) — the source of truth

Convex is the reactive backend + database + file storage + AI orchestration. Auth is Clerk,
wired via `convex/auth.config.ts` (Clerk JWT template `applicationID: "convex"`).

- **`schema.ts`** — three tables: `items`, `spaces`, and the `spaceItems` join table. `items`
  has a `by_user` index and a `search_text` full-text search index (filtered by `userId`).
- **`items.ts`** — public queries/mutations (`listItems`, `getItem`, `searchItems`, create/delete)
  plus internal functions the AI action calls. Image URLs are resolved from `storageId` at read
  time via `enrichItem`.
- **`spaces.ts`** — space CRUD + the space/item join management.
- **`ai.ts`** (`"use node"` action) — the processing pipeline. On create, a mutation inserts the
  item as `status: "processing"` and schedules `internal.ai.processItem`. That action: for links,
  fetches the page and extracts the article body (Mozilla **Readability** via `linkedom`, with a
  regex fallback) + OpenGraph metadata + hero image aspect ratio (read from raw header bytes, no
  deps); for images/notes it feeds the content to the model. It calls `generateObject` (Vercel AI
  SDK, Zod schema) to produce title/description/tags/spaceNames, maps space names back to ids,
  then `finalizeItem` flips status to `ready`. `reclassifyForNewSpace` runs when a space is created.
- **`model/auth.ts`** — `requireUserId(ctx)` returns the Clerk `sub`. **Every public function
  derives `userId` from this, never from a client argument.** Follow this when adding functions.

**The AI model** is `google/gemini-3.1-flash-lite`, a bare model-id string that routes through the
**Vercel AI Gateway** automatically (auth via the `AI_GATEWAY_API_KEY` Convex deployment env var).

When editing anything in `convex/`, prefer the `convex:convex-expert` agent — it knows the
object-form syntax, validator rules, and resource limits. Return validators (`returns:`) are used
throughout; keep them accurate or functions fail at runtime.

### Client (`src/`) — Expo Router app

- **`index.ts`** imports `./src/unistyles` **before** `expo-router/entry`. This ordering is
  load-bearing: Unistyles must be configured before any `StyleSheet.create` runs, or adaptive
  theming never arms and screens flash the wrong theme. Don't reorder.
- **`src/app/_layout.tsx`** — provider stack: `GestureHandlerRootView` → `ClerkProvider` →
  `ConvexProviderWithClerk` → `PersistQueryClientProvider` → `OnboardingProvider` →
  `NavThemeProvider` (bridges the Unistyles palette into React Navigation's theme + native root
  background to kill white flashes) → `Slot`.
- **Routing** (`expo-router`, typed routes on): `(auth)` for sign-in, `(app)` gated by Clerk auth
  and an onboarding guard (`Stack.Protected`). Inside `(app)`: `(tabs)` uses **native tabs**
  (`expo-router/native-tabs`) — Home (masonry feed), Spaces, Search. `add`, `new-space`,
  `profile` are form-sheet modals; `camera` is a full-screen modal; `item/[id]` and `space/[id]`
  are detail screens.
- **Data layer** (`src/lib/query-client.ts`) — one `ConvexReactClient` shared by both Convex's
  Clerk provider and the **TanStack Query** adapter (`@convex-dev/react-query`), persisted to
  **MMKV** via `createSyncStoragePersister` so the feed shows instantly on cold launch. The
  Convex `queryKeyHashFn`/`queryFn` are set as *global* query defaults — required so restored
  persisted hashes match. `staleTime: Infinity` (Convex pushes updates). Don't move these to
  per-call options.
- **Styling** — `react-native-unistyles` with `adaptiveThemes: true`. All tokens live in
  `src/theme/` (`palette`, `schemes`, `colors`, `typography`, `spacing`, `radius`, `shadows`,
  `controls`, `motion`); `src/unistyles.ts` only registers them. The default scheme is
  **Neutral** (Tailwind `neutral`).
  - `palette.ts` is the full Tailwind palette. Screens never read it.
  - A **color scheme** (`schemes.ts`) is a `gray` scale plus an `accent` scale. `colors.ts`
    derives every semantic role (`background`, `foreground`, `primary`, `onPrimary`, `tint`,
    `toggle`, `primarySoft`, …) from those two scales, per mode. Use `tint` for accent text and
    icons on the canvas, `primary` only for fills, and `toggle` for switch tracks.
    `theme.media.*` is mode-independent camera/photo chrome.
  - To add a scheme, add one entry to `colorSchemes`. To switch at runtime, call
    `setColorScheme(name)` from `src/lib/color-scheme.ts` (persisted in MMKV, read before
    `StyleSheet.configure`). The home-screen widget gets the active palette with each snapshot.
  - Never hardcode hex colors outside `src/theme/`. Skia and other JS-read colors
    (e.g. `AnimatedText`'s `color` prop) must come from `useUnistyles()`, not from a
    `StyleSheet.create` style: those don't update on a live theme change.
  The babel plugin (`react-native-unistyles/plugin`, `root: 'src'`) auto-processes styles.

### Native modules (`modules/`) — local Expo modules

- **`subject-lift`** (iOS 17+) — lifts a foreground subject from a photo into a transparent
  die-cut "sticker" PNG using Vision (`VNGenerateForegroundInstanceMaskRequest`). Guard usage
  with `isAvailable`; it's null unless linked into the dev client build. (See auto-memory
  `subject-lift-cutout-notes` for the CoreImage matte gotchas — Vision can't run on the simulator.)
- **`progressive-blur`** — a native SwiftUI progressive/gradient blur view used on the ID screens.

Both are wired into TypeScript via `tsconfig.json` `paths` entries (there's no metro symlink) —
**add a `paths` entry per new local module** (see auto-memory `amber-local-module-tsconfig-paths`).

### Siri, Spotlight & App Intents (`app-intents/`, `src/lib/app-intents.tsx`)

`expo-app-intents` (alpha; pinned to `0.4.4` because npm `latest` is a `0.0.1` placeholder). The
Swift intents live in the root `app-intents/` folder and are compiled into the app target as inline
modules (`experiments.inlineModules.watchedDirectories` in `app.json`); Apple extracts their
metadata at build time. iOS 27 schema intents sit behind `#if compiler(>=6.4)` so older Xcode still
builds.

- **Capture:** `SaveNoteIntent` (`.notes.createNote`; spaces are exposed as `.notes.folder`) and
  `SaveLinkIntent` (plain intent) POST straight to the Convex HTTP action `/app-intents/capture`
  (`convex/http.ts`) with a per-device capture token, so Siri saves without launching JS. The token
  is minted by the `appIntents.issueCaptureToken` action and stored in the keychain through the
  `AppIntentsSetup` inline module. If that fails, the intent queues an invocation for JS instead.
- **"Save this" routing:** Siri sends "save this to Amber" to `SaveNoteIntent` whatever is on
  screen, so `CaptureRouter` picks one item: a page URL Siri passed (link attribute, URL / web
  archive / webloc / HTML attachment) saves a link; else photos and screenshots upload through
  `/app-intents/upload-url` and save as image items with `captureContext` (Siri's words plus
  on-device OCR); else a text that is just a URL saves a link; else a note. For image items with
  `captureContext`, `ai.processItem` also looks for the page the screenshot shows (a full URL read
  from the image, else a SerpAPI search that must match the domain and the headline) and puts an
  "Open page" intent first. Each capture logs `app-intents capture trace:` (types and sizes only)
  in the Convex logs.
- **Navigation:** `SearchAmberIntent` (`.system.searchInApp`), `OpenItemIntent` / `OpenSpaceIntent`
  (`.system.open`) and `VisualSearchIntent` dispatch invocations. `AppIntentsBridge` (mounted in
  `(app)/_layout.tsx`) routes them, publishes the `item` / `space` entity catalogs (never while the
  app lock is on), and mirrors items into Spotlight via `AmberSpotlight`. Sign-out clears all of it
  (`resetAppIntents`).
- Gotchas: do not return `browser.*` schema entities (authentication policy 2); iOS 27 stalls the
  action before `perform()`. Don't use the package's `registerIndexed`: its
  `deleteAppEntities(ofType:)` hangs on the iOS 27 simulator and blocks catalog writes.
  `AppIntentsSetup.getIntentLog()` returns the last intent runs for debugging. Exact schema
  parameter shapes are in Xcode's `AppIntentSchemas.framework/.../AppIntentSchemas.sqlite`.
- A dev-client build opened cold by Siri stops at the dev launcher; demo Siri with a Release build.
- EAS iOS images top out at Xcode 26.6, so EAS builds compile out everything behind
  `#if compiler(>=6.4)` (all iOS 27 schema intents). Code outside those guards must still pass the
  metadata export alone: e.g. `ItemVisualQuery` needs the plain `OpenItemIntent` in the `#else`.

### Share-in flow

`expo-sharing` registers a share extension. When content is shared into Amber, the OS launches it
with an `amber://expo-sharing` deep link; `src/app/+native-intent.ts` rewrites that to `/share`,
and `src/app/(app)/share.tsx` ingests the payload.

## Path aliases

`@/*` → `src/*`, `@convex/*` → `convex/*`, plus the per-module aliases above. Import from these,
not deep relative paths.

## Environment variables

Client (`.env`, `EXPO_PUBLIC_*`): `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CONVEX_URL`.
Convex deployment env (set via `bunx convex env set` or dashboard): `AI_GATEWAY_API_KEY` and
`CLERK_JWT_ISSUER_DOMAIN` (the Clerk JWT issuer that `auth.config.ts` reads; set per deployment so
dev and prod each trust their own Clerk instance).

## Working on the running app

Argent MCP tools are configured for this repo — use them (not `xcrun simctl`) to boot simulators,
tap, screenshot, and verify UI changes. Always call a discovery tool (`describe` /
`debugger-component-tree`) before tapping; never guess coordinates.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
