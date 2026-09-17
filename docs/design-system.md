# Amber design system

`src/unistyles.ts` remains the app's single theme registration and visual source
of truth. Keep Amber's warm light/dark palette and Satoshi/Exposure fonts. Extend
this theme instead of adding a parallel theme or styling library.

## Tokens and components

- `theme.type`: named styles for the existing type ramp. Static font files select
  their own weight through `fontFamily`; do not add `fontWeight` to them.
- `theme.spacing`: named 4-point steps. `theme.gap()` remains compatible with
  existing layouts; use named steps for new or substantially edited components.
- `theme.colors`: adaptive brand/semantic roles; `theme.media` deliberately keeps
  camera chrome and photo paper at fixed contrast.
- `theme.radius`, `theme.shadows`, `theme.opacity`, `theme.control`: shared shape,
  elevation, interaction and minimum target values. Use continuous corners on
  non-capsule surfaces.
- `ThemedText`: `variant` selects a type style, native font scaling stays enabled,
  and caller styles merge last. Existing Unistyles components can spread the same
  `theme.type` styles into their stylesheets.
- `Button`: primary intent, medium size (48-point minimum), pressed, disabled and
  loading states. `title` remains its accessible label while a spinner is shown.
  Style overrides merge last for layout. Add sizes/variants only when a screen
  needs them. New Space and the Tidy checkpoint are the reference consumers.
- Native `Switch` handles settings toggles, with explicit labels. Native stacks,
  form sheets and native tabs own their navigation behavior.

## Motion

`src/styles/motion.ts` supplies the motion tokens registered in the Unistyles
theme. Import `motion` directly in worklets so they do not capture a theme proxy.
CSS uses the separately exported `motionCSS`, derived from the same coordinates:
its easing class instances cannot be serialized into a worklet closure.

| Purpose | Curve / spring | Duration |
| --- | --- | --- |
| Frequent feedback, title changes, press | `bezier(0.23, 1, 0.32, 1)` | 120ms |
| Small state changes | Same ease-out | 180ms |
| Occasional entrance / exit | Same ease-out | 250ms / 200ms |
| Existing glyphs moving on screen | `bezier(0.77, 0, 0.175, 1)` | 120ms |
| Settle without momentum | Spring, damping ratio 1 | 400ms perceptual |
| Drag release / snap back | Spring, damping ratio 0.8, actual release velocity | 400ms perceptual |
| Custom sheet, if ever needed | Spring, damping ratio 0.8, velocity | 300ms perceptual |

Press scale is 0.97. Spatial entrances start at 0.95 where needed. Never use a
default spring, default timing easing, ease-in, a scale-from-zero effect, or
per-row entrances in a virtualized list. Tab switches stay native. Onboarding
uses one short fade budget rather than a long stagger that delays its controls.

Reduced Motion suppresses scale, translation, rotation, parallax and glyph blur;
short opacity/color feedback remains. Stack transitions become fades and Apple
zoom links are disabled. Reanimated's `useReducedMotion()` reads the preference
at app startup: restart/reload after changing the OS setting for verification.
Animated titles use native text at larger Dynamic Type sizes.

Tidy gesture values stay on the UI runtime. Release projection permits short
flicks; velocity passes into the spring. Cancelled pans return home, re-grabs
start from the current position, and only the active card receives touches.
Haptics latch on the UI runtime before scheduling a single RN callback per pan.

## Adoption audit — September 16, 2026

Static candidate counts across application TypeScript, excluding theme tokens
and the widget's separate execution context. Scores are candidates per 100 source
lines (approximately 6,900 before; 6,700 after), not accessibility or visual-quality scores.

| Category | Before → after | Score before → after |
| --- | --- | --- |
| Literal font sizes | 73 → 0 | 1.1 → 0.0 |
| Hex / rgba colors | 25 → 0 | 0.4 → 0.0 |
| Nonzero literal spacing | 22 → 9 | 0.3 → 0.1 |
| Literal radii / shadow definitions | 30 → 13 | 0.4 → 0.2 |
| Local durations / legacy spring configs | 30 → 0 | 0.4 → 0.0 |

The remaining spacing/radius candidates include optical metadata gaps, camera
circles and composed image borders. Migrate those with their screen's next layout
review; do not bulk-normalize image geometry. The widget's palette lives inside
its serialized render function and needs a separate runtime-compatible migration.

## Validation

- `npx tsc --noEmit`
- `node --experimental-strip-types --test tests/swipe-decision.test.mjs`
- `npx expo lint` (existing effect-state errors in New Space / Manage Spaces and
  three existing item-detail warnings; no new diagnostics)
- iOS simulator: native switch and primary button, short keep flick, undo, slow
  below-threshold drag returning home; repeated flicks and undo with iOS Reduce
  Motion enabled. Simulator checks establish function, not release performance
  or haptic feel.

Before judging feel, use a release build on the slowest supported device: flick,
reverse and re-grab a card, undo mid-settle, and check haptic timing. Check large
text, dark mode and Reduce Motion.

References: [Expo 57](https://docs.expo.dev/versions/v57.0.0/),
[Expo 57 Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/), and the
Animate Expo / Expo Design System skills used for this migration.
