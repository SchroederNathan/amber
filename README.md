# Amber

A save-it-for-later app for the things you want to come back to. Drop in a **link**, an
**image**, or a **note** and Amber fetches the content, writes a title, a short summary, and
tags it — then files it into the right collection for you. Everything shows up as a warm
masonry feed.

Built with Expo (SDK 57) + Convex backend + AI classification via AI SDK.

## Features

- **Capture anything** — links, photos, screenshots, and plain notes, from inside the app (share into Amber from any other app).
- **Automatic organization** — every saved item is analyzed by an LLM that generates a title,
  a one-line description, and tags, and sorts it into matching **spaces** (themed collections).
- **Smart spaces** — create a new space and Amber retroactively pulls in your existing items
  that belong in it.
- **Full-text search** across everything you've saved.
- **Subject stickers** lift the subject out of a photo into a transparent die-cut
  sticker.
- **Offline-first feel** — the feed is persisted locally and paints instantly on cold launch,
  then syncs live.
- Adaptive light/dark theming with a warm amber palette.

## Tech stack

| Layer      | What                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| App        | Expo SDK 57, React Native 0.86 (New Architecture), Expo Router (typed)     |
| Backend    | [Convex](https://convex.dev) — reactive DB, file storage, server actions   |
| Auth       | [Clerk](https://clerk.com)                                                 |
| AI         | Vercel AI SDK → Gemini 3.1 Flash-Lite via the AI Gateway                   |
| Data/cache | TanStack Query + Convex adapter, persisted to MMKV                         |
| UI         | react-native-unistyles, Reanimated, Skia, FlashList, Vision Camera         |
| Native     | Local Expo modules (subject lift, progressive blur) + a share extension    |

## Getting started

### Prerequisites

- [Bun](https://bun.sh) (this project uses bun, not npm/yarn)
- Xcode (iOS) and/or Android Studio — Amber uses **custom native modules**, so it runs in a
  **dev client**, not Expo Go.
- Accounts: a [Convex](https://convex.dev) project and a [Clerk](https://clerk.com) app.

### 1. Install

```bash
bun install
```

### 2. Configure environment

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
```

Set the backend secrets on your Convex deployment (Convex dashboard or `bunx convex env set`):

```bash
bunx convex env set AI_GATEWAY_API_KEY <your-vercel-ai-gateway-key>
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-instance>.clerk.accounts.dev
```

`convex/auth.config.ts` reads the Clerk JWT issuer from `CLERK_JWT_ISSUER_DOMAIN`, so set it per
deployment (dev and prod each get their own instance's domain). The Clerk JWT template must use
`applicationID: "convex"`.

### 3. Run the backend

```bash
bunx convex dev
```

This deploys the functions in `convex/`, watches for changes, and keeps `convex/_generated/`
in sync.

### 4. Build & run the app

```bash
bunx expo run:ios      # or: bunx expo run:android
```

This builds the dev client and starts Metro. For subsequent runs you can just start Metro:

```bash
bun start
```

## Scripts

| Command                 | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `bun start`             | Start the Metro dev server                    |
| `bunx expo run:ios`     | Build and run the iOS dev client              |
| `bunx expo run:android` | Build and run the Android dev client          |
| `bunx convex dev`       | Run/deploy the Convex backend and codegen     |
| `bun run lint`          | Lint (ESLint, eslint-config-expo)             |
| `bunx tsc --noEmit`     | Typecheck (strict)                            |

## Project structure

```
convex/            Backend: schema, queries/mutations, AI processing pipeline
  schema.ts          items, spaces, spaceItems tables
  items.ts           item CRUD + search
  spaces.ts          space CRUD + item membership
  ai.ts              content extraction + LLM classification (Node action)
  model/auth.ts      requireUserId — every function derives the user from Clerk
src/
  app/               Expo Router routes (auth gate, native tabs, modals, detail screens)
  components/         Masonry feed, item cards, detail view, etc.
  lib/               Convex/TanStack client, onboarding, image saving
  unistyles.ts       Themes, palette, typography
modules/           Local native Expo modules
  subject-lift/      iOS Vision subject cutout
  progressive-blur/  SwiftUI gradient blur
```

## How it works

When you save something, the client inserts an item as `processing` and Convex schedules a
background action. That action fetches the page (extracting the readable article with Mozilla
Readability), or reads the image/note, and asks the model for a title, description, tags, and
which of your spaces it belongs to. Once done the item flips to `ready` and streams into your
feed live. Space names returned by the model are mapped back to real spaces, and creating a new
space triggers a pass over your existing items to backfill it.

Auth is enforced server-side: every Convex function resolves the user from the Clerk identity,
never from a client-supplied id.

## License

See [LICENSE](./LICENSE).
