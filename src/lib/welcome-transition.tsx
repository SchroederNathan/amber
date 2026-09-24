import { Welcome } from '@/components/onboarding/welcome';
import { fadeOut, motion } from '@/styles/motion';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SlideOutUp, useReducedMotion } from 'react-native-reanimated';

const exitUp = SlideOutUp.duration(motion.duration.screen).easing(motion.easing.inOut);
const WelcomeTransitionContext = createContext({
  cover: () => {},
  reveal: () => {},
});

// Lives above the auth boundary so the welcome can exit over the real next
// screen, even though signing in replaces the entire authenticated subtree.
export function WelcomeTransitionProvider({ children }: { children: ReactNode }) {
  const [covered, setCovered] = useState(false);
  const reducedMotion = useReducedMotion();
  const cover = useCallback(() => setCovered(true), []);
  const reveal = useCallback(() => setCovered(false), []);
  const value = useMemo(() => ({ cover, reveal }), [cover, reveal]);

  useEffect(() => {
    if (!covered) return;
    // Auth/storage recovery screens must remain reachable if setup cannot load.
    const timeout = setTimeout(reveal, 2000);
    return () => clearTimeout(timeout);
  }, [covered, reveal]);

  return (
    <WelcomeTransitionContext value={value}>
      <View style={styles.root}>
        {children}
        {covered && (
          <Animated.View
            exiting={reducedMotion ? fadeOut : exitUp}
            style={styles.cover}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Welcome pending />
          </Animated.View>
        )}
      </View>
    </WelcomeTransitionContext>
  );
}

export const useWelcomeTransition = () => useContext(WelcomeTransitionContext);
const styles = StyleSheet.create({ root: { flex: 1 }, cover: { ...StyleSheet.absoluteFill, zIndex: 10 } });
