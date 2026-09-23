import { BiometricSetting } from '@/components/biometric-setting';
import { Button } from '@/components/ui/button';
import { useAppLock } from '@/lib/app-lock';
import { Wordmark } from '@/components/wordmark';
import { useClerk, useUser } from '@clerk/expo';
import { SymbolView } from 'expo-symbols';
import { Alert, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { busy } = useAppLock();
  const { theme } = useUnistyles();

  return (
    <View style={styles.content}>
      <Wordmark size={30} />
      <Text style={styles.slogan}>Save it for later.</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <SymbolView name="person.fill" size={20} tintColor={theme.colors.primaryText} />
        </View>
        <Text selectable style={styles.email} numberOfLines={1}>
          {user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}
        </Text>
      </View>

      <BiometricSetting />

      <Button
        title="Sign out"
        variant="destructive"
        disabled={busy}
        style={styles.signOut}
        onPress={async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('Could not sign out', 'Check your connection and try again.');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.gap(3),
    paddingTop: theme.gap(4),
    gap: theme.gap(1.5),
    alignItems: 'center',
  },
  slogan: {
    ...theme.type.footnote,
    color: theme.colors.muted,
    marginBottom: theme.gap(1),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.gap(1.5),
    alignSelf: 'stretch',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: {
    flex: 1,
    ...theme.type.subheadLabel,
    color: theme.colors.foreground,
  },
  signOut: { alignSelf: 'stretch' },
}));
