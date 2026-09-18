# Profiling Analysis — 25.5s session
**React Compiler:** ✗  **Hot commits:** 8 of 398 total

> **Duration columns:** `self` = this component's own render work only (exclusive).
> `w/children` = self + the entire subtree it owns (inclusive).
> Do not sum the `w/children` column — a parent's inclusive time already contains its
> children's time. Use `self` for summing; use `w/children` to understand container cost.

---
## Slow React Batches

### Commit #13 — 0.99ms 🔵 (t=11.3s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (1.6s prior)

- `AnimatedText` — 0.81ms self, 0.99ms w/children — state: useState
- `View` ×2 — 0.08ms self, 0.32ms w/children — props: style, children, ref
- `Canvas` — 0.07ms self, 0.09ms w/children — props: style, children

### Commit #14 — 23.83ms 🟡 (t=11.3s)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (1.6s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `ItemScreen(./(app)/item/[id].tsx)` re-rendered — hooks: useContext

Render cascade:
- `ItemScreen(./(app)/item/[id].tsx)` — 10.62ms self, 13.79ms w/children — hooks: useContext
- `SceneView` ×8 — 2.04ms self, 80.61ms w/children — props: options, clearOptions
- `FlashList` [forwardRef] — 0.97ms self, 1.78ms w/children — props: data, initialScrollIndex
- `StackToolbar` — 0.81ms self, 1.13ms w/children — props: children
- `NavigationProvider` ×8 — 0.62ms self, 79.79ms w/children — props: children
- `NativeStackNavigator` — 0.57ms self, 21.62ms w/children — context changed
- `ScreenStackItem` [forwardRef] ×3 — 0.57ms self, 18.8ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `Animated(Anonymous)` ×4 — 0.5ms self, 18.07ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `Route(item/[id])` — 0.4ms self, 14.5ms w/children — props: route
- `InnerScreen` [forwardRef] ×3 — 0.38ms self, 18.1ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `NavigationContent` ×3 — 0.36ms self, 66.16ms w/children — props: render, children
- `Content` — 0.36ms self, 23.4ms w/children — context changed
- `Context.Provider` ×83 — 0.34ms self, 1144.21ms w/children — (mount)
- `BaseNavigationContainer` — 0.33ms self, 23.83ms w/children — hooks: useSyncExternalStore
- `StackToolbarHeader` — 0.33ms self, 0.33ms w/children — props: children
- _... and 43 more_
- _Shown: 19.2ms self / 23.83ms commit (81%) — 43 more components not shown. Use `profiler-commit-query mode=by_index commit_index=14` to see all._

**CPU during this commit:**
- `[GC Young Gen]` self=19.69ms total=19.69ms ([suspended]:0)
- `propagateContextChanges` self=2.75ms total=2.75ms (&platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src/app&unstable_transformProfile=hermes-stable:21518)
- `[GC Young Gen]` self=1.39ms total=1.39ms ([suspended]:0)

### Commit #15 — 8.74ms 🔵 (t=11.3s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (1.6s prior)

- `SceneView` ×6 — 1.71ms self, 8.49ms w/children — props: options, clearOptions
- `AnimatedText` ×2 — 1.19ms self, 1.46ms w/children — parent re-render
- `NativeStackNavigator` — 0.61ms self, 8.74ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.54ms self, 5.87ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.47ms self, 7.53ms w/children — props: children
- `Animated(Anonymous)` ×3 — 0.38ms self, 4.47ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `ItemHeader` — 0.36ms self, 1.89ms w/children — parent re-render
- `InnerScreen` [forwardRef] ×3 — 0.35ms self, 5.21ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `View` ×8 — 0.27ms self, 11.12ms w/children — props: style, children
- `Context.Provider` ×48 — 0.2ms self, 102.1ms w/children — (mount)
- `ViewHolderCollection` — 0.17ms self, 0.23ms w/children — state: useState
- `ScreenStackHeaderConfig` ×3 — 0.17ms self, 2.21ms w/children — props: children
- `NativeStackView` — 0.16ms self, 7.84ms w/children — props: descriptors, describe
- `Freeze` ×3 — 0.16ms self, 4.76ms w/children — props: children
- `LinkZoomTransitionEnabler` ×4 — 0.14ms self, 0.26ms w/children — props: style
- _... and 21 more_
- _Shown: 6.9ms self / 8.74ms commit (79%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=15` to see all._

### Commit #31 — 2.18ms 🔵 (t=12.4s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (2.7s prior)

- `ItemScreen(./(app)/item/[id].tsx)` — 0.66ms self, 2.18ms w/children — hooks: useEffect
- `AnimatedText` — 0.65ms self, 0.8ms w/children — state: useState
- `FlashList` [forwardRef] — 0.43ms self, 1.14ms w/children — props: data
- `View` ×6 — 0.21ms self, 4.04ms w/children — props: style, children
- `ViewHolderCollection` — 0.19ms self, 0.25ms w/children — props: data, getLayout, getAdjustmentMargin
- `ScrollView` ×2 — 0.18ms self, 0.9ms w/children — props: children, scrollViewRef
- `StackScreen` — 0.11ms self, 0.14ms w/children — props: options
- `Animated(Anonymous)` — 0.08ms self, 0.65ms w/children — props: children
- `StackToolbar` — 0.08ms self, 0.13ms w/children — props: children
- `Animated(ScrollView)` — 0.07ms self, 0.53ms w/children — props: children, ref
- `Canvas` — 0.06ms self, 0.08ms w/children — props: style, children
- `StackToolbarHeader` — 0.05ms self, 0.05ms w/children — props: children
- `Screen` — 0.04ms self, 0.04ms w/children — props: options
- `AnimatedScrollViewWithOrWithoutInvertedRefreshControl` — 0.03ms self, 0.57ms w/children — props: children, ref
- `StackTitle` — 0.02ms self, 0.02ms w/children — props: children
- _... and 3 more_
- _Shown: 2.9ms self / 2.18ms commit (131%) — 3 more components not shown. Use `profiler-commit-query mode=by_index commit_index=31` to see all._

### Commit #32 — 19.82ms 🟡 (t=12.5s)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (2.8s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `ScreenStackItem` [forwardRef] re-rendered — props: sheetAllowedDetents, onWillAppear, onWillDisappear

Render cascade:
- `ScreenStackItem` [forwardRef] ×3 — 9.92ms self, 16.4ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `SceneView` ×6 — 1.98ms self, 19.49ms w/children — props: options, clearOptions
- `AnimatedText` ×2 — 1.33ms self, 1.74ms w/children — props: text
- `NativeStackNavigator` — 0.8ms self, 19.82ms w/children — state: useState, useReducer
- `NavigationProvider` ×6 — 0.62ms self, 18.44ms w/children — props: children
- `InnerScreen` [forwardRef] ×3 — 0.46ms self, 6.32ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `Animated(Anonymous)` ×3 — 0.43ms self, 5.38ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `ItemHeader` — 0.41ms self, 2.25ms w/children — props: item
- `View` ×8 — 0.33ms self, 22.82ms w/children — props: style, children
- `Freeze` ×3 — 0.21ms self, 5.74ms w/children — props: children
- `Context.Provider` ×48 — 0.21ms self, 234.36ms w/children — (mount)
- `ScreenStackHeaderConfig` ×3 — 0.2ms self, 2.63ms w/children — props: children
- `ViewHolderCollection` — 0.2ms self, 0.27ms w/children — state: useState
- `NativeStackView` — 0.19ms self, 18.7ms w/children — props: descriptors, describe
- `LinkZoomTransitionEnabler` ×4 — 0.19ms self, 0.35ms w/children — props: style
- _... and 21 more_
- _Shown: 17.5ms self / 19.82ms commit (88%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=32` to see all._

**CPU during this commit:**
- `[GC Young Gen]` self=19.82ms total=19.82ms ([suspended]:0)

### Commit #33 — 0.97ms 🔵 (t=12.5s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (2.8s prior)

- `AnimatedText` ×2 — 1.21ms self, 1.49ms w/children — state: useState
- `View` ×4 — 0.14ms self, 0.49ms w/children — props: style, children, ref
- `Canvas` ×2 — 0.1ms self, 0.13ms w/children — props: style, children

### Commit #42 — 2.19ms 🔵 (t=13.2s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (3.5s prior)

- `ItemScreen(./(app)/item/[id].tsx)` — 0.67ms self, 2.19ms w/children — hooks: useEffect
- `FlashList` [forwardRef] — 0.4ms self, 1.14ms w/children — props: data
- `ViewHolderCollection` — 0.2ms self, 0.26ms w/children — props: data, getLayout, getAdjustmentMargin
- `ScrollView` ×2 — 0.19ms self, 0.95ms w/children — props: children, scrollViewRef
- `View` ×4 — 0.15ms self, 3.8ms w/children — props: style, children
- `StackScreen` — 0.12ms self, 0.15ms w/children — props: options
- `Animated(Anonymous)` — 0.09ms self, 0.68ms w/children — props: children
- `Animated(ScrollView)` — 0.07ms self, 0.56ms w/children — props: children, ref
- `StackToolbar` — 0.06ms self, 0.11ms w/children — props: children
- `StackToolbarHeader` — 0.05ms self, 0.05ms w/children — props: children
- `AnimatedScrollViewWithOrWithoutInvertedRefreshControl` — 0.04ms self, 0.6ms w/children — props: children, ref
- `Screen` — 0.03ms self, 0.03ms w/children — props: options
- `StackTitle` — 0.02ms self, 0.02ms w/children — props: children
- `ScrollViewContext.Provider` — 0.01ms self, 0.28ms w/children — (mount)
- `Context.Provider` — 0.01ms self, 0.74ms w/children — (mount)
- _... and 1 more_
- _Shown: 2.1ms self / 2.19ms commit (96%) — 1 more components not shown. Use `profiler-commit-query mode=by_index commit_index=42` to see all._

### Commit #43 — 20.04ms 🟡 (t=13.2s)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (3.5s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `Animated(Anonymous)` re-rendered — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear

Render cascade:
- `Animated(Anonymous)` ×3 — 9.23ms self, 14.33ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `SceneView` ×6 — 2.54ms self, 19.76ms w/children — props: options, clearOptions
- `AnimatedText` ×2 — 1.32ms self, 1.79ms w/children — props: text
- `NativeStackNavigator` — 0.77ms self, 20.04ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.72ms self, 16.08ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.6ms self, 18.12ms w/children — props: children
- `InnerScreen` [forwardRef] ×3 — 0.42ms self, 15.22ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `ItemHeader` — 0.41ms self, 2.33ms w/children — props: item
- `View` ×8 — 0.34ms self, 23.36ms w/children — props: style, children
- `ScreenStackHeaderConfig` ×3 — 0.23ms self, 2.77ms w/children — props: children
- `Context.Provider` ×48 — 0.22ms self, 235.94ms w/children — (mount)
- `ViewHolderCollection` — 0.2ms self, 0.27ms w/children — state: useState
- `NativeStackView` — 0.2ms self, 18.97ms w/children — props: descriptors, describe
- `Freeze` ×3 — 0.2ms self, 14.67ms w/children — props: children
- `LinkZoomTransitionEnabler` ×4 — 0.18ms self, 0.34ms w/children — props: style
- _... and 21 more_
- _Shown: 17.6ms self / 20.04ms commit (88%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=43` to see all._

**CPU during this commit:**
- `[GC Young Gen]` self=19.82ms total=19.82ms ([suspended]:0)
- `[GC Young Gen]` self=0.22ms total=0.22ms ([suspended]:0)

### Commit #44 — 0.98ms 🔵 (t=13.2s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (3.5s prior)

- `AnimatedText` ×2 — 1.22ms self, 1.49ms w/children — state: useState
- `View` ×4 — 0.13ms self, 0.49ms w/children — props: style, children, ref
- `Canvas` ×2 — 0.1ms self, 0.12ms w/children — props: style, children

### Commit #64 — 2.27ms 🔵 (t=14.7s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (5.0s prior)

- `ItemScreen(./(app)/item/[id].tsx)` — 0.68ms self, 2.27ms w/children — hooks: useEffect
- `FlashList` [forwardRef] — 0.45ms self, 1.17ms w/children — props: data
- `ViewHolderCollection` — 0.2ms self, 0.27ms w/children — props: data, getLayout, getAdjustmentMargin
- `ScrollView` ×2 — 0.18ms self, 0.93ms w/children — props: children, scrollViewRef
- `View` ×4 — 0.16ms self, 3.91ms w/children — props: style, children
- `StackToolbar` — 0.12ms self, 0.17ms w/children — props: children
- `StackScreen` — 0.09ms self, 0.12ms w/children — props: options
- `Animated(Anonymous)` — 0.08ms self, 0.66ms w/children — props: children
- `Animated(ScrollView)` — 0.07ms self, 0.55ms w/children — props: children, ref
- `StackToolbarHeader` — 0.06ms self, 0.06ms w/children — props: children
- `AnimatedScrollViewWithOrWithoutInvertedRefreshControl` — 0.03ms self, 0.58ms w/children — props: children, ref
- `Screen` — 0.03ms self, 0.03ms w/children — props: options
- `StackTitle` — 0.02ms self, 0.02ms w/children — props: children
- `ScrollViewContext.Provider` — 0.01ms self, 0.28ms w/children — (mount)
- `FlashList` [React.memo] — 0.01ms self, 1.18ms w/children — props: data
- _... and 1 more_
- _Shown: 2.2ms self / 2.27ms commit (96%) — 1 more components not shown. Use `profiler-commit-query mode=by_index commit_index=64` to see all._

### Commit #65 — 21.14ms 🟡 (t=14.8s)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (5.1s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `NativeStackView` re-rendered — props: descriptors, describe

Render cascade:
- `NativeStackView` — 9.4ms self, 19.96ms w/children — props: descriptors, describe
- `SceneView` ×6 — 3.25ms self, 11.23ms w/children — props: options, clearOptions
- `AnimatedText` ×2 — 1.25ms self, 1.65ms w/children — props: text
- `NativeStackNavigator` — 0.84ms self, 21.14ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.69ms self, 6.9ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.62ms self, 8.89ms w/children — props: children
- `InnerScreen` [forwardRef] ×3 — 0.45ms self, 6.06ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `Animated(Anonymous)` ×3 — 0.4ms self, 5.15ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `ItemHeader` — 0.37ms self, 2.12ms w/children — props: item
- `View` ×8 — 0.32ms self, 14.63ms w/children — props: style, children
- `ScreenStack` — 0.31ms self, 10.3ms w/children — props: nativeContainerStyle, children
- `Context.Provider` ×48 — 0.21ms self, 197.87ms w/children — (mount)
- `Freeze` ×3 — 0.2ms self, 5.49ms w/children — props: children
- `ViewHolderCollection` — 0.2ms self, 0.26ms w/children — state: useState
- `ScreenStackHeaderConfig` ×3 — 0.2ms self, 2.5ms w/children — props: children
- _... and 21 more_
- _Shown: 18.7ms self / 21.14ms commit (89%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=65` to see all._

**CPU during this commit:**
- `propagateContextChanges` self=13.32ms total=13.32ms (&platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src/app&unstable_transformProfile=hermes-stable:21518)

### Commit #66 — 1.04ms 🔵 (t=14.8s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (5.1s prior)

- `AnimatedText` ×2 — 1.27ms self, 1.55ms w/children — state: useState
- `View` ×4 — 0.13ms self, 0.5ms w/children — props: style, children, ref
- `Canvas` ×2 — 0.1ms self, 0.13ms w/children — props: style, children

### Commit #67 — 0.98ms 🔵 (t=15.1s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (5.4s prior)

- `AnimatedText` — 0.81ms self, 0.98ms w/children — state: useState
- `View` ×2 — 0.08ms self, 0.3ms w/children — props: style, children, ref
- `Canvas` — 0.06ms self, 0.08ms w/children — props: style, children

### Commit #68 — 24.07ms 🟡 (t=15.1s)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (5.4s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `FlashList` [forwardRef] re-rendered — props: data, initialScrollIndex

Render cascade:
- `FlashList` [forwardRef] — 12.64ms self, 13.42ms w/children — props: data, initialScrollIndex
- `SceneView` ×8 — 1.98ms self, 81.73ms w/children — props: options, clearOptions
- `NavigationProvider` ×8 — 0.63ms self, 80.96ms w/children — props: children
- `NativeStackNavigator` — 0.57ms self, 21.86ms w/children — context changed
- `ScreenStackItem` [forwardRef] ×3 — 0.55ms self, 19.08ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `ItemScreen(./(app)/item/[id].tsx)` — 0.52ms self, 14.19ms w/children — hooks: useContext
- `Animated(Anonymous)` ×4 — 0.47ms self, 18.35ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `Route(item/[id])` — 0.39ms self, 14.89ms w/children — props: route
- `InnerScreen` [forwardRef] ×3 — 0.37ms self, 18.4ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `NavigationContent` ×3 — 0.36ms self, 66.92ms w/children — props: render, children
- `SlotNavigator` — 0.34ms self, 22.74ms w/children — context changed
- `Context.Provider` ×83 — 0.33ms self, 1159.97ms w/children — (mount)
- `Content` — 0.33ms self, 23.64ms w/children — context changed
- `BaseNavigationContainer` — 0.33ms self, 24.07ms w/children — hooks: useSyncExternalStore
- `View` ×5 — 0.2ms self, 49.03ms w/children — props: style, children
- _... and 43 more_
- _Shown: 20ms self / 24.07ms commit (83%) — 43 more components not shown. Use `profiler-commit-query mode=by_index commit_index=68` to see all._

**CPU during this commit:**
- `[Host Function] createTask` self=22.54ms total=22.54ms ([host]:0)
- `[GC Young Gen]` self=1.53ms total=1.53ms ([suspended]:0)

### Commit #69 — 8.78ms 🔵 (t=15.1s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (5.4s prior)

- `SceneView` ×6 — 1.66ms self, 8.47ms w/children — props: options, clearOptions
- `AnimatedText` ×2 — 1.24ms self, 1.56ms w/children — parent re-render
- `NativeStackNavigator` — 0.6ms self, 8.78ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.55ms self, 5.91ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.47ms self, 7.52ms w/children — props: children
- `InnerScreen` [forwardRef] ×3 — 0.37ms self, 5.23ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `ItemHeader` — 0.36ms self, 2ms w/children — parent re-render
- `Animated(Anonymous)` ×3 — 0.36ms self, 4.47ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `View` ×8 — 0.3ms self, 11.47ms w/children — props: style, children
- `Context.Provider` ×48 — 0.2ms self, 102.32ms w/children — (mount)
- `NativeStackView` — 0.17ms self, 7.91ms w/children — props: descriptors, describe
- `ViewHolderCollection` — 0.17ms self, 0.22ms w/children — state: useState
- `ScreenStackHeaderConfig` ×3 — 0.15ms self, 2.3ms w/children — props: children
- `Freeze` ×3 — 0.15ms self, 4.74ms w/children — props: children
- `LinkZoomTransitionEnabler` ×4 — 0.14ms self, 0.25ms w/children — props: style
- _... and 21 more_
- _Shown: 6.9ms self / 8.78ms commit (78%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=69` to see all._

### Commit #111 — 0.97ms 🔵 (t=18.1s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (8.4s prior)

- `AnimatedText` — 0.8ms self, 0.97ms w/children — state: useState
- `View` ×2 — 0.08ms self, 0.3ms w/children — props: style, children, ref
- `Canvas` — 0.06ms self, 0.08ms w/children — props: style, children

### Commit #112 — 24.43ms 🟡 (t=18.1s)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (8.4s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `FlashList` [forwardRef] re-rendered — props: data, initialScrollIndex

Render cascade:
- `FlashList` [forwardRef] — 12.25ms self, 13.43ms w/children — props: data, initialScrollIndex
- `SceneView` ×8 — 2.03ms self, 81.86ms w/children — props: options, clearOptions
- `NavigationProvider` ×8 — 0.64ms self, 81.05ms w/children — props: children
- `NativeStackNavigator` — 0.58ms self, 21.91ms w/children — context changed
- `ScreenStackItem` [forwardRef] ×3 — 0.56ms self, 19.03ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `ItemScreen(./(app)/item/[id].tsx)` — 0.53ms self, 14.2ms w/children — hooks: useContext
- `Animated(Anonymous)` ×4 — 0.48ms self, 18.7ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `Content` — 0.44ms self, 23.94ms w/children — context changed
- `SlotNavigator` — 0.42ms self, 22.9ms w/children — context changed
- `ViewHolderCollection` — 0.41ms self, 0.64ms w/children — props: data, getLayout, getAdjustmentMargin
- `NavigationContent` ×3 — 0.4ms self, 67.21ms w/children — props: render, children
- `BaseNavigationContainer` — 0.39ms self, 24.43ms w/children — hooks: useSyncExternalStore
- `InnerScreen` [forwardRef] ×3 — 0.37ms self, 18.35ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `Context.Provider` ×83 — 0.35ms self, 1164.1ms w/children — (mount)
- `Route(item/[id])` — 0.34ms self, 14.8ms w/children — props: route
- _... and 43 more_
- _Shown: 20.2ms self / 24.43ms commit (83%) — 43 more components not shown. Use `profiler-commit-query mode=by_index commit_index=112` to see all._

**CPU during this commit:**
- `[Host Function] createTask` self=13.06ms total=13.06ms ([host]:0)
- `ReactElement` self=9.85ms total=9.85ms (&platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src/app&unstable_transformProfile=hermes-stable:15622)
- `[GC Young Gen]` self=1.52ms total=1.52ms ([suspended]:0)

### Commit #113 — 9.47ms 🔵 (t=18.1s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (8.4s prior)

- `SceneView` ×6 — 1.63ms self, 9.22ms w/children — props: options, clearOptions
- `Animated(Anonymous)` ×3 — 1.31ms self, 5.28ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `AnimatedText` ×2 — 1.17ms self, 1.44ms w/children — parent re-render
- `NativeStackNavigator` — 0.61ms self, 9.47ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.55ms self, 6.68ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.47ms self, 8.28ms w/children — props: children
- `InnerScreen` [forwardRef] ×3 — 0.34ms self, 6.01ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `ItemHeader` — 0.32ms self, 1.84ms w/children — parent re-render
- `View` ×8 — 0.27ms self, 11.86ms w/children — props: style, children
- `Context.Provider` ×48 — 0.19ms self, 110.79ms w/children — (mount)
- `ScreenStackHeaderConfig` ×3 — 0.18ms self, 2.16ms w/children — props: children
- `NativeStackView` — 0.17ms self, 8.6ms w/children — props: descriptors, describe
- `Freeze` ×3 — 0.16ms self, 5.57ms w/children — props: children
- `ViewHolderCollection` — 0.16ms self, 0.22ms w/children — state: useState
- `LinkZoomTransitionEnabler` ×4 — 0.14ms self, 0.26ms w/children — props: style
- _... and 21 more_
- _Shown: 7.7ms self / 9.47ms commit (81%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=113` to see all._

### Commit #162 — 1.78ms 🔵 (t=21.5s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (11.8s prior)

- `AnimatedText` — 0.67ms self, 0.82ms w/children — state: useState
- `ItemScreen(./(app)/item/[id].tsx)` — 0.6ms self, 1.78ms w/children — hooks: useEffect
- `FlashList` [forwardRef] — 0.28ms self, 0.91ms w/children — props: data
- `View` ×6 — 0.21ms self, 3.27ms w/children — props: style, children
- `ScrollView` ×2 — 0.16ms self, 0.77ms w/children — props: children, scrollViewRef
- `ViewHolderCollection` — 0.15ms self, 0.21ms w/children — props: data, getLayout, getAdjustmentMargin
- `Animated(Anonymous)` — 0.08ms self, 0.58ms w/children — props: children
- `Animated(ScrollView)` — 0.07ms self, 0.47ms w/children — props: children, ref
- `StackScreen` — 0.06ms self, 0.09ms w/children — props: options
- `Canvas` — 0.06ms self, 0.07ms w/children — props: style, children
- `StackToolbar` — 0.05ms self, 0.07ms w/children — props: children
- `AnimatedScrollViewWithOrWithoutInvertedRefreshControl` — 0.03ms self, 0.5ms w/children — props: children, ref
- `Screen` — 0.03ms self, 0.03ms w/children — props: options
- `StackToolbarHeader` — 0.02ms self, 0.02ms w/children — props: children
- `StackTitle` — 0.02ms self, 0.02ms w/children — props: children
- _... and 3 more_
- _Shown: 2.5ms self / 1.78ms commit (140%) — 3 more components not shown. Use `profiler-commit-query mode=by_index commit_index=162` to see all._

### Commit #163 — 20.62ms 🟡 (t=21.6s)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (11.9s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `SceneView` re-rendered — props: options, clearOptions

Render cascade:
- `SceneView` ×6 — 1.98ms self, 30.16ms w/children — props: options, clearOptions
- `AnimatedText` ×2 — 1.37ms self, 1.81ms w/children — props: text
- `NativeStackNavigator` — 0.77ms self, 20.62ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.7ms self, 17.16ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.59ms self, 29.06ms w/children — props: children
- `ItemHeader` — 0.51ms self, 2.43ms w/children — props: item
- `InnerScreen` [forwardRef] ×3 — 0.45ms self, 16.3ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `Animated(Anonymous)` ×3 — 0.4ms self, 15.39ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `View` ×8 — 0.36ms self, 23.85ms w/children — props: style, children
- `ViewHolderCollection` — 0.28ms self, 0.36ms w/children — state: useState
- `ScreenStackHeaderConfig` ×3 — 0.21ms self, 2.85ms w/children — props: children
- `Freeze` ×3 — 0.2ms self, 15.74ms w/children — props: children
- `NativeStackView` — 0.2ms self, 19.52ms w/children — props: descriptors, describe
- `Context.Provider` ×48 — 0.2ms self, 342.86ms w/children — (mount)
- `NavigationContent` — 0.17ms self, 19.8ms w/children — props: render, children
- _... and 21 more_
- _Shown: 8.4ms self / 20.62ms commit (41%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=163` to see all._

**CPU during this commit:**
- `[Host Function] reportMeasure` self=18.22ms total=18.22ms ([host]:0)
- `[GC Young Gen]` self=2.4ms total=2.4ms ([suspended]:0)

### Commit #164 — 1ms 🔵 (t=21.6s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (11.9s prior)

- `AnimatedText` ×2 — 1.24ms self, 1.51ms w/children — state: useState
- `View` ×4 — 0.13ms self, 0.47ms w/children — props: style, children, ref
- `Canvas` ×2 — 0.1ms self, 0.12ms w/children — props: style, children

### Commit #195 — 1.78ms 🔵 (t=23.8s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (14.1s prior)

- `ItemScreen(./(app)/item/[id].tsx)` — 0.6ms self, 1.78ms w/children — hooks: useEffect
- `FlashList` [forwardRef] — 0.28ms self, 0.92ms w/children — props: data
- `ScrollView` ×2 — 0.16ms self, 0.78ms w/children — props: children, scrollViewRef
- `ViewHolderCollection` — 0.15ms self, 0.21ms w/children — props: data, getLayout, getAdjustmentMargin
- `View` ×4 — 0.15ms self, 3.02ms w/children — props: style, children
- `Animated(Anonymous)` — 0.08ms self, 0.58ms w/children — props: children
- `Animated(ScrollView)` — 0.07ms self, 0.47ms w/children — props: children, ref
- `StackScreen` — 0.06ms self, 0.09ms w/children — props: options
- `StackToolbar` — 0.04ms self, 0.07ms w/children — props: children
- `AnimatedScrollViewWithOrWithoutInvertedRefreshControl` — 0.03ms self, 0.5ms w/children — props: children, ref
- `Screen` — 0.03ms self, 0.03ms w/children — props: options
- `StackToolbarHeader` — 0.02ms self, 0.02ms w/children — props: children
- `StackTitle` — 0.02ms self, 0.02ms w/children — props: children
- `ScrollViewContext.Provider` — 0.01ms self, 0.22ms w/children — (mount)
- `Context.Provider` — 0.01ms self, 0.63ms w/children — (mount)
- _... and 1 more_
- _Shown: 1.7ms self / 1.78ms commit (96%) — 1 more components not shown. Use `profiler-commit-query mode=by_index commit_index=195` to see all._

### Commit #196 — 21.17ms 🟡 (t=23.9s)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (14.2s prior)
> 🟡 May be acceptable in production (dev mode is ~3× slower)

**Root cause:** `Animated(Anonymous)` re-rendered — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear

Render cascade:
- `Animated(Anonymous)` ×3 — 10.94ms self, 16.08ms w/children — props: sheetAllowedDetents, onHeaderHeightChange, onWillAppear
- `SceneView` ×6 — 1.98ms self, 20.87ms w/children — props: options, clearOptions
- `AnimatedText` ×2 — 1.45ms self, 1.93ms w/children — props: text
- `NativeStackNavigator` — 0.77ms self, 21.17ms w/children — state: useState, useReducer
- `ScreenStackItem` [forwardRef] ×3 — 0.69ms self, 17.8ms w/children — props: sheetAllowedDetents, onWillAppear, onWillDisappear
- `NavigationProvider` ×6 — 0.59ms self, 19.81ms w/children — props: children
- `InnerScreen` [forwardRef] ×3 — 0.42ms self, 16.97ms w/children — props: sheetAllowedDetents, style, scrollEdgeEffects
- `ItemHeader` — 0.4ms self, 2.45ms w/children — props: item
- `View` ×8 — 0.36ms self, 24.76ms w/children — props: style, children
- `Freeze` ×3 — 0.21ms self, 16.43ms w/children — props: children
- `ScreenStackHeaderConfig` ×3 — 0.21ms self, 2.85ms w/children — props: children
- `Context.Provider` ×48 — 0.2ms self, 251.01ms w/children — (mount)
- `ViewHolderCollection` — 0.2ms self, 0.27ms w/children — state: useState
- `NativeStackView` — 0.19ms self, 20.09ms w/children — props: descriptors, describe
- `LinkZoomTransitionEnabler` ×4 — 0.17ms self, 0.32ms w/children — props: style
- _... and 21 more_
- _Shown: 18.8ms self / 21.17ms commit (89%) — 21 more components not shown. Use `profiler-commit-query mode=by_index commit_index=196` to see all._

**CPU during this commit:**
- `[Host Function] queueMicrotask` self=15.16ms total=15.16ms ([host]:0)
- `[Host Function] createTask` self=5.17ms total=5.17ms ([host]:0)
- `[GC Young Gen]` self=0.84ms total=0.84ms ([suspended]:0)

### Commit #197 — 1.03ms 🔵 (t=23.9s, margin)
> After: "20 rapid alternating page swipes, 150ms gesture / 600ms interval" (14.2s prior)

- `AnimatedText` ×2 — 1.27ms self, 1.55ms w/children — state: useState
- `View` ×4 — 0.14ms self, 0.51ms w/children — props: style, children, ref
- `Canvas` ×2 — 0.1ms self, 0.13ms w/children — props: style, children

---
## Top Components by Total Render Cost

| Component | Renders | Total | Avg | Max | Reason | File |
|---|---|---|---|---|---|---|
| `FlashList` [forwardRef] | 8 | 27.7ms | 3.46ms | 12.64ms | props: data, initialScrollIndex | — |
| `SceneView` | 72 | 22.8ms | 0.32ms | 1.66ms | props: options, clearOptions, descriptor | — |
| `ScreenStackItem` [forwardRef] | 33 | 16.1ms | 0.49ms | 9.47ms | props: sheetAllowedDetents, onWillAppear, onWillDisappear | — |
| `ItemScreen(./(app)/item/[id].tsx)` | 8 | 14.9ms | 1.86ms | 10.62ms | hooks: useEffect, useContext | `item/[id].tsx:42` |
| `NativeStackView` | 11 | 11.2ms | 1.02ms | 9.4ms | props: descriptors, describe, state | — |
| `NativeStackNavigator` | 11 | 7.5ms | 0.68ms | 0.84ms | state: useState, useReducer | — |
| `NavigationProvider` | 72 | 6.3ms | 0.09ms | 0.12ms | props: children, route | — |
| `View` | 129 | 4.9ms | 0.04ms | 0.06ms | props: children, style, ref | — |
| `InnerScreen` [forwardRef] | 33 | 4.4ms | 0.13ms | 0.17ms | props: sheetAllowedDetents, style, scrollEdgeEffects | — |
| `ViewHolderCollection` | 16 | 3.2ms | 0.2ms | 0.41ms | props: data, getLayout, getAdjustmentMargin | — |
| `ItemHeader` | 8 | 3.1ms | 0.39ms | 0.51ms | props: item | `components/item-header.tsx:11` |
| `NavigationContent` | 17 | 2.3ms | 0.14ms | 0.17ms | props: render, children | — |
| `ScreenStackHeaderConfig` | 33 | 2.1ms | 0.06ms | 0.11ms | props: children, headerRightBarButtonItems | — |
| `Freeze` | 33 | 2ms | 0.06ms | 0.08ms | props: children | — |
| `Canvas` | 31 | 1.8ms | 0.06ms | 0.07ms | props: style, children | — |
| `Screen` | 41 | 1.7ms | 0.04ms | 0.06ms | props: ref, sheetAllowedDetents, style | — |
| `EnsureSingleNavigator` | 42 | 1.4ms | 0.03ms | 0.04ms | props: children | — |
| `ScrollView` | 16 | 1.4ms | 0.09ms | 0.2ms | props: children, scrollViewRef, ref | — |
| `ScreenStack` | 11 | 1.3ms | 0.12ms | 0.31ms | props: nativeContainerStyle, children | — |
| `StackToolbar` | 8 | 1.2ms | 0.15ms | 0.81ms | props: children | — |

---
## Suggested Improvements

### `FlashList` [forwardRef]

**Stabilize props:** `data`, `initialScrollIndex`. Likely inline objects/functions at the callsite — extract to constants or wrap with `useMemo`/`useCallback`.

### `SceneView`

**Stabilize props:** `options`, `clearOptions`, `descriptor`. Likely inline objects/functions at the callsite — extract to constants or wrap with `useMemo`/`useCallback`.

### `ScreenStackItem` [forwardRef]

**Stabilize props:** `sheetAllowedDetents`, `onWillAppear`, `onWillDisappear`. Likely inline objects/functions at the callsite — extract to constants or wrap with `useMemo`/`useCallback`.

### `ItemScreen(./(app)/item/[id].tsx)` — `item/[id].tsx:42`

**Unstable hook deps:** `useEffect`, `useContext`. Check dependency arrays in `useEffect`/`useMemo` — a dependency may be recreated on every render.

<details><summary>Source — `item/[id].tsx:42`</summary>

```tsx

export default function ItemScreen() {
  const { id, from, spaceId, q } = useLocalSearchParams<{
    id: string;
    from?: string;
    spaceId?: string;
    q?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation<NativeStackNavigationProp<{ 'item/[id]': { id: string } }>>();
  const { theme } = useUnistyles();
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const deleteItem = useMutation(api.items.deleteItem);
  const acceptSuggestion = useMutation(api.spaces.acceptSuggestion);
  const dismissSuggestion = useMutation(api.spaces.dismissSuggestion);
  const listRef = useRef<FlashListRef<DetailItem>>(null);

  // Rebuild the ordered sibling list from whichever list the user opened from.
  // Each of these queries is already warm in the cache from the source screen,
  // so this is a cache read, not a network round-trip.
  const listQ = useQuery(
    convexQuery(api.items.listItems, from !== 'space' && from !== 'search' ? {} : 'skip'),
  );
  const spaceQ = useQuery(
    convexQuery(
      api.spaces.getSpace,
      from === 'space' && spaceId ? { id: spaceId as Id<'spaces'> } : 'skip',
    ),
  );
  const searchQ = useQuery(
    convexQuery(api.items.searchItems, from === 'search' && q ? { query: q } : 'skip'),
  );

  // A single-item fallback for deep links (no source) or a stale list that no
  // longer contains this id.
  const { data: single } = useQuery(
    convexQuery(api.items.getItem, { id: id as Id<'items'> }),
  );

  // Mirror the space screen's feed order exactly (suggestions first, then
  // saved) so swiping pages through what the user saw in the grid.
  const list = useMemo<DetailItem[] | undefined>(
    () =>
      from === 'space'
        ? spaceQ.data
          ? [...spaceQ.data.suggestions, ...spaceQ.data.items]
          : undefined
        : from === 'search'
```

</details>

### `NativeStackView`

**Stabilize props:** `descriptors`, `describe`, `state`. Likely inline objects/functions at the callsite — extract to constants or wrap with `useMemo`/`useCallback`.


> 📝 Dev mode renders are ~3× slower than production. Divide ms values by ~3 for a rough production estimate.

---
## Next Steps

Ask the user which path to take:

1. **Investigate further** — use query tools to drill into specific findings before making changes:
   - `profiler-commit-query` mode=`by_index` commit_index=112 — full breakdown of the slowest commit
   - `profiler-cpu-query` mode=`component_cpu` component_name=`ForwardRef(FlashList)` — CPU activity during this component's renders
   - `profiler-cpu-query` mode=`call_tree` — trace callers/callees of hot functions
2. **Implement fixes** — apply changes to the top offenders identified above, then re-profile the same scenario to measure improvement.
3. **Done for now** — save the report for reference.