import { Button } from '@/components/ui/button';
import { PermissionDevice } from '@/components/onboarding/permission-device';
import { useAppLock } from '@/lib/app-lock';
import { useOnboarding } from '@/lib/onboarding';
import { requestOnboardingPermission } from '@/lib/onboarding-permissions';
import { fadeIn, motion } from '@/styles/motion';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Linking, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useCameraPermission } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

const steps = ['camera', 'photos', 'biometrics'] as const;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const heroHeight = Math.max(280, Math.min(height * 0.49, 540));
  const reducedMotion = useReducedMotion();
  const { completeOnboarding } = useOnboarding();
  const lock = useAppLock();
  const camera = useCameraPermission();
  const [library, requestLibrary, getLibrary] = ImagePicker.useMediaLibraryPermissions();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsNeeded, setSettingsNeeded] = useState(false);
  // Guard rapid taps before React commits disabled button props.
  const inFlight = useRef(false);
  const progress = useSharedValue(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getLibrary().catch(() => {});
    });
    return () => subscription.remove();
  }, [getLibrary]);
  const current = steps[step];
  const granted = current === 'camera' ? camera.hasPermission
    : current === 'photos' ? library?.granted || library?.accessPrivileges === 'limited'
    : lock.enabled;

  const title = current === 'camera' ? 'See it. Save it.'
    : current === 'photos' ? 'Keep your favorites.' : 'Just for your eyes.';
  const description = current === 'camera'
    ? 'Use your camera to save things that catch your eye.'
    : current === 'photos'
      ? 'Save your favorite photos and screenshots to Amber.'
      : lock.available
        ? `Unlock Amber with ${lock.label} to keep your saves private.`
        : 'Set up Face ID or a fingerprint on your device to lock Amber.';

  const unlockTransition = useCallback(() => {
    inFlight.current = false;
    setTransitioning(false);
  }, []);

  const advance = async () => {
    setError(null);
    setSettingsNeeded(false);
    if (step === steps.length - 1) {
      await completeOnboarding();
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      return;
    }
    const next = step + 1;
    setStep(next);
    setTransitioning(true);
    AccessibilityInfo.announceForAccessibility(next === 1 ? 'Photo library. Step 2 of 3.' : 'Biometric lock. Step 3 of 3.');
    progress.set(withTiming(next, {
      ...(reducedMotion ? motion.timing.fade : motion.timing.enter),
      duration: reducedMotion ? motion.duration.state : 400,
    }, (finished) => {
      if (finished) scheduleOnRN(unlockTransition);
    }));
  };

  const run = async (skip = false) => {
    if (inFlight.current || lock.busy) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    let advancing = false;
    try {
      const result = skip ? { allowed: true, settingsNeeded: false }
        : await requestOnboardingPermission(current, {
          camera,
          photos: { get: getLibrary, request: requestLibrary },
          biometrics: lock,
        });
      if (!result.allowed) {
        setSettingsNeeded(result.settingsNeeded);
        setError({
          camera: 'Camera access is off. You can enable it in Settings, or continue without it.',
          photos: 'Photo access is off. Allow access when you’re ready, or continue without it.',
          biometrics: 'Your lock wasn’t enabled. Try again, or set it up later in your profile.',
        }[current]);
      }
      if (result.allowed) {
        await advance();
        advancing = step < steps.length - 1;
      }
    } catch {
      setError(current === 'biometrics'
        ? 'Could not finish setup. Please try again.'
        : 'Could not update this permission. Please try again, or skip for now.');
    } finally {
      setBusy(false);
      if (!advancing) inFlight.current = false;
    }
  };

  const primaryTitle = granted ? (current === 'biometrics' ? 'Start saving' : 'Continue')
    : current === 'camera' ? 'Allow camera access'
      : current === 'photos' ? 'Allow photo access'
        : lock.available ? `Enable ${lock.label}` : 'Start saving';
  const disabled = busy || lock.busy || transitioning;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} bounces={false} showsVerticalScrollIndicator={false} removeClippedSubviews={false}>
        <View style={[styles.hero, { height: heroHeight }]}>
          {steps.map((name, index) => (
            <PermissionDevice
              key={name}
              kind={name}
              index={index}
              progress={progress}
              width={width}
              size={heroHeight * 1.15}
              top={insets.top + 16}
              reducedMotion={reducedMotion}
            />
          ))}
        </View>
        <View style={styles.copyContainer}>
          <Animated.View key={current} entering={fadeIn} style={styles.copy}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text
              accessibilityRole={error ? 'alert' : undefined}
              accessibilityLiveRegion="polite"
              style={[styles.description, error && styles.error]}
            >{error ?? description}</Text>
          </Animated.View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.actions}>
          <Button
            testID={`onboarding-${current}-allow`}
            tone="onboarding"
            size="lg"
            title={settingsNeeded && !granted ? 'Open Settings' : primaryTitle}
            loading={busy || lock.busy}
            disabled={disabled}
            onPress={() => {
              if (settingsNeeded && !granted) {
                void Linking.openSettings().catch(() => setError('Could not open Settings. You can skip this step for now.'));
              } else {
                void run();
              }
            }}
          />
          <Button testID={`onboarding-${current}-skip`} title="Not now" tone="onboarding" size="lg" variant="secondary" disabled={disabled} onPress={() => { void run(true); }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.onboarding.background },
  scroll: { flex: 1 },
  copyContainer: { padding: 28, paddingBottom: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: theme.onboarding.hero, overflow: 'hidden' },
  footer: { paddingHorizontal: 28, paddingTop: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  copy: { gap: 12 },
  title: { fontFamily: theme.fonts.display, fontSize: 38, lineHeight: 43, color: theme.onboarding.foreground },
  description: { ...theme.type.body, lineHeight: 24, color: theme.onboarding.muted },
  actions: { gap: 12 },
  error: { color: theme.colors.danger },
}));
