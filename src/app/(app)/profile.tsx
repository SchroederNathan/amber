import { Wordmark } from '@/components/wordmark';
import { useClerk, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
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

      <Pressable
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
        onPress={async () => {
          router.back();
          await signOut();
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
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
    fontFamily: theme.fonts.regular,
    fontSize: 14,
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
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.foreground,
  },
  signOut: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: theme.gap(1.5),
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  signOutText: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.danger,
  },
}));
