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
- `Button` (`src/components/ui/button.tsx`) is the only large action button. Do
  not hand-roll a `Pressable` CTA.
  - Shape: every button is a capsule (`theme.radius.full`), at every size.
  - Material: interactive Liquid Glass (`expo-glass-effect`) where
    `isLiquidGlassAvailable()`. The system owns the press response there. Other
    platforms get a solid fill that dims (`theme.opacity.held`) and scales to 0.97.
  - `variant`: `primary` (glass tinted with the fill color), `secondary` (glass
    with a faint `glassTint` so it reads on flat backgrounds), `destructive`
    (secondary glass with a danger label).
  - `size`: `md` (48-point minimum, default) or `lg` (56 points, onboarding).
  - `tone`: the surface the button sits on. `app` (default), `onboarding` (the
    onboarding palette) or `media` (dark camera chrome).
  - `icon` is an optional leading node. `loading` dims the button and disables
    it. It never swaps in a spinner or adds a status view, so nothing reflows.
  - Style overrides merge last and are for layout only (`alignSelf`, `flex`,
    margins, `minWidth`). Consumers: welcome, onboarding, New Space, Tidy gate and
    checkpoint, camera fallback, item decision bar, privacy lock, profile sign-out.
- Native `Switch` handles settings toggles, with explicit labels. Native stacks,
  form sheets and native tabs own their navigation behavior.

## Motion

`src/styles/motion.ts` supplies the motion tokens registered in the Unistyles
theme. Import `motion` directly in worklets so they do not capture a theme proxy.
CSS uses the separately exported `motionCSS`, derived from the same coordinates:
its easing class instances cannot be serialized into a worklet closure.

| Purpose | Curve / spring | Duration |
| --- | --- | --- |
| Frequent feedback, press | `bezier(0.23, 1, 0.32, 1)` | 120ms |
| Small state changes | Same ease-out | 180ms |
| Occasional entrance / exit | Same ease-out | 250ms / 200ms |
| Text morph: reveal / exit | Ease-out | 260ms / 240ms |
| Text morph: existing glyph glide | `bezier(0.77, 0, 0.175, 1)` | 320ms after 140ms delay |
| Text morph: rise / grow | Spring, damping ratio 1 | 550ms perceptual |
| Settle without momentum | Spring, damping ratio 1 | 400ms perceptual |
| Drag release / snap back | Spring, damping ratio 0.8, actual release velocity | 400ms perceptual |
| Custom sheet, if ever needed | Spring, damping ratio 0.8, velocity | 300ms perceptual |

Press scale is 0.97. Spatial entrances start at 0.95 where needed. Never use a
default spring, default timing easing, ease-in, a scale-from-zero effect, or
per-row entrances in a virtualized list. Tab switches stay native. Onboarding
uses one short fade budget rather than a long stagger that delays its controls.

`motion.textMorph` preserves the requested
[RN Motion blurred-text choreography](https://rnmotion.dev/animations/blurred-text-morph):
25ms per letter, a 120ms entrance lead, 0.7 glyph scale and 6-point blur. This is
an intentional exception to the short feedback budget. Shared letters glide;
new letters rise and sharpen; removed letters lift right, shrink and blur away.
The canvas overflows its layout slot so compact headers do not crop the effect.
A cancellable RN-side timer removes completed exits in one batch; glyphs never
schedule individual cleanup callbacks across Worklets. Headers mount fully
visible, including the handoff from native font-loading text to the canvas.
Returning letters cancel their previous fade before retargeting, without another
entrance delay. If the text changes again before the morph finishes, discard
outgoing fragments, show new letters immediately, and settle surviving letters
with the 120ms ease-out feedback token. Ordinary changes retain the full morph.
Titles are measured to fit their slot with an ellipsis
and a bounded retiring layer; accessibility retains the full text. Opacity/blur
use the design system's ease-out curve.

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
  no new diagnostics; prior pager warnings resolved)
- iOS simulator: native switch and primary button, short keep flick, undo, slow
  below-threshold drag returning home; repeated flicks and undo with iOS Reduce
  Motion enabled. Simulator checks establish function, not release performance
  or haptic feel.
- Text morph: recorded Add title changes and a rapid item-page reversal; checked
  intermediate frames for visible blur/glide, compact-header overflow and full
  letter recovery after interruption.

Before judging feel, use a release build on the slowest supported device: flick,
reverse and re-grab a card, undo mid-settle, and check haptic timing. Check large
text, dark mode and Reduce Motion.

References: [Expo 57](https://docs.expo.dev/versions/v57.0.0/),
[Expo 57 Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/), and the
Animate Expo / Expo Design System skills used for this migration.
