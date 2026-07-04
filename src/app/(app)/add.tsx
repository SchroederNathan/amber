import { useSaveImages } from '@/lib/use-save-image';
import { isProbablyUrl } from '@/lib/url';
import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
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

function BigAction({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.bigAction, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.bigActionIcon}>
        <SymbolView name={icon} size={22} tintColor={theme.colors.primaryText} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.bigActionLabel}>{label}</Text>
        <Text style={styles.bigActionHint}>{hint}</Text>
      </View>
      <SymbolView name="chevron.right" size={13} tintColor={theme.colors.faint} />
    </Pressable>
  );
}

export default function AddScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const [text, setText] = useState('');
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const createLinkItem = useMutation(api.items.createLinkItem);
  const createNoteItem = useMutation(api.items.createNoteItem);
  const saveImages = useSaveImages();

  useEffect(() => {
    Clipboard.hasUrlAsync().then((hasUrl) => {
      if (hasUrl) setClipboardUrl('__pending__');
    });
  }, []);

  const success = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  };

  const saveText = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (isProbablyUrl(trimmed)) {
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

  const pasteFromClipboard = async () => {
    const url = await Clipboard.getUrlAsync();
    if (url) setText(url);
    setClipboardUrl(null);
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

  const canSave = text.trim().length > 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>Save something</Text>

      <View style={styles.inputCard}>
        <TextInput
          style={styles.input}
          placeholder="Paste a link, or jot a note…"
          placeholderTextColor={theme.colors.faint}
          multiline
          value={text}
          onChangeText={setText}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {clipboardUrl ? (
          <Pressable style={styles.pasteChip} onPress={pasteFromClipboard}>
            <SymbolView
              name="doc.on.clipboard"
              size={13}
              tintColor={theme.colors.primaryText}
            />
            <Text style={styles.pasteChipText}>Paste link from clipboard</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={saveText}
        disabled={!canSave || saving}
        style={({ pressed }) => [
          styles.saveButton,
          (!canSave || saving) && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>
            {isProbablyUrl(text) ? 'Save link' : 'Save note'}
          </Text>
        )}
      </Pressable>

      <View style={styles.divider} />

      <BigAction
        icon="photo.on.rectangle"
        label="Photo Library"
        hint="Pick images or screenshots to keep"
        onPress={pickImages}
      />
      <BigAction
        icon="camera"
        label="Camera"
        hint="Capture something right now"
        onPress={() => {
          router.back();
          router.push('/camera');
        }}
      />
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
    marginBottom: theme.gap(0.5),
  },
  inputCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.gap(1.5),
    gap: theme.gap(1),
  },
  input: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.foreground,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  pasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: theme.colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 50,
  },
  pasteChipText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.primaryText,
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
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.gap(0.5),
  },
  bigAction: {
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
  bigActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigActionLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.foreground,
  },
  bigActionHint: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.muted,
  },
}));
