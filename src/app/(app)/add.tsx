import { useSaveImages } from '@/lib/use-save-image';
import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Mode = 'menu' | 'note' | 'article';

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, disabled && { opacity: 0.4 }]}
    >
      <View style={styles.actionIcon}>
        <SymbolView name={icon} size={40} tintColor={theme.colors.foreground} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function AddScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const [mode, setMode] = useState<Mode>('menu');
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState('');

  const createLinkItem = useMutation(api.items.createLinkItem);
  const createNoteItem = useMutation(api.items.createNoteItem);
  const saveImages = useSaveImages();

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && !saving;

  // Prefill the article field with a link already on the clipboard.
  useEffect(() => {
    if (mode !== 'article') return;
    let active = true;
    Clipboard.getUrlAsync().then((url) => {
      if (active && url) setValue((current) => current || url);
    });
    return () => {
      active = false;
    };
  }, [mode]);

  const success = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  };

  const openComposer = (next: Mode) => {
    setValue('');
    setMode(next);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (mode === 'article') {
        await createLinkItem({ url: trimmed });
      } else {
        await createNoteItem({ text: trimmed });
      }
      success();
    } catch {
      Alert.alert('Could not save', 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setSaving(true);
    try {
      await saveImages(
        result.assets.map((asset) => ({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
        })),
      );
      success();
    } catch (err) {
      console.error('Image upload failed:', err);
      Alert.alert('Could not save', 'Uploading those images failed. Try again.');
      setSaving(false);
    }
  };

  if (mode === 'note' || mode === 'article') {
    const isArticle = mode === 'article';
    return (
      <View style={styles.content}>
        <View style={styles.composerHeader}>
          <Pressable onPress={() => setMode('menu')} hitSlop={8} disabled={saving}>
            <SymbolView name="chevron.left" size={22} tintColor={theme.colors.foreground} />
          </Pressable>
          <Text style={styles.heading}>{isArticle ? 'Save an article' : 'New note'}</Text>
          <Pressable
            onPress={save}
            disabled={!canSave}
            style={[styles.saveButton, !canSave && { opacity: 0.4 }]}
          >
            <Text style={styles.saveLabel}>Save</Text>
          </Pressable>
        </View>

        <TextInput
          style={isArticle ? styles.articleInput : styles.noteInput}
          value={value}
          onChangeText={setValue}
          placeholder={isArticle ? 'Paste or type a link…' : 'Jot a note…'}
          placeholderTextColor={theme.colors.muted}
          autoFocus
          multiline={!isArticle}
          autoCapitalize={isArticle ? 'none' : 'sentences'}
          autoCorrect={!isArticle}
          keyboardType={isArticle ? 'url' : 'default'}
          returnKeyType={isArticle ? 'done' : 'default'}
          onSubmitEditing={isArticle ? save : undefined}
          editable={!saving}
        />
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <Text style={[styles.heading, styles.menuHeading]}>Save something</Text>

      <View style={styles.actions}>
        <ActionButton
          icon="square.and.pencil"
          label="Note"
          onPress={() => openComposer('note')}
          disabled={saving}
        />
        <ActionButton
          icon="link"
          label="Article"
          onPress={() => openComposer('article')}
          disabled={saving}
        />
        <ActionButton
          icon="photo.on.rectangle"
          label="Photos"
          onPress={pickImages}
          disabled={saving}
        />
        <ActionButton
          icon="camera"
          label="Camera"
          onPress={() => {
            router.back();
            router.push('/camera');
          }}
          disabled={saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.gap(2.5),
    paddingTop: theme.gap(4),
    gap: theme.gap(1.5),
  },
  heading: {
    fontFamily: theme.fonts.display,
    fontSize: 24,
    color: theme.colors.foreground,
  },
  menuHeading: {
    marginBottom: theme.gap(1),
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.gap(2),
  },
  action: {
    alignItems: 'center',
    gap: theme.gap(0.75),
    minWidth: 64,
  },
  actionIcon: {
    padding: theme.gap(1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(1),
  },
  noteInput: {
    fontFamily: theme.fonts.regular,
    fontSize: 18,
    color: theme.colors.foreground,
    minHeight: 120,
    padding: theme.gap(1.5),
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlignVertical: 'top',
  },
  articleInput: {
    fontFamily: theme.fonts.regular,
    fontSize: 18,
    color: theme.colors.foreground,
    padding: theme.gap(1.5),
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  saveButton: {
    paddingHorizontal: theme.gap(2),
    paddingVertical: theme.gap(0.75),
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  saveLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.background,
  },
}));
