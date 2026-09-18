# Item swipe crash and performance review — September 16, 2026

## Result

Removed the morph's per-glyph Worklets callbacks, batched exit cleanup, bounded
animation scenes, fixed delayed route writes, and limited related-item query
lifetimes. The initial performance fix passed 100 alternating page swipes, additional faster
bursts, the third-page boundary, and back navigation during a pending update.
Those endpoint checks missed a subsequent user-reported title-visibility
regression; the follow-up below adds rendered-frame checks.

## Crash evidence

The reported simulator crash (`amberDev-2026-09-16-202515.ips`, now in
`~/Library/Logs/DiagnosticReports/Retired`) is SIGABRT on the React JavaScript
thread. Its native stack reaches `jsi::Value::getObject` at `jsi.h:2014` through
`JSIWorkletsModuleProxy.cpp:455`: the `scheduleOnRN` callback is reconstructed
from the remote-function registry and asserted to be an object.

In installed Worklets 0.10.0, `SerializableRemoteFunction.cpp` retrieves that
callback by registry ID; destruction of its UI proxy schedules registry removal.
The morph reused one RN callback across many short-lived glyph completion
worklets. This is the strongest application-level trigger identified, although
the native stack does not name the original JS callback and the initial control
swipes did not reproduce the abort. Removing that crossing avoids this crash
path in the morph; it does not claim to fix every Worklets callback in the app.

A separate debugger/reload failure was observed during tooling setup. It is not
counted as a reproduction of the swipe SIGABRT. A later optional header `memo`
experiment produced a development render error and was reverted completely.

## Changes

- **Morph lifecycle:** one cancellable RN-side timer prunes completed exits in a
  batch. No per-glyph `scheduleOnRN`, no per-letter React/Skia scene rebuild.
  Returning letters lose stale exit deadlines; cancelled jobs cannot prune a
  newer scene. Subsequent transitions also discard expired exits.
- **Bounded work:** measure only the visible title prefix, append an ellipsis,
  and cap both present and retiring layers at 48 glyphs each. Full text remains
  the accessibility label. Blur, stagger, ease-out and spring choreography remain
  in the existing motion design tokens. Native text fallback respects width.
- **Pager:** debounce route updates through the owning screen's navigation
  object; cancel on blur/unmount and before explicit delete/dismiss navigation.
  Ignore duplicate/offscreen viewability events. Memoize the space sibling list.
- **Subscriptions:** inactive Convex source queries use `skip`; `enabled: false`
  alone does not stop this adapter's `watchQuery`. Related results use 30-second
  GC and are excluded from both persistence and restoration of legacy caches.
  Normal saved-item/feed data retains its offline cache policy.
- **Images/recycling:** request early resizing for bounded detail images, assign
  recycling keys, and reset vertical scroll when a recycled page changes item.
  Image-memory savings were not independently quantified.

## Measurements

Argent React/Hermes profiling plus simultaneous Instruments Time Profiler,
iPhone 17 Pro Max simulator, iOS 27, Expo 57.0.2, RN 0.86.0, React 19.2.3,
Reanimated 4.5.1, Worklets 0.10.0. Development build; React Compiler disabled.

Same 20 alternating swipes between Favorite Person Mug and Amazon order details:
150ms gestures, 600ms pauses, left x=0.8→0.25, right x=0.32→0.88, y=0.45.
Rightward gestures beginning nearer the edge accidentally invoked native Back;
those exploratory runs were discarded. Final endpoint assertions passed.

| Measurement | Before | After |
| --- | ---: | ---: |
| React commits, all captured roots | 398 | 220 |
| Commits at least 16ms | 8 | 3 |
| Maximum captured commit | 24.43ms | 20.95ms |
| Fiber renders | 14,070 | 13,280 |
| Full recording duration | 25.50s | 26.97s |
| Native JS-thread sampled weight | 4,897ms | 3,471ms |
| Native main-thread sampled weight | 2,028ms | 1,842ms |
| Native Hades GC-thread sampled weight | 800ms | 387ms |

Commit count decreased 44.7%. Durations include idle lead-in; native weights are
whole-recording samples, not frame times or normalized utilization. Only the
same gesture segment is compared behaviorally. Slow remaining commits cluster
around native-stack/header updates; these are development measurements, not a
claim of 60/120fps on hardware. No production multiplier is applied.

During the 100-swipe run, registered Worklets callbacks remained **34 → 34** and
query cache count **12 → 12**. The three related-item queries had 30,000ms GC,
`persist: false`, and no invalid empty-space-ID query was present. On leaving
the pager their observer counts became zero; after the expiry interval, all
three query entries were gone. This verifies lifecycle cleanup, not heap/RSS
stability for an arbitrarily large collection.

Native exports contain no recorded potential hangs. The Xcode 27 fallback uses
an all-processes Time Profiler trace: it does **not** include allocation/leak
instrumentation. Its empty leak export is not evidence of no memory leaks.
The second native stop call exceeded the client timeout while packaging; the
exported trace and XML subsequently completed and were analyzed successfully.
The physical iPhone was disconnected, so release/device profiling remains open.

## Regression coverage and artifacts

- `node --experimental-strip-types --test tests/*.test.mjs`: 13 passed, including
  interrupted/returning glyphs, 2,000 text changes, bounded long/zero-width text,
  actual TanStack GC, persistence and legacy-cache filtering.
- `npx tsc --noEmit`, targeted ESLint and `git diff --check`: passed.
- Full `npx expo lint`: two pre-existing effect-state errors in `new-space.tsx`
  and `manage-spaces.tsx`; the pager's previous warnings are removed.
- `.argent/flows/item-swipe-regression.yaml`: recorded and replayed five times
  after a fresh launch (100 swipes), asserting return to the original item.
- `.argent/flows/item-swipe-burst.yaml`: 21 overlapping 120ms/300ms swipes,
  asserts the next item, reverses, then asserts the original. Record and replay
  both passed. Both saved flows also passed after a final cold launch of the
  retained implementation. These are account-specific fragments with explicit prerequisites.
- `.argent/artifacts/item-swiping/before-react.md` and `after-react.md`: generated
  React reports. Their production-speed estimates are tool suggestions, not used
  for conclusions here. Reports show selected hot commits and margin commits,
  not every fiber from every captured commit.

Raw profiler artifacts remain under:
`/var/folders/g2/9g1cnzxn2ll1xfxvbs1z06jc0000gn/T/argent-profiler-cwd/`

- Before: `react-profiler-20260917-003845_{cpu,commits}.json`,
  `native-profiler-20260917-003819.trace` and corresponding raw XML.
- After: `react-profiler-20260917-004646_{cpu,commits}.json`,
  `native-profiler-20260917-004619.trace` and corresponding raw XML.

The failed optional memo experiment's later recording is excluded. Keep the
remaining stack/header render cost and large-feed image/heap profiling as the
next measurements; do not infer those are solved from this bounded test.

## Follow-up: intermittent missing title

The earlier accessibility assertions confirmed the title's label, but could
pass while Skia painted transparent letters. This follow-up addresses title/date
visibility; it does not establish a separate cause for disappearing page images.

- Initialize a complete opaque scene when the font becomes ready. Opening or
  rebuilding a header no longer starts with an empty canvas and delayed letters.
- Explicitly cancel previous progress/fade animations before a reversal.
  Reanimated's `withDelay` otherwise advances the previous fade-out while the
  next entrance waits. Only genuinely new letters get the entrance stagger.
- Remove the persistent phase guard so effect reactivation always restores the
  target after animation cleanup. This prevents a structural cancellation case;
  a specific navigation-triggered occurrence was not independently reproduced.
- Rapid text changes discard outgoing fragments, mount added glyphs opaque,
  and settle retained glyphs over the shared 120ms ease-out. Ordinary changes
  preserve the blur/stagger/glide. Timers use a monotonic clock.

Argent recorded 30 Home-feed swipes on the final implementation: two isolated
changes, then four seven-swipe bursts alternating direction (120ms gestures,
250ms pauses). Inspected title/date contact sheets at 15fps, plus the final
rendered screenshot: all 259 sampled title frames contained visible text and
the endpoint settled fully. Intermediate morph frames intentionally contain
moving/blurred letters; this checks visibility, not continuous legibility.
Also recorded opening Dune Flower, returning Home and opening Coastal dune
flower; both headers appeared complete during the native navigation transition.
Background/foreground preserved the title and date. Runtime inspection after
reopening found no present glyph below full opacity and no pending exits.

Recordings under `.argent/recordings/`:

- `screen-recording-52C2004D-5D57-417F-84D9-BF6F316DD567-1789609243528.mp4`
  (30 swipes, 17.25s).
- `screen-recording-52C2004D-5D57-417F-84D9-BF6F316DD567-1789609321013.mp4`
  (open/back/reopen, 5.14s).

All 15 regression tests, TypeScript and targeted lint pass. The tests now cover
opaque initial glyphs and interrupted scenes returning to a normal morph.
The performance measurements above predate this visibility follow-up; they
were not rerun and must not be attributed to this exact revision.
