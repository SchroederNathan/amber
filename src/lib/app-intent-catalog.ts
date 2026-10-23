import { ensureThumbnail } from '@/lib/thumbnails';
import { appIntentContent } from '@/lib/app-intent-content';
import { appIntentsSetup as setup } from '@/lib/app-intent-native';
import { displayHost } from '@/lib/url';
import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import type { FunctionReturnType } from 'convex/server';
import * as AppIntents from 'expo-app-intents';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect } from 'react';

const ITEM_KIND = 'item';
const SPACE_KIND = 'space';
// Catalogs live in UserDefaults, so they carry the newest saves only.
const ITEM_CATALOG_LIMIT = 300;
const THUMB_LIMIT = 60;
const THUMB_MAX_DIM = 256;
const NOTE_TEXT_LIMIT = 600;

type ListedItem = FunctionReturnType<typeof api.items.listItems>[number];
type ListedSpace = FunctionReturnType<typeof api.spaces.listSpaces>[number];

function thumbDirectory() {
  return new Directory(Paths.document, 'app-intent-thumbs');
}

function contentDirectory() {
  return new Directory(Paths.document, 'app-intent-content');
}

/** Keep full article/note bodies on disk rather than in the UserDefaults entity catalog. */
function writeContent(items: ListedItem[], isCurrent: () => boolean): boolean {
  const dir = contentDirectory();
  if (!dir.exists) dir.create({ intermediates: true });
  const wanted = new Set<string>();
  for (const item of items) {
    if (!isCurrent()) return false;
    const content = appIntentContent(item);
    if (!content) continue;
    const name = `${item._id}.txt`;
    wanted.add(name);
    const file = new File(dir, name);
    if (file.exists && file.textSync() === content) continue;
    if (!file.exists) file.create();
    file.write(content);
  }
  for (const entry of dir.list()) {
    if (entry instanceof File && !wanted.has(entry.name)) entry.delete();
  }
  return true;
}

function itemTitle(item: ListedItem): string {
  const title = item.title?.trim();
  if (title) return title;
  if (item.type === 'note') return item.note?.trim().split('\n')[0].slice(0, 80) || 'Untitled note';
  if (item.type === 'link') return displayHost(item.url) || 'Link';
  return 'Saved photo';
}

function itemRecord(item: ListedItem): AppIntents.AppIntentEntity {
  const metadata: Record<string, string> = {
    kind: item.type,
    savedAt: String(Math.round(item._creationTime)),
  };
  if (item.url) metadata.url = item.url;
  if (item.siteName) metadata.site = item.siteName;
  if (item.note) metadata.text = item.note.slice(0, NOTE_TEXT_LIMIT);
  const imageUrl = item.imageUrl ?? item.heroImageUrl;
  if (imageUrl) metadata.imageUrl = imageUrl;
  return {
    id: item._id,
    title: itemTitle(item),
    subtitle: item.description?.trim() || item.siteName || undefined,
    synonyms: [...new Set(item.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12),
    metadata,
  };
}

function spaceRecord(space: ListedSpace): AppIntents.AppIntentEntity {
  return {
    id: space._id,
    title: space.name.trim() || 'Untitled space',
    subtitle: space.description?.trim() || undefined,
  };
}

async function writeThumbnails(items: ListedItem[], isCurrent: () => boolean): Promise<boolean> {
  const dir = thumbDirectory();
  if (!dir.exists) dir.create({ intermediates: true });
  const wanted = new Map<string, string>();
  for (const item of items) {
    const url = item.imageUrl ?? item.heroImageUrl;
    if (url && wanted.size < THUMB_LIMIT) wanted.set(`${item._id}.jpg`, url);
  }

  let created = false;
  for (const [fileName, url] of wanted) {
    if (!isCurrent()) return created;
    if (new File(dir, fileName).exists) continue;
    try {
      await ensureThumbnail(dir, fileName, url, THUMB_MAX_DIM);
      created = true;
    } catch (error) {
      // A missing thumbnail falls back to a symbol; never block the catalog.
      console.warn(`App Intents thumbnail failed for ${fileName}`, error);
    }
  }
  for (const entry of dir.list()) {
    if (entry instanceof File && !wanted.has(entry.name)) {
      try {
        entry.delete();
      } catch {
        // Best effort; a stale thumbnail is harmless.
      }
    }
  }
  return created;
}

// Serialize publishes so a fast series of Convex pushes can't interleave file work.
let publishChain: Promise<void> = Promise.resolve();
let publishGeneration = 0;

function publish(work: (isCurrent: () => boolean) => Promise<void>, required = false) {
  const generation = ++publishGeneration;
  const isCurrent = () => generation === publishGeneration;
  const result = publishChain.then(() => (required || isCurrent() ? work(isCurrent) : undefined));
  publishChain = result.catch(() => {});
  return result;
}

export function clearAppIntentCatalogs() {
  if (!AppIntents.isAvailable()) return Promise.resolve();
  return publish(async () => {
    // Every cleanup runs even if an independent native operation fails.
    const results = await Promise.allSettled([
      AppIntents.setEntityCatalogAsync(ITEM_KIND, []),
      AppIntents.setEntityCatalogAsync(SPACE_KIND, []),
      setup?.clearSpotlight(),
    ]);
    for (const dir of [thumbDirectory(), contentDirectory()]) {
      if (dir.exists) dir.delete();
    }
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
    }
  }, true);
}

/** Publishes the newest saves and all spaces for Siri, Spotlight, and Visual Intelligence. */
export function useAppIntentCatalogSync(enabled: boolean) {
  const { data: items } = useQuery({ ...convexQuery(api.items.listItems, {}), enabled });
  const { data: spaces } = useQuery({ ...convexQuery(api.spaces.listSpaces, {}), enabled });
  useEffect(() => {
    const clear = () => {
      void clearAppIntentCatalogs().catch((error) => console.warn('Could not clear Siri catalogs', error));
    };
    if (!enabled) clear();
    return clear;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || items === undefined || spaces === undefined) return;
    const ready = items.filter((item) => item.status === 'ready').slice(0, ITEM_CATALOG_LIMIT);
    const itemRecords = ready.map(itemRecord);
    const spaceRecords = spaces.map(spaceRecord);
    // Query structural sharing keeps these references stable until data changes. Source-body
    // changes must also republish, even when titles, summaries, and catalog records are equal.
    void publish(async (isCurrent) => {
      if (!writeContent(ready, isCurrent)) return;
      await AppIntents.setEntityCatalogAsync(SPACE_KIND, spaceRecords);
      if (!isCurrent()) return;
      await AppIntents.setEntityCatalogAsync(ITEM_KIND, itemRecords);
      if (!isCurrent()) return;
      // Spotlight first without thumbnails so search works right away, then again once new
      // thumbnails exist.
      // Index failures must not block thumbnails or later catalog writes.
      await setup?.indexItemsInSpotlight().catch((error) => console.warn('Could not index Siri saves', error));
      if (!isCurrent()) return;
      if ((await writeThumbnails(ready, isCurrent)) && isCurrent()) {
        await setup?.indexItemsInSpotlight();
      }
    }).catch((error) => console.warn('App Intents catalog publish failed', error));
    return () => { ++publishGeneration; };
  }, [enabled, items, spaces]);
}

