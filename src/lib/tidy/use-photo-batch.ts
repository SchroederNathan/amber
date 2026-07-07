import { AssetField, MediaType, Query, type Album, type AssetMetadata } from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isReviewed } from './storage';

export const BATCH_SIZE = 24;

/** Photos read per media-store query while filling a batch. */
const PAGE_SIZE = 48;

export type TidyPhoto = {
  /** `ph://…` on iOS, `content://…` on Android — renderable by expo-image and
   * usable to re-instantiate a `MediaLibrary.Asset`. */
  id: string;
  width: number | null;
  height: number | null;
  creationTime: number | null;
};

const toTidyPhoto = (asset: AssetMetadata): TidyPhoto => ({
  id: asset.id,
  width: asset.width,
  height: asset.height,
  creationTime: asset.creationTime,
});

type Params = {
  /** Restrict to this album, or null for the whole library. */
  album: Album | null;
  /** Reload whenever the picked source changes. */
  sourceId: string;
  enabled: boolean;
};

/**
 * Pages a photo source (newest first) and yields fixed batches of unreviewed
 * photos. The deck array is REVERSED — newest photo at the highest index —
 * because the card stack renders the top card last and counts its index down.
 * Switching source resets paging and loads a fresh batch.
 */
export function usePhotoBatch({ album, sourceId, enabled }: Params) {
  const [batch, setBatch] = useState<TidyPhoto[] | null>(null);
  const [batchId, setBatchId] = useState(0);
  // Which source `batch` reflects. A mismatch with the active sourceId means
  // a reload is in flight — the screen derives its loading state from this
  // rather than a synchronous setState in the effect below.
  const [loadedSourceId, setLoadedSourceId] = useState<string | null>(null);
  // How many assets we've paged past in the media store. Deletions shrink the
  // store under us, so completed batches subtract what they removed.
  const offsetRef = useRef(0);
  const exhaustedRef = useRef(false);

  // Pages the media store until BATCH_SIZE unreviewed photos are collected or
  // the source is exhausted. Kept separate so the caller's setState is always
  // after this `await` — no synchronous render cascade when run from an effect.
  const collectBatch = useCallback(async (): Promise<TidyPhoto[]> => {
    const collected: TidyPhoto[] = [];
    while (collected.length < BATCH_SIZE && !exhaustedRef.current) {
      let query = new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .offset(offsetRef.current)
        .limit(PAGE_SIZE);
      if (album) {
        query = query.album(album);
      }
      const page = await query.exeForMetadata();

      offsetRef.current += page.length;
      if (page.length < PAGE_SIZE) {
        exhaustedRef.current = true;
      }
      for (const asset of page) {
        if (!isReviewed(asset.id)) {
          collected.push(toTidyPhoto(asset));
          if (collected.length === BATCH_SIZE) break;
        }
      }
    }
    return collected.reverse();
  }, [album]);

  const loadNextBatch = useCallback(
    async (options?: { reset?: boolean }) => {
      if (options?.reset) {
        offsetRef.current = 0;
        exhaustedRef.current = false;
      }
      const collected = await collectBatch();
      setBatch(collected);
      setBatchId((id) => id + 1);
      setLoadedSourceId(sourceId);
    },
    [collectBatch, sourceId],
  );

  // Reload whenever the source changes (or on first grant). Refs are reset
  // synchronously (they don't render); the batch itself is replaced only once
  // the async load resolves. `loading` is derived from the source mismatch.
  // loadNextBatch's identity changes exactly when album/sourceId change, so
  // depending on it reloads on every source switch (and on first grant).
  useEffect(() => {
    if (!enabled) return;
    offsetRef.current = 0;
    exhaustedRef.current = false;
    // loadNextBatch only setState()s after awaiting the media-store query, so
    // there is no synchronous render cascade; the linter can't trace past the
    // await, hence the disable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNextBatch();
  }, [enabled, loadNextBatch]);

  /** Deleting shifts everything after the deleted assets back by one, so the
   * next page query must not skip past unseen photos. */
  const noteDeleted = useCallback((count: number) => {
    offsetRef.current = Math.max(0, offsetRef.current - count);
  }, []);

  const loading = loadedSourceId !== sourceId;

  return { batch, batchId, loading, loadNextBatch, noteDeleted };
}
