import {
  cubicBezier,
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
} from 'react-native-reanimated';

// Animate Expo's exact curves, shared by CSS transitions and UI worklets.
const curves = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  sheet: [0.32, 0.72, 0, 1],
} as const;

const duration = { feedback: 120, state: 180, enter: 250, exit: 200 } as const;
const easing = {
  out: Easing.bezier(...curves.out),
  inOut: Easing.bezier(...curves.inOut),
  sheet: Easing.bezier(...curves.sheet),
  linear: Easing.linear,
};

// CSS easing objects are class instances. Keep them outside `motion` so a
// gesture capturing motion.spring never tries to serialize them to the UI runtime.
export const motionCSS = {
  out: cubicBezier(...curves.out),
  inOut: cubicBezier(...curves.inOut),
  sheet: cubicBezier(...curves.sheet),
};

// Pure fades/color changes remain gentle with Reduce Motion enabled. Spatial
// motion uses System or an explicit reduced-motion branch at the call site.
export const motion = {
  duration,
  easing,
  timing: {
    feedback: { duration: duration.feedback, easing: easing.out, reduceMotion: ReduceMotion.System },
    state: { duration: duration.state, easing: easing.out, reduceMotion: ReduceMotion.System },
    enter: { duration: duration.enter, easing: easing.out, reduceMotion: ReduceMotion.System },
    exit: { duration: duration.exit, easing: easing.out, reduceMotion: ReduceMotion.System },
    fade: { duration: duration.feedback, easing: easing.out, reduceMotion: ReduceMotion.Never },
    textMove: { duration: duration.feedback, easing: easing.inOut, reduceMotion: ReduceMotion.System },
  },
  spring: {
    settle: { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System },
    drag: { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System },
    sheet: { duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System },
  },
  scale: { pressed: 0.97, enter: 0.95 },
} as const;

// Builders stay outside render; these only animate opacity, including under
// Reduce Motion. Don't attach entrances to recycled list rows.
export const fadeIn = FadeIn.duration(duration.enter)
  .easing(easing.out)
  .reduceMotion(ReduceMotion.Never);
export const fadeOut = FadeOut.duration(duration.exit)
  .easing(easing.out)
  .reduceMotion(ReduceMotion.Never);
