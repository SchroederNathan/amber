import { BiometricSetting, useBiometricFooter } from '@/components/biometric-setting';
import { SettingsGroup, SettingsRow } from '@/components/settings-list';
import { UpdateSetting, useVersionLabel } from '@/components/update-setting';
import { useAppLock } from '@/lib/app-lock';
import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useClerk, useUser } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, PlatformColor, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { busy } = useAppLock();
  const { theme } = useUnistyles();
  const biometricFooter = useBiometricFooter();
  const versionLabel = useVersionLabel();

  // Both lists are already cached by the Home and Spaces tabs.
  const { data: items } = useQuery(convexQuery(api.items.listItems, {}));
  const { data: spaces } = useQuery(convexQuery(api.spaces.listSpaces, {}));
  const tagCount = items ? new Set(items.flatMap((item) => item.tags)).size : undefined;

  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName || email || 'Signed in';

  const confirmSignOut = () => {
    Alert.alert('Sign out of Amber?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('Could not sign out', 'Check your connection and try again.');
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="xmark"
          tintColor={PlatformColor('label')}
          onPress={() => router.back()}
        >
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            {user?.hasImage ? (
              <Image source={user.imageUrl} style={styles.avatarImage} transition={150} />
            ) : (
              <SymbolView name="person.fill" size={44} tintColor={theme.colors.primaryText} />
            )}
          </View>
          <Text selectable numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          {email && email !== name && (
            <Text selectable numberOfLines={1} style={styles.email}>
              {email}
            </Text>
          )}
        </View>

        <View style={styles.stats}>
          <Stat value={items?.length} label="Saves" />
          <Stat value={spaces?.length} label="Spaces" />
          <Stat value={tagCount} label="Tags" />
        </View>

        <SettingsGroup title="Privacy" footer={biometricFooter}>
          <BiometricSetting />
        </SettingsGroup>

        <SettingsGroup title="App" footer={versionLabel}>
          <UpdateSetting />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            icon="rectangle.portrait.and.arrow.right"
            label="Sign out"
            destructive
            disabled={busy}
            onPress={confirmSignOut}
          />
        </SettingsGroup>
      </ScrollView>
    </>
  );
}

function Stat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? '–'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.huge,
    gap: theme.spacing.xxl,
  },
  header: { alignItems: 'center', gap: theme.spacing.xs },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  avatarImage: { width: '100%', height: '100%' },
  name: { ...theme.type.title, color: theme.colors.foreground },
  email: { ...theme.type.subhead, color: theme.colors.muted },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: theme.spacing.xs, minWidth: 80 },
  statValue: {
    ...theme.type.header,
    color: theme.colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...theme.type.subhead, color: theme.colors.muted },
}));
