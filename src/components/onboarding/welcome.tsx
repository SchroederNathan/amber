import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '@/components/ui/button';
import { SymbolView } from '@/components/ui/symbol';

export function Welcome({ pending = false, error, biometricLabel, onBiometric, onApple, onGoogle, onDevLogin }: {
  pending?: boolean;
  error?: string | null;
  // Set when this device has a biometric credential for a returning user.
  biometricLabel?: string | null;
  onBiometric?: () => void;
  onApple?: () => void;
  onGoogle?: () => void;
  onDevLogin?: () => void;
}) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [provider, setProvider] = useState<'biometric' | 'apple' | 'google' | null>(null);
  // A returning user's quickest way back in leads; Apple steps down to match Google.
  const appleVariant = biometricLabel ? 'secondary' : 'primary';
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, {
        minHeight: height,
        paddingTop: insets.top + 12,
        paddingBottom: Math.max(insets.bottom, 20),
      }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.bottom}>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.wordmark} accessibilityLabel="Amber">amber</Text>
          <Text style={styles.body}>Keep what catches your eye.</Text>
        </View>
        <View style={styles.actions}>
          {biometricLabel && (
            <Button
              title={`Sign in with ${biometricLabel}`}
              size="lg"
              testID="biometric-login-button"
              disabled={pending}
              loading={pending && provider === 'biometric'}
              onPress={() => { setProvider('biometric'); onBiometric?.(); }}
              icon={<SymbolView name={biometricLabel === 'Face ID' ? 'faceid' : 'touchid'} size={22} tintColor={theme.colors.onPrimary} accessible={false} />}
            />
          )}
          <Button
            // Android signs in through Apple's web flow, where "iCloud" means nothing.
            title={process.env.EXPO_OS === 'ios' ? 'Continue with iCloud' : 'Continue with Apple'}
            size="lg"
            variant={appleVariant}
            testID="apple-login-button"
            disabled={pending}
            loading={pending && provider === 'apple'}
            onPress={() => { setProvider('apple'); onApple?.(); }}
            icon={<Image source={require('@assets/images/sign-in/apple.svg')} style={styles.providerIcon} tintColor={appleVariant === 'primary' ? theme.colors.onPrimary : theme.colors.foreground} contentFit="contain" accessible={false} />}
          />
          <Button
            title="Continue with Google"
            testID="google-login-button"
            size="lg"
            variant="secondary"
            disabled={pending}
            loading={pending && provider === 'google'}
            onPress={() => { setProvider('google'); onGoogle?.(); }}
            icon={<Image source={require('@assets/images/sign-in/google-g.png')} style={styles.providerIcon} contentFit="contain" accessible={false} />}
          />
          {error && <Text accessibilityRole="alert" selectable style={styles.error}>{error}</Text>}
          {/* The `e2e` build profile is a Release build, so E2E runs sign in through here too. */}
          {(__DEV__ || process.env.EXPO_PUBLIC_E2E === '1') && (
            <Pressable testID="dev-login-button" accessibilityRole="button" onPress={() => { setProvider(null); onDevLogin?.(); }} disabled={pending} style={styles.dev}>
              <Text style={styles.status}>Dev login</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  wordmark: { fontFamily: theme.fonts.display, fontSize: 50, color: theme.colors.foreground, width: '100%', maxWidth: 460, textAlign: 'left' },
  bottom: { flexGrow: 1, justifyContent: 'flex-end', gap: 26, width: '100%', maxWidth: 460 },
  copy: { gap: 12 },
  body: { ...theme.type.body, lineHeight: 23, color: theme.colors.muted },
  actions: { gap: 12 },
  providerIcon: { width: 24, height: 24 },
  status: { ...theme.type.caption, textAlign: 'center', color: theme.colors.muted },
  error: { ...theme.type.footnote, textAlign: 'center', color: theme.colors.danger },
  dev: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
}));
