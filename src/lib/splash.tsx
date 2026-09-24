import { Wordmark } from '@/components/wordmark';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

type HoldMode = 'show' | 'keep';
type Holds = Record<HoldMode, number>;
const SplashContext = createContext<((mode: HoldMode) => () => void) | null>(
  null,
);

const breathe = {
  duration: 900,
  easing: Easing.inOut(Easing.sin),
  reduceMotion: ReduceMotion.Never,
};
const dip = {
  duration: 260,
  dampingRatio: 0.9,
  reduceMotion: ReduceMotion.Never,
};
const lift = {
  duration: 500,
  dampingRatio: 1,
  reduceMotion: ReduceMotion.Never,
};
const fadeAway = {
  duration: 320,
  easing: Easing.out(Easing.quad),
  reduceMotion: ReduceMotion.Never,
};
// Loading screens hand off to each other across commits (lock → private data →
// onboarding). Wait out that gap so the splash only exits once, into the app.
const SETTLE_MS = 80;

function BreathingWordmark({ breathing = true }: { breathing?: boolean }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = breathing
      ? withRepeat(withTiming(0.7, breathe), -1, true)
      : withTiming(1, fadeAway);
  }, [breathing, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={style}>
      <Wordmark size={44} />
    </Animated.View>
  );
}

function SplashOverlay({
  ready,
  onRevealed,
}: {
  ready: boolean;
  onRevealed: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [exiting, setExiting] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!ready) {
      // Something locked or started loading again mid-exit: settle back.
      scale.value = withSpring(1, lift);
      opacity.value = withTiming(1, fadeAway);
      return;
    }
    const timeout = setTimeout(() => {
      setExiting(true);
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(onRevealed);
      };
      if (reducedMotion) {
        opacity.value = withTiming(0, fadeAway, done);
        return;
      }
      scale.value = withSequence(withSpring(0.9, dip), withSpring(1.3, lift));
      opacity.value = withDelay(dip.duration, withTiming(0, fadeAway, done));
    }, SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [ready, reducedMotion, onRevealed, scale, opacity]);

  const leaving = ready && exiting;
  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[styles.screen, styles.overlay, containerStyle]}
      pointerEvents={leaving ? 'none' : 'auto'}
      accessibilityLabel="Amber"
      testID="splash-screen"
    >
      <Animated.View style={markStyle}>
        <BreathingWordmark breathing={!leaving} />
      </Animated.View>
    </Animated.View>
  );
}

// Covers the app at launch, while Amber is in the background, and while the
// biometric lock verifies. It exits once nothing holds it, so the reveal lands
// on the real screen instead of an intermediate loading state.
export function SplashProvider({ children }: { children: React.ReactNode }) {
  const [holds, setHolds] = useState<Holds>({ show: 0, keep: 0 });
  const [visible, setVisible] = useState(true);
  if (holds.show > 0 && !visible) setVisible(true);
  const hold = useCallback((mode: HoldMode) => {
    const change = (by: number) =>
      setHolds((current) => ({ ...current, [mode]: current[mode] + by }));
    change(1);
    return () => change(-1);
  }, []);
  const reveal = useCallback(() => setVisible(false), []);
  const ready = holds.show === 0 && holds.keep === 0;
  return (
    <SplashContext value={hold}>
      <View style={styles.root}>
        {children}
        {visible && <SplashOverlay ready={ready} onRevealed={reveal} />}
      </View>
    </SplashContext>
  );
}

// `show` raises the splash (lock, background cover). `keep` only extends a
// splash that is already up, so loaders behind other covers stay quiet.
// A layout effect raises it before the frame is drawn, ahead of iOS's
// app-switcher snapshot.
export function useSplashHold(active: boolean, mode: HoldMode = 'keep') {
  const hold = use(SplashContext);
  useLayoutEffect(() => {
    if (active && hold) return hold(mode);
  }, [active, mode, hold]);
}

// The only loading state Amber shows: the breathing wordmark, alone.
export function LoadingScreen({ show = false }: { show?: boolean }) {
  useSplashHold(true, show ? 'show' : 'keep');
  return (
    <View
      style={styles.screen}
      accessibilityLabel="Loading Amber"
      testID="loading-screen"
    >
      <BreathingWordmark />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
}));
