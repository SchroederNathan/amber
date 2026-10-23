import { clearAppIntentCatalogs, useAppIntentCatalogSync } from '@/lib/app-intent-catalog';
import { appIntentsSetup as setup } from '@/lib/app-intent-native';
import { createIntentDelivery, InvalidAppIntent } from '@/lib/app-intent-delivery';
import { api } from '@convex/_generated/api';
import { useAction, useConvex, useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { ConvexError } from 'convex/values';
import { fetch as expoFetch } from 'expo/fetch';
import * as AppIntents from 'expo-app-intents';
import { Directory, File, Paths } from 'expo-file-system';
import { useNavigationContainerRef, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { createMMKV } from 'react-native-mmkv';

// Bridge between Amber and the Swift App Intents in `app-intents/` (Siri, Spotlight, Shortcuts,
// Visual Intelligence). Keep the catalog kinds, metadata keys, and invocation names in sync with
// `app-intents/Support/AmberCatalog.swift` and the intents that dispatch them.

const store = createMMKV({ id: 'app-intents' });
const CAPTURE_OWNER_KEY = 'captureOwner';
const ACCOUNT_OWNER_KEY = 'accountOwner';
const HANDLED_KEY = 'handledInvocations';

function handledIds(): string[] {
  try {
    const ids: unknown = JSON.parse(store.getString(HANDLED_KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

const siteUrl =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL ??
  process.env.EXPO_PUBLIC_CONVEX_URL?.replace(/\.convex\.cloud$/, '.convex.site');

// Credential setup and reset share one queue so sign-out cannot race a late token write.
let credentialChain = Promise.resolve();
let credentialGeneration = 0;
function credentials(work: () => Promise<void>) {
  const result = credentialChain.then(work);
  credentialChain = result.catch(() => {});
  return result;
}

async function clearStagedCaptures() {
  for (const root of [Paths.document, Paths.cache]) {
    const dir = new Directory(root, 'siri-attachments');
    if (dir.exists) dir.delete();
  }
}

/** Removes the signed-out account's native data, including staged capture files. */
export async function resetAppIntents(): Promise<void> {
  ++credentialGeneration;
  store.remove(CAPTURE_OWNER_KEY);
  store.remove(ACCOUNT_OWNER_KEY);
  store.remove(HANDLED_KEY);
  const results = await Promise.allSettled([
    clearStagedCaptures(),
    credentials(async () => { await setup?.clearCaptureCredentials(); }),
    AppIntents.clearPendingInvocationsAsync(),
    clearAppIntentCatalogs(),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason;
  }
}

/** Gives the native capture intents a token for this account, minting one when needed. */
function useCaptureCredentials(userId: string) {
  const issueCaptureToken = useAction(api.appIntents.issueCaptureToken);

  useEffect(() => {
    if (!setup || !siteUrl) return;
    const nativeSetup = setup;
    let cancelled = false;
    const generation = credentialGeneration;
    const isCurrent = () => !cancelled && generation === credentialGeneration;
    void credentials(async () => {
      if (!isCurrent()) return;
      const hasCredentials = await nativeSetup.hasCaptureCredentials(userId);
      if (hasCredentials && store.getString(CAPTURE_OWNER_KEY) === userId) return;
      const token = await issueCaptureToken({});
      if (!isCurrent()) return;
      await nativeSetup.setCaptureCredentials(siteUrl, token, userId);
      if (isCurrent()) store.set(CAPTURE_OWNER_KEY, userId);
    }).catch((error) => console.warn('Could not set up Siri capture', error));
    return () => {
      cancelled = true;
    };
  }, [userId, issueCaptureToken]);
}

function param(invocation: AppIntents.AppIntentInvocation, name: string): string | undefined {
  const value = invocation.params[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stagedImage(path: string): File {
  const file = new File(new URL(`file://${encodeURI(path)}`).href);
  const allowed = [Paths.document, Paths.cache].some((root) =>
    file.uri.startsWith(new Directory(root, 'siri-attachments').uri.replace(/\/?$/, '/')));
  if (!allowed) throw new InvalidAppIntent('Image is outside the capture directory');
  return file;
}

/** Runs native invocations only while this signed-in bridge remains mounted. */
function useInvocationHandler(userId: string) {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const convex = useConvex();
  const capture = useMutation(api.appIntents.capture);
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function captureOnce(args: FunctionArgs<typeof api.appIntents.capture>) {
    if (!active.current) throw new Error('App Intent handler unmounted');
    try {
      return await capture(args);
    } catch (error) {
      if (error instanceof ConvexError && error.data?.code === 'INVALID_CAPTURE') {
        throw new InvalidAppIntent(error.data.message);
      }
      throw error;
    }
  }

  async function whenNavigationReady() {
    for (let attempt = 0; attempt < 50 && !navigation.isReady(); attempt++) {
      if (!active.current) throw new Error('App Intent handler unmounted');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!active.current || !navigation.isReady()) throw new Error('Navigation is not ready');
  }

  async function handle(invocation: AppIntents.AppIntentInvocation): Promise<boolean> {
    const ownerId = param(invocation, 'userId');
    if (ownerId && ownerId !== userId) throw new InvalidAppIntent('Capture belongs to a signed-out account');
    const requestId = param(invocation, 'requestId') ?? invocation.id;
    const spaceId = param(invocation, 'spaceId');
    const required = (name: string) => {
      const value = param(invocation, name)?.trim();
      if (!value) throw new InvalidAppIntent(`Missing ${name}`);
      return value;
    };
    switch (invocation.name) {
      case 'search':
        await whenNavigationReady();
        router.navigate({
          pathname: '/(app)/(tabs)/(search)',
          params: { q: param(invocation, 'query') ?? '', t: String(invocation.createdAt) },
        });
        return true;
      case 'openItem':
      case 'openSpace': {
        const id = required('id');
        await whenNavigationReady();
        router.navigate({ pathname: invocation.name === 'openItem' ? '/item/[id]' : '/space/[id]', params: { id } });
        return true;
      }
      case 'saveNote':
        await captureOnce({ requestId, kind: 'note', text: required('text'), spaceId });
        return true;
      case 'saveLink':
        await captureOnce({ requestId, kind: 'link', url: required('url'), spaceId });
        return true;
      case 'saveImages': {
        const paths = invocation.params.paths;
        if (!Array.isArray(paths) || paths.length === 0 || !paths.every((path) => typeof path === 'string')) {
          throw new InvalidAppIntent('Missing image paths');
        }
        // New native code queues one prepared image per invocation. Keep older batches readable.
        for (const [index, path] of paths.entries()) {
          if (!active.current) throw new Error('App Intent handler unmounted');
          const imageRequestId = paths.length === 1 ? requestId : `${requestId}:${index}`;
          if (await convex.query(api.appIntents.getCaptureResult, { requestId: imageRequestId })) continue;
          if (!active.current) throw new Error('App Intent handler unmounted');
          const file = stagedImage(path);
          if (!file.exists) throw new InvalidAppIntent('Capture image is no longer available');
          const uploadUrl = await generateUploadUrl();
          const result = await expoFetch(uploadUrl, {
            method: 'POST', body: file,
            headers: { 'Content-Type': param(invocation, 'mimeType') ?? file.type ?? 'image/jpeg' },
          });
          if (!result.ok) throw new Error(`Capture upload failed (${result.status})`);
          const { storageId } = await result.json();
          if (!active.current) throw new Error('App Intent handler unmounted');
          const aspectRatio = invocation.params.aspectRatio;
          await captureOnce({
            requestId: imageRequestId,
            kind: 'image', storageId, spaceId,
            text: param(invocation, 'text'),
            aspectRatio: typeof aspectRatio === 'number' ? aspectRatio : undefined,
            isSticker: invocation.params.isSticker === true,
          });
        }
        // Keep files until every image has committed. Receipts protect retries of older batches.
        for (const path of paths) {
          try { stagedImage(path).delete(); } catch { /* Best effort. */ }
        }
        return true;
      }
      default:
        console.warn(`Unknown App Intent remains pending: ${invocation.name}`);
        return false;
    }
  }

  const handler = useRef(handle);
  const delivery = useRef<ReturnType<typeof createIntentDelivery<AppIntents.AppIntentInvocation>> | null>(null);
  useEffect(() => { handler.current = handle; });
  useEffect(() => {
    delivery.current = createIntentDelivery<AppIntents.AppIntentInvocation>({
      isActive: () => active.current,
      isHandled: (id) => handledIds().includes(id),
      markHandled: (id) => {
        const ids = handledIds();
        store.set(HANDLED_KEY, JSON.stringify([...new Set([...ids, id])].slice(-100)));
      },
      handle: (invocation) => handler.current(invocation),
      acknowledge: AppIntents.removePendingInvocationAsync,
      onError: (invocation, error) => console.warn(`App Intent ${invocation.name} failed`, error),
    });
  }, []);
  AppIntents.useAppIntents(async (pending) => { await delivery.current?.(pending); });
}

function AvailableAppIntentsBridge({ userId, publishCatalogs }: { userId: string; publishCatalogs: boolean }) {
  useInvocationHandler(userId);
  useCaptureCredentials(userId);
  useAppIntentCatalogSync(publishCatalogs);
  return null;
}

/** Mount once within the authenticated, unlocked tree. App lock disables catalog publication. */
export function AppIntentsBridge(props: { userId: string; publishCatalogs: boolean }) {
  return AppIntents.isAvailable() ? <AccountAppIntentsBridge key={props.userId} {...props} /> : null;
}

function AccountAppIntentsBridge(props: { userId: string; publishCatalogs: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const previous = store.getString(ACCOUNT_OWNER_KEY) ?? store.getString(CAPTURE_OWNER_KEY);
      if (previous && previous !== props.userId) await resetAppIntents();
      if (cancelled) return;
      store.set(ACCOUNT_OWNER_KEY, props.userId);
      setReady(true);
    })().catch((error) => console.warn('Could not prepare App Intents for this account', error));
    return () => { cancelled = true; };
  }, [props.userId]);
  return ready ? <AvailableAppIntentsBridge {...props} /> : null;
}
