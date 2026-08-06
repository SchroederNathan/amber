import type { FeedItem } from '@/components/item-card';
import { displayHost } from '@/lib/url';
import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Images } from 'react-native-nitro-image';

const WIDGET_ITEM_COUNT = 5;
const THUMB_PREFIX = 'recent-saves-';
const THUMB_MAX_DIM = 512;

// Widget extensions have a hard memory cap (~30 MB), so full-size photos are
// downsized to widget-friendly JPEGs before they enter the shared container.
async function ensureThumbnail(dir: Directory, item: FeedItem): Promise<string | undefined> {
  const url = item.imageUrl ?? item.heroImageUrl;
  if (!url) return undefined;
  const thumb = new File(dir, `${THUMB_PREFIX}${item._id}.jpg`);
  if (thumb.exists) return thumb.uri;

  const download = new File(Paths.cache, `widget-download-${item._id}`);
  try {
    if (download.exists) download.delete();
    await File.downloadFileAsync(url, download);
    const image = await Images.loadFromFileAsync(toPlainPath(download.uri));
    const scale = Math.min(1, THUMB_MAX_DIM / Math.max(image.width, image.height));
    const resized =
      scale < 1
        ? await image.resizeAsync(Math.round(image.width * scale), Math.round(image.height * scale))
        : image;
    await resized.saveToFileAsync(toPlainPath(thumb.uri), 'jpg', 80);
    return thumb.uri;
  } finally {
    if (download.exists) download.delete();
  }
}

function toPlainPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

function widgetTitle(item: FeedItem): string {
  if (item.title) return item.title;
  if (item.type === 'note' && item.note) return item.note.split('\n')[0].slice(0, 80);
  if (item.type === 'link') return displayHost(item.url) || 'Link';
  return 'Saved item';
}

function widgetSubtitle(item: FeedItem): string {
  if (item.type === 'link') return item.siteName ?? displayHost(item.url) ?? 'Link';
  if (item.type === 'note') return 'Note';
  return 'Photo';
}

async function syncWidget(items: FeedItem[]) {
  // Loaded lazily so a dev client built before expo-widgets was added doesn't
  // crash at startup on the missing native module.
  const { widgetsDirectory } = await import('expo-widgets');
  const { default: RecentSavesWidget } = await import('@/widgets/recent-saves-widget');

  const dir = new Directory(widgetsDirectory);
  if (!dir.exists) dir.create({ intermediates: true });

  const widgetItems = await Promise.all(
    items.map(async (item) => {
      let imageUri: string | undefined;
      try {
        imageUri = await ensureThumbnail(dir, item);
      } catch (error) {
        // A failed thumbnail falls back to the text tile; never block the sync.
        console.warn(`Widget thumbnail failed for ${item._id}`, error);
      }
      return {
        id: item._id as string,
        title: widgetTitle(item),
        subtitle: widgetSubtitle(item),
        kind: item.type,
        imageUri,
      };
    }),
  );

  // Drop thumbnails for items that left the widget so the shared container
  // doesn't grow forever.
  const keep = new Set(items.map((item) => `${THUMB_PREFIX}${item._id}.jpg`));
  for (const entry of dir.list()) {
    if (entry instanceof File && entry.name.startsWith(THUMB_PREFIX) && !keep.has(entry.name)) {
      try {
        entry.delete();
      } catch {
        // Best effort; a stale thumbnail is harmless.
      }
    }
  }

  RecentSavesWidget.updateSnapshot({ items: widgetItems });
}

// Serialize syncs so a fast series of Convex pushes can't interleave file work.
let syncChain: Promise<void> = Promise.resolve();

/**
 * Keeps the "Recent Saves" home screen widget fed with the latest ready items.
 * Renders nothing; mount once inside the signed-in tree so it shares the
 * feed's listItems subscription.
 */
export function RecentSavesWidgetSync() {
  const { data: items } = useQuery(convexQuery(api.items.listItems, {}));
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' || items === undefined) return;
    const recent = items
      .filter((item) => item.status === 'ready')
      .slice(0, WIDGET_ITEM_COUNT);
    // Only re-sync when something the widget shows actually changed.
    const key = recent
      .map((item) => `${item._id}:${item.title ?? ''}:${item.imageUrl ?? item.heroImageUrl ?? ''}`)
      .join('|');
    if (key === lastKey.current) return;
    lastKey.current = key;

    syncChain = syncChain
      .then(() => syncWidget(recent))
      .catch((error) => {
        lastKey.current = null;
        console.warn('Recent Saves widget sync failed', error);
      });
  }, [items]);

  return null;
}
