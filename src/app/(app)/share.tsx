import { type LocalImage, useSaveImages } from '@/lib/use-save-image';
import { isProbablyUrl } from '@/lib/url';
import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * Landing screen for content shared into Amber from another app (Safari, Photos,
 * etc.). It resolves the incoming payload, saves each piece to the account with
 * the same mutations the in-app "Add" flow uses, then drops the user on Home.
 */
export default function ShareScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { resolvedSharedPayloads, isResolving, error, clearSharedPayloads } =
    useIncomingShare();
  const createLinkItem = useMutation(api.items.createLinkItem);
  const createNoteItem = useMutation(api.items.createNoteItem);
  const saveImages = useSaveImages();
  // The hook re-renders as payloads resolve; guard so we only save once.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || isResolving || error) return;
    if (resolvedSharedPayloads.length === 0) return;
    handled.current = true;

    (async () => {
      try {
        const images: LocalImage[] = [];
        for (const payload of resolvedSharedPayloads) {
          if (payload.contentType === 'image' && payload.contentUri) {
            images.push({
              uri: payload.contentUri,
              mimeType: payload.contentMimeType ?? undefined,
            });
          } else if (payload.contentType === 'website') {
            // `value` is the shared URL; `contentUri` is the resolved redirect target.
            await createLinkItem({ url: payload.value });
          } else {
            // Plain text: could be a pasted URL or a note.
            const value = payload.value.trim();
            if (!value) continue;
            if (isProbablyUrl(value)) await createLinkItem({ url: value });
            else await createNoteItem({ text: value });
          }
        }
        if (images.length > 0) await saveImages(images);
      } catch (err) {
        console.error('Saving shared content failed:', err);
      } finally {
        clearSharedPayloads();
        router.replace('/');
      }
    })();
  }, [
    resolvedSharedPayloads,
    isResolving,
    error,
    createLinkItem,
    createNoteItem,
    saveImages,
    clearSharedPayloads,
    router,
  ]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={styles.label}>Saving to Amber…</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(1.5),
    backgroundColor: theme.colors.background,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.muted,
  },
}));
