import { ensureThumbnail } from '@/lib/thumbnails';
import { displayHost } from '@/lib/url';
import { useSaveImages } from '@/lib/use-save-image';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useAction, useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { requireOptionalNativeModule } from 'expo';
import * as AppIntents from 'expo-app-intents';
import { Directory, File, Paths } from 'expo-file-system';
import { useNavigationContainerRef, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { createMMKV } from 'react-native-mmkv';

// Bridge between Amber and the Swift App Intents in `app-intents/` (Siri, Spotlight, Shortcuts,
// Visual Intelligence). Keep the catalog kinds, metadata keys, and invocation names in sync with
// `app-intents/Support/AmberCatalog.swift` and the intents that dispatch them.

const ITEM_KIND = 'item';
const SPACE_KIND = 'space';
// Catalogs live in UserDefaults, so they carry the newest saves only.
const ITEM_CATALOG_LIMIT = 300;
const THUMB_LIMIT = 60;
const THUMB_MAX_DIM = 256;
const NOTE_TEXT_LIMIT = 600;

type SetupModule = {
  setCaptureCredentials(siteUrl: string, token: string): Promise<void>;
  clearCaptureCredentials(): Promise<void>;
  hasCaptureCredentials(): Promise<boolean>;
  /** Mirrors the `item` catalog into Spotlight; resolves with the indexed count. */
  indexItemsInSpotlight(): Promise<number>;
  clearSpotlight(): Promise<void>;
};

// Null on Android, web, and dev clients built before the intents existed.
const setup = requireOptionalNativeModule<SetupModule>('AppIntentsSetup');
const store = createMMKV({ id: 'app-intents' });
const CAPTURE_OWNER_KEY = 'captureOwner';

const siteUrl =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL ??
  process.env.EXPO_PUBLIC_CONVEX_URL?.replace(/\.convex\.cloud$/, '.convex.site');

type ListedItem = FunctionReturnType<typeof api.items.listItems>[number];
type ListedSpace = FunctionReturnType<typeof api.spaces.listSpaces>[number];

function thumbDirectory() {
  return new Directory(Paths.document, 'app-intent-thumbs');
}

function itemTitle(item: ListedItem): string {
  const title = item.title?.trim();
  if (title) return title;
  if (item.type === 'note' && item.note) return item.note.trim().split('\n')[0].slice(0, 80);
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

function publish(work: (isCurrent: () => boolean) => Promise<void>) {
  const generation = ++publishGeneration;
  const isCurrent = () => generation === publishGeneration;
  publishChain = publishChain
    .then(() => (isCurrent() ? work(isCurrent) : undefined))
    .catch((error) => console.warn('App Intents catalog publish failed', error));
  return publishChain;
}

function clearCatalogs() {
  return publish(async () => {
    await AppIntents.setEntityCatalogAsync(ITEM_KIND, []);
    await AppIntents.setEntityCatalogAsync(SPACE_KIND, []);
    await setup?.clearSpotlight();
    const dir = thumbDirectory();
    if (dir.exists) dir.delete();
  });
}

/**
 * Forgets everything Siri knows about the signed-out account: capture credentials, queued
 * invocations, and the item and space catalogs (which also empties Spotlight).
 */
export async function resetAppIntents(): Promise<void> {
  if (!AppIntents.isAvailable()) return;
  store.remove(CAPTURE_OWNER_KEY);
  await Promise.all([
    setup?.clearCaptureCredentials(),
    AppIntents.clearPendingInvocationsAsync(),
    clearCatalogs(),
  ]);
}

/** Publishes the newest saves and all spaces for Siri, Spotlight, and Visual Intelligence. */
function useCatalogSync(enabled: boolean) {
  const { data: items } = useQuery({ ...convexQuery(api.items.listItems, {}), enabled });
  const { data: spaces } = useQuery({ ...convexQuery(api.spaces.listSpaces, {}), enabled });
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (enabled) return;
    lastKey.current = null;
    void clearCatalogs();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || items === undefined || spaces === undefined) return;
    const ready = items.filter((item) => item.status === 'ready').slice(0, ITEM_CATALOG_LIMIT);
    const itemRecords = ready.map(itemRecord);
    const spaceRecords = spaces.map(spaceRecord);
    const key = JSON.stringify([itemRecords, spaceRecords]);
    if (key === lastKey.current) return;
    lastKey.current = key;

    void publish(async (isCurrent) => {
      await AppIntents.setEntityCatalogAsync(SPACE_KIND, spaceRecords);
      await AppIntents.setEntityCatalogAsync(ITEM_KIND, itemRecords);
      // Spotlight first without thumbnails so search works right away, then again once new
      // thumbnails exist.
      await setup?.indexItemsInSpotlight();
      if ((await writeThumbnails(ready, isCurrent)) && isCurrent()) {
        await setup?.indexItemsInSpotlight();
      }
    });
  }, [enabled, items, spaces]);
}

/** Gives the native capture intents a token for this account, minting one when needed. */
function useCaptureCredentials(userId: string) {
  const issueCaptureToken = useAction(api.appIntents.issueCaptureToken);

  useEffect(() => {
    if (!setup || !siteUrl) return;
    const nativeSetup = setup;
    let cancelled = false;
    void (async () => {
      const hasCredentials = await nativeSetup.hasCaptureCredentials();
      if (hasCredentials && store.getString(CAPTURE_OWNER_KEY) === userId) return;
      const token = await issueCaptureToken({});
      if (cancelled) return;
      await nativeSetup.setCaptureCredentials(siteUrl, token);
      store.set(CAPTURE_OWNER_KEY, userId);
    })().catch((error) => console.warn('Could not set up Siri capture', error));
    return () => {
      cancelled = true;
    };
  }, [userId, issueCaptureToken]);
}

function param(invocation: AppIntents.AppIntentInvocation, name: string): string | undefined {
  const value = invocation.params[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function spaceParam(invocation: AppIntents.AppIntentInvocation): Id<'spaces'> | undefined {
  return param(invocation, 'spaceId') as Id<'spaces'> | undefined;
}

/** Runs the invocations Siri queued: navigation, and captures that could not be saved natively. */
function useInvocationHandler() {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const createNoteItem = useMutation(api.items.createNoteItem);
  const createLinkItem = useMutation(api.items.createLinkItem);
  const saveImages = useSaveImages();
  const inFlight = useRef(new Set<string>());

  async function whenNavigationReady() {
    for (let attempt = 0; attempt < 50 && !navigation.isReady(); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function handle(invocation: AppIntents.AppIntentInvocation) {
    switch (invocation.name) {
      case 'search': {
        await whenNavigationReady();
        // `t` makes a repeated query still count as a new navigation.
        router.navigate({
          pathname: '/(app)/(tabs)/(search)',
          params: { q: param(invocation, 'query') ?? '', t: String(invocation.createdAt) },
        });
        return;
      }
      case 'openItem': {
        const id = param(invocation, 'id');
        if (!id) return;
        await whenNavigationReady();
        router.push({ pathname: '/item/[id]', params: { id } });
        return;
      }
      case 'openSpace': {
        const id = param(invocation, 'id');
        if (!id) return;
        await whenNavigationReady();
        router.push({ pathname: '/space/[id]', params: { id } });
        return;
      }
      case 'saveNote': {
        const text = param(invocation, 'text');
        if (text) await createNoteItem({ text, spaceId: spaceParam(invocation) });
        return;
      }
      case 'saveLink': {
        const url = param(invocation, 'url');
        if (url) await createLinkItem({ url, spaceId: spaceParam(invocation) });
        return;
      }
      case 'saveImages': {
        const paths = invocation.params.paths;
        if (!Array.isArray(paths)) return;
        const files = paths
          .filter((path): path is string => typeof path === 'string')
          .map((path) => new File(`file://${encodeURI(path)}`))
          .filter((file) => file.exists);
        if (files.length === 0) return;
        await saveImages(files.map((file) => ({ uri: file.uri })), { spaceId: spaceParam(invocation) });
        for (const file of files) file.delete();
        return;
      }
    }
  }

  AppIntents.useAppIntents(async (pending) => {
    for (const invocation of pending) {
      if (inFlight.current.has(invocation.id)) continue;
      inFlight.current.add(invocation.id);
      try {
        await handle(invocation);
        await AppIntents.removePendingInvocationAsync(invocation.id);
      } catch (error) {
        // Left pending, so the next launch or invocation retries it.
        console.warn(`App Intent ${invocation.name} failed`, error);
      } finally {
        inFlight.current.delete(invocation.id);
      }
    }
  });
}

/**
 * Wires Amber into Siri and Spotlight. Mount once inside the signed-in, unlocked tree. With the
 * app lock on, nothing about the user's saves is published, but Siri can still capture.
 */
export function AppIntentsBridge({ userId, publishCatalogs }: { userId: string; publishCatalogs: boolean }) {
  useInvocationHandler();
  useCaptureCredentials(userId);
  useCatalogSync(publishCatalogs && AppIntents.isAvailable());
  return null;
}
