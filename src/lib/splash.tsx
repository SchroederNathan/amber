import { Wordmark } from '@/components/wordmark';
import { motion } from '@/styles/motion';
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
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
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

const splash = motion.splash;
// Loading screens hand off to each other across commits (lock → private data →
// onboarding). Wait out that gap so the splash only exits once, into the app.
const SETTLE_MS = 80;

function BreathingWordmark({ breathing = true }: { breathing?: boolean }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(breathing
      ? withRepeat(withTiming(splash.breatheOpacity, splash.breathe), -1, true)
      : withTiming(1, splash.fade));
  }, [breathing, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
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
      // Something locked or started loading again mid-exit: cover back up.
      // The mark never animates smaller; it resets to rest size at once.
      scale.set(1);
      opacity.set(withTiming(1, splash.fade));
      return;
    }
    const timeout = setTimeout(() => {
      setExiting(true);
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(onRevealed);
      };
      // The mark only grows on the way out, while the cover fades over it.
      if (!reducedMotion) scale.set(withSpring(splash.growScale, splash.grow));
      opacity.set(withTiming(0, splash.fade, done));
    }, SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [ready, reducedMotion, onRevealed, scale, opacity]);

  const leaving = ready && exiting;
  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
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
