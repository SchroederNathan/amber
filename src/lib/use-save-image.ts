import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { useCallback } from 'react';

export type LocalImage = {
  uri: string;
  width?: number;
  height?: number;
  mimeType?: string;
  /** Marks a subject-lifted die-cut PNG so the feed renders it as a sticker. */
  isSticker?: boolean;
  /** Original camera-roll capture time (epoch ms), read from EXIF on import. */
  capturedAt?: number;
};

/**
 * Uploads local image files to Convex storage and creates items for them.
 * Returns a function that resolves with the created item ids once every
 * image has been handed off — AI tagging continues server-side afterwards.
 */
export function useSaveImages() {
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);
  const createImageItem = useMutation(api.items.createImageItem);

  return useCallback(
    async (images: LocalImage[]): Promise<Id<'items'>[]> => {
      return await Promise.all(
        images.map(async (image) => {
          const uploadUrl = await generateUploadUrl();
          const file = new File(image.uri);
          const result = await expoFetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': image.mimeType ?? 'image/jpeg' },
            body: file,
          });
          if (!result.ok) {
            throw new Error(`Upload failed (${result.status})`);
          }
          const { storageId } = await result.json();
          const aspectRatio =
            image.width && image.height ? image.width / image.height : undefined;
          return await createImageItem({
            storageId,
            aspectRatio,
            isSticker: image.isSticker,
            capturedAt: image.capturedAt,
          });
        }),
      );
    },
    [generateUploadUrl, createImageItem],
  );
}
