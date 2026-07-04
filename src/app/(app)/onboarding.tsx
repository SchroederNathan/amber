import { Wordmark } from '@/components/wordmark';
import { useOnboarding } from '@/lib/onboarding';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useCameraPermission } from 'react-native-vision-camera';

function FeatureRow({
  icon,
  title,
  message,
  delay,
}: {
  icon: SFSymbol;
  title: string;
  message: string;
  delay: number;
}) {
  const { theme } = useUnistyles();
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.feature}>
      <View style={styles.featureIcon}>
        <SymbolView name={icon} size={20} tintColor={theme.colors.primaryText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureMessage}>{message}</Text>
      </View>
    </Animated.View>
  );
}

function PermissionButton({
  icon,
  label,
  granted,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  granted: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={granted ? undefined : onPress}
      style={({ pressed }) => [
        styles.permission,
        granted && styles.permissionGranted,
        pressed && !granted && { opacity: 0.8 },
      ]}
    >
      <SymbolView
        name={granted ? 'checkmark.circle.fill' : icon}
        size={18}
        tintColor={granted ? theme.colors.primary : theme.colors.foreground}
      />
      <Text style={styles.permissionLabel}>{label}</Text>
      <Text style={styles.permissionState}>{granted ? 'Ready' : 'Allow'}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useOnboarding();
  const { hasPermission: cameraGranted, requestPermission: requestCamera } =
    useCameraPermission();
  const [libraryPermission, requestLibrary] = ImagePicker.useMediaLibraryPermissions();

  const finish = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    completeOnboarding();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
        <Wordmark size={44} />
        <Text style={styles.slogan}>Save it for later.</Text>
      </Animated.View>

      <View style={styles.features}>
        <FeatureRow
          delay={150}
          icon="square.grid.2x2"
          title="One warm shelf"
          message="Links, photos, notes — everything lands in one calm masonry feed."
        />
        <FeatureRow
          delay={280}
          icon="sparkles"
          title="Amber tags it for you"
          message="Every save is read, titled, and tagged, then filed into your spaces."
        />
        <FeatureRow
          delay={410}
          icon="doc.text"
          title="Read it right here"
          message="Saved articles open in a clean, quiet reader — no tabs, no clutter."
        />
      </View>

      <Animated.View entering={FadeInDown.delay(540).duration(400)} style={styles.permissions}>
        <Text style={styles.permissionsHint}>
          Amber works best with a couple of permissions — you stay in control.
        </Text>
        <PermissionButton
          icon="camera"
          label="Camera"
          granted={cameraGranted}
          onPress={requestCamera}
        />
        <PermissionButton
          icon="photo.on.rectangle"
          label="Photo Library"
          granted={libraryPermission?.granted ?? false}
          onPress={requestLibrary}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(650).duration(400)}>
        <Pressable
          onPress={finish}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaText}>Start saving</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.gap(3),
    gap: theme.gap(4),
  },
  hero: {
    alignItems: 'center',
    gap: theme.gap(1),
  },
  slogan: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    color: theme.colors.muted,
  },
  features: {
    gap: theme.gap(2.5),
  },
  feature: {
    flexDirection: 'row',
    gap: theme.gap(1.5),
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.foreground,
  },
  featureMessage: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  permissions: {
    gap: theme.gap(1),
  },
  permissionsHint: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.faint,
    marginBottom: theme.gap(0.5),
  },
  permission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.25),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.gap(1.5),
  },
  permissionGranted: {
    borderColor: theme.colors.primarySoft,
    backgroundColor: theme.colors.primarySoft,
  },
  permissionLabel: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.foreground,
  },
  permissionState: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.primaryText,
  },
  cta: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingVertical: theme.gap(2),
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: '#fff',
  },
}));
