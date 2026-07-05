import { isProbablyUrl } from '@/lib/url';
import { useSaveImages } from '@/lib/use-save-image';
import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
      style={[
        styles.action,
        disabled && { opacity: 0.4 },
      ]}
    >
      <View style={styles.actionIcon}>
        <SymbolView name={icon} size={24} tintColor={theme.colors.primaryText} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function AddScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const createLinkItem = useMutation(api.items.createLinkItem);
  const createNoteItem = useMutation(api.items.createNoteItem);
  const saveImages = useSaveImages();

  const success = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  };

  const pasteFromClipboard = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const url = await Clipboard.getUrlAsync();
      const text = url ?? (await Clipboard.getStringAsync())?.trim();
      if (!text) {
        Alert.alert('Nothing to paste', 'Copy a link or note first.');
        setSaving(false);
        return;
      }
      if (isProbablyUrl(text)) {
        await createLinkItem({ url: text });
      } else {
        await createNoteItem({ text });
      }
      success();
    } catch {
      Alert.alert('Could not save', 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  const pickImages = async () => {
    if (saving) return;
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

  return (
    <View style={styles.content}>
      <Text style={styles.heading}>Save something</Text>

      <View style={styles.actions}>
        <ActionButton
          icon="doc.on.clipboard"
          label="Paste"
          onPress={pasteFromClipboard}
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
    minWidth: 72,
  },
  actionIcon: {
    padding: theme.gap(1.5),
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
}));
