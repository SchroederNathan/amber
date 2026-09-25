import { useAppLock } from '@/lib/app-lock';
import { isProbablyUrl } from '@/lib/url';
import { type LocalImage, useSaveImages } from '@/lib/use-save-image';
import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import {
  clearSharedPayloads,
  getResolvedSharedPayloadsAsync,
  getSharedPayloads,
  type ResolvedSharePayload,
  type SharePayload,
} from 'expo-sharing';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

// Content shared into Amber waits in the share extension's storage until it
// is saved. The save runs here, in the signed-in layout, not in the `/share`
// screen: the share link arrives before iOS reports Amber as active, and the
// biometric lock then tears down every screen and closes the Convex client.
// A save started in that tree never settles. So the save starts only in the
// foreground, and the payload stays until it succeeds, which lets an
// interrupted save run again after unlock.

let state = { saving: false, requests: 0 };
const listeners = new Set<() => void>();

function update(patch: Partial<typeof state>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function useIntakeState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}

/** True while shared content is being saved. */
export function useShareIntakeSaving() {
  return useIntakeState().saving;
}

/** Asks the intake to look for pending shared content. */
export function requestShareIntake() {
  update({ requests: state.requests + 1 });
}

/** The share extension's pending payloads, or none if it can't be read. */
export function pendingSharedPayloads(): SharePayload[] {
  try {
    return getSharedPayloads();
  } catch {
    return [];
  }
}

// Android hands over `content://` URIs; resolving copies them to local files.
// Resolution also fetches shared URLs, so if it fails, the raw payloads (a URL
// or a file path) are still enough for everything except Android files.
async function resolvePayloads(
  payloads: SharePayload[],
): Promise<(SharePayload | ResolvedSharePayload)[]> {
  if (payloads.every((p) => p.shareType === 'text' || p.shareType === 'url')) {
    return payloads;
  }
  try {
    return await getResolvedSharedPayloadsAsync();
  } catch (err) {
    console.warn('Resolving shared content failed:', err);
    return payloads;
  }
}

/**
 * Saves content shared into Amber from another app. Renders nothing; mount
 * once inside the signed-in, unlocked tree.
 */
export function ShareIntake() {
  const { foreground } = useAppLock();
  const { requests } = useIntakeState();
  const createLinkItem = useMutation(api.items.createLinkItem);
  const createNoteItem = useMutation(api.items.createNoteItem);
  const saveImages = useSaveImages();
  const attempt = useRef<{ abandoned: boolean } | null>(null);

  // Unmounting (lock, sign-out) abandons the save in flight. Its Convex calls
  // may never settle, so it must not clear the payload or report anything.
  useEffect(
    () => () => {
      if (attempt.current) attempt.current.abandoned = true;
      attempt.current = null;
      update({ saving: false });
    },
    [],
  );

  useEffect(() => {
    if (!foreground || attempt.current) return;
    const payloads = pendingSharedPayloads();
    if (payloads.length === 0) return;
    const current = { abandoned: false };
    attempt.current = current;
    update({ saving: true });

    (async () => {
      try {
        const resolved = await resolvePayloads(payloads);
        const images: LocalImage[] = [];
        for (const payload of resolved) {
          if (current.abandoned) return;
          if (payload.shareType === 'url') {
            await createLinkItem({ url: payload.value });
          } else if (payload.shareType === 'text') {
            // Plain text: could be a pasted URL or a note.
            const value = payload.value.trim();
            if (!value) continue;
            if (isProbablyUrl(value)) await createLinkItem({ url: value });
            else await createNoteItem({ text: value });
          } else if (payload.shareType === 'image') {
            const resolvedImage = 'contentUri' in payload ? payload : null;
            images.push({
              uri: resolvedImage?.contentUri ?? payload.value,
              mimeType: resolvedImage?.contentMimeType ?? payload.mimeType,
            });
          }
        }
        if (images.length > 0 && !current.abandoned) await saveImages(images);
        if (!current.abandoned) clearSharedPayloads();
      } catch (err) {
        if (current.abandoned) return;
        console.error('Saving shared content failed:', err);
        // Drop it, or every return to the foreground would fail again.
        clearSharedPayloads();
        Alert.alert(
          'Could not save',
          'Saving the shared content to Amber failed. Try sharing it again.',
        );
      } finally {
        if (!current.abandoned) {
          attempt.current = null;
          update({ saving: false });
        }
      }
    })();
  }, [foreground, requests, createLinkItem, createNoteItem, saveImages]);

  return null;
}
