import { ThemedText } from '@/components/ui/themed-text';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// One form, two jobs: `/new-space` creates, `/new-space?id=…` edits.
export default function NewSpaceScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id !== undefined;

  const createSpace = useMutation(api.spaces.createSpace);
  const updateSpace = useMutation(api.spaces.updateSpace);
  const { data: space } = useQuery({
    ...convexQuery(api.spaces.getSpace, { id: (id ?? '') as Id<'spaces'> }),
    enabled: editing,
  });

  const [name, setName] = useState('');
  // Dynamic is the marquee behavior — on by default; off is one tap away.
  const [dynamic, setDynamic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Prefill once the space arrives (cached, so usually instant).
  const [prefilled, setPrefilled] = useState(false);
  if (editing && space && !prefilled) {
    setName(space.name);
    setDynamic(space.dynamic ?? false);
    setPrefilled(true);
  }

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await updateSpace({ id: id as Id<'spaces'>, name: trimmed, dynamic });
      } else {
        await createSpace({ name: trimmed, dynamic });
      }
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch {
      Alert.alert(
        editing ? 'Could not save space' : 'Could not create space',
        'Something went wrong. Try again.',
      );
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <ThemedText variant="sheetTitle" style={styles.heading}>{editing ? 'Edit space' : 'New space'}</ThemedText>
      <ThemedText variant="footnote" style={styles.subheading}>
        Give it a title — Amber will suggest a few of your saves that fit. You
        choose what sticks.
      </ThemedText>

      <TextInput
        style={styles.nameInput}
        placeholder="Apartment shopping list"
        placeholderTextColor={theme.colors.faint}
        value={name}
        onChangeText={setName}
        autoFocus={!editing}
      />

      <View style={styles.dynamicRow}>
        <View style={styles.dynamicText}>
          <ThemedText variant="subheadStrong" style={styles.dynamicLabel}>Dynamic</ThemedText>
          <ThemedText variant="caption" style={styles.dynamicHint}>
            Amber keeps suggesting things that fit
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="Dynamic suggestions"
          value={dynamic}
          onValueChange={setDynamic}
          trackColor={{ true: theme.colors.toggle }}
          // Android otherwise paints the thumb in the system accent.
          thumbColor={process.env.EXPO_OS === 'android' ? theme.colors.toggleThumb : undefined}
        />
      </View>

      <Button
        title={editing ? 'Save changes' : 'Create space'}
        onPress={save}
        disabled={!name.trim()}
        loading={saving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  content: {
    padding: theme.spacing.xl,
    // Android sheets draw edge-to-edge behind the navigation bar.
    paddingBottom: theme.spacing.xl + (process.env.EXPO_OS === 'android' ? rt.insets.bottom : 0),
    gap: theme.spacing.md,
  },
  heading: {
    color: theme.colors.foreground,
  },
  subheading: {
    lineHeight: 20,
    color: theme.colors.muted,
  },
  nameInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    ...theme.type.headline,
    color: theme.colors.foreground,
  },
  dynamicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  dynamicText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  dynamicLabel: {
    color: theme.colors.foreground,
  },
  dynamicHint: {
    lineHeight: 18,
    color: theme.colors.muted,
  },
}));
