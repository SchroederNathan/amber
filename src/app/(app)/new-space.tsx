import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function NewSpaceScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const createSpace = useMutation(api.spaces.createSpace);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await createSpace({
        name: trimmed,
        description: description.trim() || undefined,
      });
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch {
      Alert.alert('Could not create space', 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>New space</Text>
      <Text style={styles.subheading}>
        Give it a clear name and a hint of what belongs — Amber files future saves
        here for you.
      </Text>

      <TextInput
        style={styles.nameInput}
        placeholder="Design inspiration"
        placeholderTextColor={theme.colors.faint}
        value={name}
        onChangeText={setName}
        autoFocus
      />
      <TextInput
        style={styles.descriptionInput}
        placeholder="What belongs here? e.g. interfaces, typography, moodboards"
        placeholderTextColor={theme.colors.faint}
        value={description}
        onChangeText={setDescription}
        multiline
      />

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
          <Text style={styles.saveButtonText}>Create space</Text>
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
  descriptionInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.gap(1.5),
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.foreground,
    minHeight: 72,
    textAlignVertical: 'top',
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
