import { AnimatedText } from '@/components/animated-text';
import { parseExifDate } from '@/lib/date';
import { isProbablyUrl } from '@/lib/url';
import { useSaveImages } from '@/lib/use-save-image';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from '@/components/ui/symbol';
import type { SFSymbol } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View, type TextInputInstance } from 'react-native';
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
      style={({ pressed }) => [
        styles.action,
        pressed && { opacity: theme.opacity.pressedSurface },
        disabled && { opacity: theme.opacity.disabled },
      ]}
    >
      <View style={styles.actionIcon}>
        <SymbolView name={icon} size={40} tintColor={theme.colors.foreground} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function HeaderIconButton({
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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      onPress={onPress}
      disabled={disabled}
      style={styles.headerButton}
    >
      <SymbolView
        name={icon}
        size={24}
        tintColor={disabled ? theme.colors.muted : theme.colors.tint}
      />
    </Pressable>
  );
}

export default function AddScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  // Opened from inside a space: everything saved here is pre-pinned to it.
  const { spaceId } = useLocalSearchParams<{ spaceId?: string }>();
  const pinnedSpaceId = spaceId as Id<'spaces'> | undefined;
  const [mode, setMode] = useState<Mode>('menu');
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState('');

  const createLinkItem = useMutation(api.items.createLinkItem);
  const createNoteItem = useMutation(api.items.createNoteItem);
  const saveImages = useSaveImages();

  const inputRef = useRef<TextInputInstance>(null);
  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && !saving;

  // Prefill the article field with a link already on the clipboard.
  useEffect(() => {
    if (mode !== 'article') return;
    let active = true;
    // getUrlAsync is iOS-only; Android reads the text and keeps it if it is a link.
    const clipboardUrl =
      process.env.EXPO_OS === 'ios'
        ? Clipboard.getUrlAsync()
        : Clipboard.getStringAsync().then((text) => (isProbablyUrl(text) ? text.trim() : null));
    clipboardUrl
      .then((url) => {
        if (active && url) setValue((current) => current || url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mode]);

  // Android resizes the sheet to the composer over ~300ms and drops a keyboard
  // opened mid-resize behind it, so focus once the sheet has settled.
  useEffect(() => {
    if (process.env.EXPO_OS === 'ios' || mode === 'menu') return;
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
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
        await createLinkItem({ url: trimmed, spaceId: pinnedSpaceId });
      } else {
        await createNoteItem({ text: trimmed, spaceId: pinnedSpaceId });
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
      exif: true,
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
          capturedAt: parseExifDate(asset.exif),
        })),
        { spaceId: pinnedSpaceId },
      );
      success();
    } catch (err) {
      console.error('Image upload failed:', err);
      Alert.alert('Could not save', 'Uploading those images failed. Try again.');
      setSaving(false);
    }
  };

  const isComposer = mode === 'note' || mode === 'article';
  const isArticle = mode === 'article';
  const title = isArticle ? 'Save an article' : mode === 'note' ? 'New note' : 'Save something';

  // Animated title persists across mode changes so the text cascades
  // between "Save something" / "New note" / "Save an article".
  const heading = <AnimatedText text={title} style={styles.heading} />;

  return (
    <View style={styles.content}>
      {process.env.EXPO_OS === 'ios' ? (
        <>
          <Stack.Screen
            options={{
              headerShown: true,
              headerTransparent: false,
              headerStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Title asChild>{heading}</Stack.Title>
          {isComposer && (
            <>
              <Stack.Toolbar placement="left">
                <Stack.Toolbar.Button
                  icon="chevron.left"
                  tintColor={theme.colors.tint}
                  onPress={() => setMode('menu')}
                >
                  Back
                </Stack.Toolbar.Button>
              </Stack.Toolbar>
              <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                  icon="checkmark"
                  tintColor={canSave ? theme.colors.tint : theme.colors.muted}
                  onPress={save}
                >
                  Save
                </Stack.Toolbar.Button>
              </Stack.Toolbar>
            </>
          )}
        </>
      ) : (
        // Android form sheets have no native header, so the title and the
        // composer's back/save controls sit at the top of the sheet instead.
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderSide}>
            {isComposer && (
              <HeaderIconButton icon="chevron.left" label="Back" onPress={() => setMode('menu')} />
            )}
          </View>
          {heading}
          <View style={[styles.sheetHeaderSide, styles.sheetHeaderEnd]}>
            {isComposer && (
              <HeaderIconButton icon="checkmark" label="Save" disabled={!canSave} onPress={save} />
            )}
          </View>
        </View>
      )}

      {isComposer ? (
        <TextInput
          ref={inputRef}
          style={isArticle ? styles.articleInput : styles.noteInput}
          value={value}
          onChangeText={setValue}
          placeholder={isArticle ? 'Paste or type a link…' : 'Jot a note…'}
          placeholderTextColor={theme.colors.muted}
          autoFocus={process.env.EXPO_OS === 'ios'}
          multiline={!isArticle}
          autoCapitalize={isArticle ? 'none' : 'sentences'}
          autoCorrect={!isArticle}
          keyboardType={isArticle ? 'url' : 'default'}
          returnKeyType={isArticle ? 'done' : 'default'}
          onSubmitEditing={isArticle ? save : undefined}
          editable={!saving}
        />
      ) : (
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
              router.push({
                pathname: '/camera',
                params: pinnedSpaceId ? { spaceId: pinnedSpaceId } : {},
              });
            }}
            disabled={saving}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  content: {
    padding: theme.gap(2.5),
    paddingTop: theme.gap(2),
    // Android sheets draw edge-to-edge behind the navigation bar.
    paddingBottom: theme.gap(2.5) + (process.env.EXPO_OS === 'android' ? rt.insets.bottom : 0),
    gap: theme.gap(1.5),
  },
  heading: theme.type.sheetTitle,
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetHeaderSide: {
    width: 48,
  },
  sheetHeaderEnd: {
    alignItems: 'flex-end',
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
    ...theme.type.captionLabel,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  noteInput: {
    ...theme.type.reader,
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
    ...theme.type.reader,
    color: theme.colors.foreground,
    padding: theme.gap(1.5),
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
}));
