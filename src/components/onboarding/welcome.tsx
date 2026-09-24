import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '@/components/ui/button';

export function Welcome({ pending = false, error, onApple, onGoogle, onDevLogin }: {
  pending?: boolean;
  error?: string | null;
  onApple?: () => void;
  onGoogle?: () => void;
  onDevLogin?: () => void;
}) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [provider, setProvider] = useState<'apple' | 'google' | null>(null);
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
          <Button
            // Android signs in through Apple's web flow, where "iCloud" means nothing.
            title={process.env.EXPO_OS === 'ios' ? 'Continue with iCloud' : 'Continue with Apple'}
            size="lg"
            testID="apple-login-button"
            disabled={pending}
            loading={pending && provider === 'apple'}
            onPress={() => { setProvider('apple'); onApple?.(); }}
            icon={<Image source={require('../../../assets/brand/apple.svg')} style={styles.providerIcon} tintColor={theme.colors.onPrimary} contentFit="contain" accessible={false} />}
          />
          <Button
            title="Continue with Google"
            testID="google-login-button"
            size="lg"
            variant="secondary"
            disabled={pending}
            loading={pending && provider === 'google'}
            onPress={() => { setProvider('google'); onGoogle?.(); }}
            icon={<Image source={require('../../../assets/brand/google-g.png')} style={styles.providerIcon} contentFit="contain" accessible={false} />}
          />
          {error && <Text accessibilityRole="alert" selectable style={styles.error}>{error}</Text>}
          {__DEV__ && (
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
