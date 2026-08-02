# Plans index

Status tracking for the plans under `plans/`. Each row links to its plan and
records the current execution state.

| Plan | Title | Priority | Status | Notes |
|---|---|---|---|---|
| [001](001-establish-verification-baseline.md) | Establish one reliable verification command | P1 | Not started | Establishes `bun run check` (lint + typecheck + test) and CI. Dependency for all later plans. |
| [002](002-remove-private-ios-api.md) | Remove the private iOS blur API | P1 | Done | Private `CAFilter`/`variableBlur` removed; module uses only public UIKit/Core Animation APIs; `intensity` prop dropped. Source + built-binary scans clean. See "Verification notes" below. |
| [003](003-make-image-imports-retry-safe.md) | Make image imports retry safe | — | Not started | |
| [004](004-make-incoming-share-retry-safe.md) | Make incoming share retry safe | — | Not started | |
| [005](005-make-tidy-save-durable.md) | Make tidy save durable | — | Not started | |
| [006](006-preserve-cancelled-tidy-deletions.md) | Preserve cancelled tidy deletions | — | Not started | |
| [007](007-harden-backend-url-fetching.md) | Harden backend URL fetching | — | Not started | |
| [008](008-isolate-optional-ai-enrichment-failures.md) | Isolate optional AI enrichment failures | — | Not started | |

## Plan 002 verification notes

- **Branch**: `advisor/002-public-progressive-blur`
- **Source scan** (`rg 'CAFilter|variableBlur|NSClassFromString|NSSelectorFromString|filterWithType|inputMaskImage|base64Decode' modules/progressive-blur`): exit 1, no matches.
- **Built-binary scan** (`strings $APP/amber | rg 'CAFilter|variableBlur|filterWithType:|inputMaskImage'`): exit 1, no matches.
- **Release simulator build**: `** BUILD SUCCEEDED **`.
- **TypeScript** (`bunx tsc --noEmit`): exit 0.
- **Lint**: only the pre-existing baseline findings documented in plan 001
  (`manage-spaces.tsx`, `new-space.tsx`); no new findings in
  `modules/progressive-blur`.
- **`bun run check`**: could not be run because the `check` script is created by
  plan 001, which has not been executed yet. The constituent checks that exist
  today (typecheck, lint) pass for this change.
- **Manual visual/touch (plan Step 4)**: partial. The Debug app was built
  (signed) and launched on an iPhone 17 Pro Max simulator; the JS bundle loaded,
  Clerk reached its environment endpoint, and the auth screen rendered without
  crashing — confirming the native module loads and there is no module-
  resolution error. Simulator appearance (light/dark) toggling worked on the
  live app. **The four authenticated header screens (Home/Search/Spaces/Space)
  were not visually verified**, because reaching them requires tapping the
  "Dev login" button and the only UI-automation backend in this environment
  (`idb`) is not installed; `simctl` has no tap/swipe command. This should be
  completed manually before release (the plan's Step 4 also calls for one
  physical iOS device).
- **Android no-op**: confirmed in source (`NativeBlur = ... : null` on non-iOS;
  `if (!NativeBlur) return null`) — no native blur view renders and no module-
  resolution error is thrown.
