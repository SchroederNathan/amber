import { Album } from 'expo-media-library';
import { useEffect, useState } from 'react';

export const ALL_PHOTOS_ID = '__all__';

export type TidySource = {
  /** ALL_PHOTOS_ID for the whole library, otherwise the album id. */
  id: string;
  title: string;
  /** null for the whole library (no album filter). */
  album: Album | null;
};

const ALL_PHOTOS: TidySource = { id: ALL_PHOTOS_ID, title: 'All Photos', album: null };

/**
 * Lists the photo sources the user can tidy: the whole library plus each
 * album on the device. Reviewed-tracking is keyed globally by asset id, so
 * switching sources still hides photos triaged elsewhere.
 */
export function useAlbums(enabled: boolean): TidySource[] {
  const [sources, setSources] = useState<TidySource[]>([ALL_PHOTOS]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const albums = await Album.getAll();
        const named = await Promise.all(
          albums.map(async (album) => ({
            id: album.id,
            title: await album.getTitle(),
            album,
          })),
        );
        if (!cancelled) {
          const sorted = named
            .filter((s) => s.title)
            .sort((a, b) => a.title.localeCompare(b.title));
          setSources([ALL_PHOTOS, ...sorted]);
        }
      } catch (error) {
        console.warn('Tidy: failed to load albums', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return sources;
}
