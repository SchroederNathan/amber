import { AnimatedSwitch } from '@/components/ui/animated-switch';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
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
  useEffect(() => {
    if (editing && space && !prefilled) {
      setName(space.name);
      setDynamic(space.dynamic ?? false);
      setPrefilled(true);
    }
  }, [editing, space, prefilled]);

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
      <Text style={styles.heading}>{editing ? 'Edit space' : 'New space'}</Text>
      <Text style={styles.subheading}>
        Give it a title — Amber will suggest a few of your saves that fit. You
        choose what sticks.
      </Text>

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
          <Text style={styles.dynamicLabel}>Dynamic</Text>
          <Text style={styles.dynamicHint}>
            Amber keeps suggesting things that fit
          </Text>
        </View>
        <AnimatedSwitch value={dynamic} onValueChange={setDynamic} />
      </View>

      <Pressable
        onPress={save}
        disabled={!name.trim() || saving}
        style={({ pressed }) => [
          styles.saveButton,
          (!name.trim() || saving) && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>
            {editing ? 'Save changes' : 'Create space'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.gap(2.5),
    gap: theme.gap(1.5),
  },
  heading: {
    fontFamily: theme.fonts.display,
    fontSize: 24,
    color: theme.colors.foreground,
  },
  subheading: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  nameInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.gap(1.5),
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.foreground,
  },
  dynamicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.gap(1.5),
  },
  dynamicText: {
    flex: 1,
    gap: 2,
  },
  dynamicLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.foreground,
  },
  dynamicHint: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.muted,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingVertical: theme.gap(1.75),
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: '#fff',
  },
}));
