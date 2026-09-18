# Profiling Analysis — 27.0s session
**React Compiler:** ✗  **Hot commits:** 3 of 220 total

> **Duration columns:** `self` = this component's own render work only (exclusive).
> `w/children` = self + the entire subtree it owns (inclusive).
> Do not sum the `w/children` column — a parent's inclusive time already contains its
> children's time. Use `self` for summing; use `w/children` to understand container cost.

---
## Slow React Batches

### Commit #18 — 0.91ms 🔵 (t=14.3s, margin)
> After: "Same 20 alternating page swipes after fixes" (2.8s prior)

- `ItemScreen(./(app)/item/[id].tsx)` — 0.64ms self, 0.91ms w/children — hooks: useContext
- `View` ×2 — 0.08ms self, 0.51ms w/children — props: children, ref
- `StackScreen` — 0.06ms self, 0.08ms w/children — props: options
- `StackToolbar` — 0.04ms self, 0.06ms w/children — props: children
- `StackTitle` — 0.02ms self, 0.02ms w/children — props: children
- `Screen` — 0.02ms self, 0.02ms w/children — props: options
- `StackToolbarHeader` — 0.02ms self, 0.02ms w/children — props: children

### Commit #19 — 20.95ms 🟡 (t=14.3s)
> After: "Same 20 alternating page swipes after fixes" (2.8s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `SceneView` re-rendered — props: options, clearOptions

Render cascade:
- `SceneView` ×6 — 12.39ms self, 20.34ms w/children — props: options, clearOptions
- `AnimatedText` ×2 — 1.49ms self, 1.9ms w/children — props: text
- `NativeStackNavigator` — 0.78ms self, 20.95ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.71ms self, 7.11ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.62ms self, 8.87ms w/children — props: children
- `InnerScreen` [forwardRef] ×3 — 0.45ms self, 6.24ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `Animated(Anonymous)` ×3 — 0.43ms self, 5.32ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `ItemHeader` — 0.4ms self, 2.42ms w/children — props: item
- `View` ×7 — 0.29ms self, 24.27ms w/children — props: style, accessibilityLabel, children
- `Context.Provider` ×48 — 0.22ms self, 214.16ms w/children — (mount)
- `ScreenStackHeaderConfig` ×3 — 0.21ms self, 2.81ms w/children — props: children
- `Freeze` ×3 — 0.2ms self, 5.67ms w/children — props: children
- `NativeStackView` — 0.19ms self, 19.84ms w/children — props: descriptors, describe
- `LinkZoomTransitionEnabler` ×4 — 0.19ms self, 0.35ms w/children — props: style
- `NavigationContent` — 0.16ms self, 20.12ms w/children — props: render, children
- _... and 20 more_
- _Shown: 18.7ms self / 20.95ms commit (89%) — 20 more components not shown. Use `profiler-commit-query mode=by_index commit_index=19` to see all._

**CPU during this commit:**
- `completeUnitOfWork` self=1.94ms total=1.94ms (&platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src/app&unstable_transformProfile=hermes-stable:26649)
- `shopify_utilsTs1` self=1.43ms total=1.43ms (&platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src/app&unstable_transformProfile=hermes-stable:239398)
- `[Host Function] createTask` self=0.68ms total=0.68ms ([host]:0)

### Commit #20 — 0.99ms 🔵 (t=14.3s, margin)
> After: "Same 20 alternating page swipes after fixes" (2.8s prior)

- `AnimatedText` ×2 — 1.22ms self, 1.49ms w/children — state: useState
- `View` ×4 — 0.14ms self, 0.49ms w/children — props: style, children, ref
- `Canvas` ×2 — 0.1ms self, 0.12ms w/children — props: style, children

### Commit #111 — 11.57ms 🔵 (t=26.0s, margin)
> After: "Same 20 alternating page swipes after fixes" (14.5s prior)

- `SceneView` ×8 — 2.01ms self, 31.68ms w/children — props: options, clearOptions
- `NavigationProvider` ×8 — 0.63ms self, 30.87ms w/children — props: children
- `NativeStackNavigator` — 0.57ms self, 9.36ms w/children — context changed
- `ScreenStackItem` [forwardRef] ×3 — 0.55ms self, 6.53ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `ItemScreen(./(app)/item/[id].tsx)` — 0.54ms self, 1.74ms w/children — hooks: useContext
- `Animated(Anonymous)` ×4 — 0.46ms self, 5.76ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `InnerScreen` [forwardRef] ×3 — 0.39ms self, 5.86ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `NavigationContent` ×3 — 0.37ms self, 29.41ms w/children — props: render, children
- `SlotNavigator` — 0.35ms self, 10.26ms w/children — context changed
- `Route(item/[id])` — 0.35ms self, 2.35ms w/children — props: route
- `Content` — 0.35ms self, 11.16ms w/children — context changed
- `BaseNavigationContainer` — 0.32ms self, 11.57ms w/children — hooks: useSyncExternalStore
- `Context.Provider` ×83 — 0.32ms self, 459.41ms w/children — (mount)
- `FlashList` [forwardRef] — 0.23ms self, 0.97ms w/children — props: initialScrollIndex
- `EnsureSingleNavigator` ×6 — 0.18ms self, 34.07ms w/children — props: children
- _... and 43 more_
- _Shown: 7.6ms self / 11.57ms commit (66%) — 43 more components not shown. Use `profiler-commit-query mode=by_index commit_index=111` to see all._

### Commit #112 — 19.2ms 🟡 (t=26.1s)
> After: "Same 20 alternating page swipes after fixes" (14.5s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `SceneView` re-rendered — props: options, clearOptions

Render cascade:
- `AnimatedText` ×2 — 11.12ms self, 11.5ms w/children — parent re-render
- `SceneView` ×6 — 1.75ms self, 18.95ms w/children — props: options, clearOptions
- `NativeStackNavigator` — 0.65ms self, 19.2ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.58ms self, 16.2ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.47ms self, 17.92ms w/children — props: children
- `ItemHeader` — 0.41ms self, 11.99ms w/children — parent re-render
- `Animated(Anonymous)` ×3 — 0.4ms self, 14.72ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `InnerScreen` [forwardRef] ×3 — 0.38ms self, 15.49ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `View` ×8 — 0.31ms self, 41.86ms w/children — props: style, children
- `ViewHolderCollection` — 0.22ms self, 0.29ms w/children — state: useState
- `Context.Provider` ×48 — 0.22ms self, 237.74ms w/children — (mount)
- `NativeStackView` — 0.18ms self, 18.27ms w/children — props: descriptors, describe
- `ScreenStackHeaderConfig` ×3 — 0.18ms self, 12.36ms w/children — props: children
- `Canvas` ×2 — 0.17ms self, 0.2ms w/children — props: style, children
- `Freeze` ×3 — 0.16ms self, 15.01ms w/children — props: children
- _... and 21 more_
- _Shown: 17.2ms self / 19.2ms commit (90%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=112` to see all._

**CPU during this commit:**
- `[Native] errorStackGetter` self=19.2ms total=19.2ms ([native]:0)

### Commit #113 — 0.64ms 🔵 (t=26.1s, margin)
> After: "Same 20 alternating page swipes after fixes" (14.6s prior)

- `AnimatedText` — 0.48ms self, 0.64ms w/children — state: useState
- `View` ×2 — 0.08ms self, 0.3ms w/children — props: style, children, ref
- `Canvas` — 0.06ms self, 0.08ms w/children — props: style, children

### Commit #117 — 12.24ms 🔵 (t=26.8s, margin)
> After: "Same 20 alternating page swipes after fixes" (15.3s prior)

- `SceneView` ×8 — 1.9ms self, 34.63ms w/children — props: options, clearOptions
- `NavigationProvider` ×8 — 0.61ms self, 33.89ms w/children — props: children
- `NativeStackNavigator` — 0.56ms self, 10.02ms w/children — context changed
- `ScreenStackItem` [forwardRef] ×3 — 0.55ms self, 7.33ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `ItemScreen(./(app)/item/[id].tsx)` — 0.53ms self, 1.69ms w/children — hooks: useContext
- `Animated(Anonymous)` ×4 — 0.45ms self, 6.62ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `NavigationContent` ×3 — 0.37ms self, 31.41ms w/children — props: render, children
- `Content` — 0.36ms self, 11.83ms w/children — context changed
- `InnerScreen` [forwardRef] ×3 — 0.35ms self, 6.66ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `Route(item/[id])` — 0.35ms self, 2.33ms w/children — props: route
- `SlotNavigator` — 0.34ms self, 10.91ms w/children — context changed
- `BaseNavigationContainer` — 0.32ms self, 12.24ms w/children — hooks: useSyncExternalStore
- `Context.Provider` ×83 — 0.32ms self, 497.63ms w/children — (mount)
- `FlashList` [forwardRef] — 0.21ms self, 0.93ms w/children — props: initialScrollIndex
- `EnsureSingleNavigator` ×6 — 0.18ms self, 37ms w/children — props: children
- _... and 43 more_
- _Shown: 7.4ms self / 12.24ms commit (60%) — 43 more components not shown. Use `profiler-commit-query mode=by_index commit_index=117` to see all._

### Commit #118 — 19.13ms 🟡 (t=26.8s)
> After: "Same 20 alternating page swipes after fixes" (15.3s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `SceneView` re-rendered — props: options, clearOptions

Render cascade:
- `AnimatedText` ×2 — 10.73ms self, 11.48ms w/children — parent re-render
- `SceneView` ×6 — 1.83ms self, 18.9ms w/children — props: options, clearOptions
- `NativeStackNavigator` — 0.68ms self, 19.13ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.57ms self, 16.11ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `Canvas` ×2 — 0.5ms self, 0.54ms w/children — props: style, children
- `NavigationProvider` ×6 — 0.47ms self, 17.87ms w/children — props: children
- `Animated(Anonymous)` ×3 — 0.39ms self, 14.66ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `InnerScreen` [forwardRef] ×3 — 0.38ms self, 15.42ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `View` ×8 — 0.35ms self, 42.45ms w/children — props: style, children
- `ItemHeader` — 0.33ms self, 11.9ms w/children — parent re-render
- `Context.Provider` ×48 — 0.25ms self, 236.55ms w/children — (mount)
- `ScreenStackHeaderConfig` ×3 — 0.19ms self, 12.26ms w/children — props: children
- `ViewHolderCollection` — 0.16ms self, 0.22ms w/children — state: useState
- `NativeStackView` — 0.16ms self, 18.18ms w/children — props: descriptors, describe
- `Freeze` ×3 — 0.16ms self, 14.94ms w/children — props: children
- _... and 21 more_
- _Shown: 17.2ms self / 19.13ms commit (90%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=118` to see all._

**CPU during this commit:**
- `structuredCloneInternal` self=11.36ms total=11.36ms (&platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src/app&unstable_transformProfile=hermes-stable:30528)
- `[GC Young Gen]` self=5.73ms total=5.73ms ([suspended]:0)
- `cloneObjectProperties` self=2.04ms total=2.04ms (&platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src/app&unstable_transformProfile=hermes-stable:88211)

### Commit #119 — 0.81ms 🔵 (t=27.0s, margin)
> After: "Same 20 alternating page swipes after fixes" (15.5s prior)

- `AnimatedText` — 0.48ms self, 0.81ms w/children — state: useState
- `View` ×2 — 0.15ms self, 0.6ms w/children — props: style, children, ref
- `Canvas` — 0.13ms self, 0.15ms w/children — props: style, children

---
## Top Components by Total Render Cost

| Component | Renders | Total | Avg | Max | Reason | File |
|---|---|---|---|---|---|---|
| `SceneView` | 34 | 19.9ms | 0.58ms | 10.96ms | props: options, clearOptions, descriptor | — |
| `NativeStackNavigator` | 5 | 3.2ms | 0.65ms | 0.78ms | state: useState, useReducer | — |
| `ScreenStackItem` [forwardRef] | 15 | 3ms | 0.2ms | 0.25ms | props: sheetAllowedDetents, onWillAppear, onWillDisappear | — |
| `NavigationProvider` | 34 | 2.8ms | 0.08ms | 0.11ms | props: children, route | — |
| `InnerScreen` [forwardRef] | 15 | 1.9ms | 0.13ms | 0.16ms | props: sheetAllowedDetents, style, scrollEdgeEffects | — |
| `View` | 43 | 1.8ms | 0.04ms | 0.1ms | props: children, style, ref | — |
| `ItemScreen(./(app)/item/[id].tsx)` | 3 | 1.7ms | 0.57ms | 0.64ms | hooks: useContext, useContext | `item/[id].tsx:42` |
| `NavigationContent` | 9 | 1.2ms | 0.13ms | 0.16ms | props: render, children | — |
| `ItemHeader` | 3 | 1.1ms | 0.38ms | 0.41ms | parent re-render | `components/item-header.tsx:11` |
| `Canvas` | 10 | 1.1ms | 0.11ms | 0.44ms | props: style, children | — |
| `ScreenStackHeaderConfig` | 15 | 0.9ms | 0.06ms | 0.08ms | props: children, headerRightBarButtonItems | — |
| `NativeStackView` | 5 | 0.9ms | 0.17ms | 0.19ms | props: descriptors, describe, state | — |
| `Freeze` | 15 | 0.8ms | 0.06ms | 0.07ms | props: children | — |
| `Screen` | 18 | 0.7ms | 0.04ms | 0.06ms | props: ref, sheetAllowedDetents, style | — |
| `ViewHolderCollection` | 4 | 0.7ms | 0.17ms | 0.22ms | props: getLayout, getAdjustmentMargin, onCommitLayoutEffect | — |
| `EnsureSingleNavigator` | 21 | 0.7ms | 0.03ms | 0.04ms | props: children | — |
| `DebugContainer` | 15 | 0.5ms | 0.04ms | 0.06ms | props: contentStyle, children | — |
| `DelayedFreeze` | 15 | 0.5ms | 0.04ms | 0.05ms | props: children | — |
| `SafeAreaView` | 15 | 0.5ms | 0.03ms | 0.07ms | props: edges, children | — |
| `ScreenStack` | 5 | 0.5ms | 0.09ms | 0.11ms | props: nativeContainerStyle, children | — |

---
## Suggested Improvements

### `SceneView`

**Stabilize props:** `options`, `clearOptions`, `descriptor`. Likely inline objects/functions at the callsite — extract to constants or wrap with `useMemo`/`useCallback`.

### `NativeStackNavigator`

**Unstable hook deps:** `useState`, `useReducer`. Check dependency arrays in `useEffect`/`useMemo` — a dependency may be recreated on every render.

### `ScreenStackItem` [forwardRef]

**Stabilize props:** `sheetAllowedDetents`, `onWillAppear`, `onWillDisappear`. Likely inline objects/functions at the callsite — extract to constants or wrap with `useMemo`/`useCallback`.

### `NavigationProvider`

**Stabilize props:** `children`, `route`. Likely inline objects/functions at the callsite — extract to constants or wrap with `useMemo`/`useCallback`.

### `InnerScreen` [forwardRef]

**Stabilize props:** `sheetAllowedDetents`, `style`, `scrollEdgeEffects`. Likely inline objects/functions at the callsite — extract to constants or wrap with `useMemo`/`useCallback`.


> 📝 Dev mode renders are ~3× slower than production. Divide ms values by ~3 for a rough production estimate.

---
## Next Steps

Ask the user which path to take:

1. **Investigate further** — use query tools to drill into specific findings before making changes:
   - `profiler-commit-query` mode=`by_index` commit_index=19 — full breakdown of the slowest commit
   - `profiler-cpu-query` mode=`component_cpu` component_name=`SceneView` — CPU activity during this component's renders
   - `profiler-cpu-query` mode=`call_tree` — trace callers/callees of hot functions
2. **Implement fixes** — apply changes to the top offenders identified above, then re-profile the same scenario to measure improvement.
3. **Done for now** — save the report for reference.