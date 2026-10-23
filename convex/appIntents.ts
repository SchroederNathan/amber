import { ConvexError, v, type ObjectType } from "convex/values";
import { action, query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./model/auth";
import { base64UrlEncode, MAX_TOKEN_LENGTH, sha256Hex } from "./model/tokens";
import { insertImageItem, insertLinkItem, insertNoteItem } from "./items";

/** Tokens kept per user; the oldest beyond this are deleted on issue. */
const MAX_TOKENS_PER_USER = 5;

/** Upper bound on the note text accepted from a native capture. */
export const MAX_CAPTURE_NOTE_LENGTH = 20000;

/** Upper bound on the URL accepted from a native capture. */
export const MAX_CAPTURE_URL_LENGTH = 8192;

/**
 * Upper bound on the context sent with a native image capture (what the user
 * said plus the text read from the image). Longer context is cut, not refused.
 */
export const MAX_CAPTURE_CONTEXT_LENGTH = 8000;

/**
 * Mints a per-device capture token for native App Intents. The raw token is
 * returned once and never stored; only its SHA-256 hex hash is persisted.
 *
 * An action, not a mutation: mutation randomness is seeded so retries are
 * deterministic, and a credential must come from an unpredictable source.
 */
export const issueCaptureToken = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = base64UrlEncode(bytes);
    const tokenHash = await sha256Hex(token);
    await ctx.runMutation(internal.appIntents.storeCaptureToken, {
      userId,
      tokenHash,
    });
    return token;
  },
});

/** Persists a freshly minted token hash and trims the user's oldest tokens. */
export const storeCaptureToken = internalMutation({
  args: { userId: v.string(), tokenHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("captureTokens", {
      userId: args.userId,
      tokenHash: args.tokenHash,
      createdAt: Date.now(),
    });

    // Newest first (by_user orders by _creationTime within a user). Bounded
    // read: at most MAX_TOKENS_PER_USER + a few stragglers can ever exist.
    const tokens = await ctx.db
      .query("captureTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
    for (const stale of tokens.slice(MAX_TOKENS_PER_USER)) {
      await ctx.db.delete(stale._id);
    }
    return null;
  },
});

/** Revokes a capture token. A no-op unless the token belongs to the caller. */
export const revokeCaptureToken = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.token.length === 0 || args.token.length > MAX_TOKEN_LENGTH) {
      return null;
    }
    const tokenHash = await sha256Hex(args.token);
    const row = await ctx.db
      .query("captureTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (row !== null && row.userId === userId) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

/** Finds the capture token row for a hash and marks it used. */
async function claimCaptureToken(ctx: MutationCtx, tokenHash: string) {
  const token = await ctx.db
    .query("captureTokens")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (token !== null) {
    await ctx.db.patch(token._id, { lastUsedAt: Date.now() });
  }
  return token;
}

/**
 * Called by the `/app-intents/upload-url` HTTP action, so a native image
 * capture can upload its file before it calls `/app-intents/capture`.
 * Returns null when the token is unknown (caller responds 401).
 */
export const generateUploadUrlInternal = internalMutation({
  args: { tokenHash: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const token = await claimCaptureToken(ctx, args.tokenHash);
    if (token === null) {
      return null;
    }
    return await ctx.storage.generateUploadUrl();
  },
});

const captureArgs = {
  requestId: v.optional(v.string()),
  kind: v.union(v.literal("note"), v.literal("link"), v.literal("image")),
  text: v.optional(v.string()),
  url: v.optional(v.string()),
  storageId: v.optional(v.string()),
  aspectRatio: v.optional(v.number()),
  isSticker: v.optional(v.boolean()),
  spaceId: v.optional(v.string()),
};

const captureResult = v.object({ itemId: v.id("items") });
type CaptureArgs = ObjectType<typeof captureArgs>;

/** Check before uploading a replayed image whose native request may already have committed. */
export const getCaptureResult = query({
  args: { requestId: v.string() },
  returns: v.union(v.null(), captureResult),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const receipt = await ctx.db.query("captureReceipts")
      .withIndex("by_user_request", (q) => q.eq("userId", userId).eq("requestId", args.requestId))
      .unique();
    return receipt === null ? null : { itemId: receipt.itemId };
  },
});

/** Signed-in replay of an invocation that could not finish natively. */
export const capture = mutation({
  args: { ...captureArgs, requestId: v.string() },
  returns: captureResult,
  handler: async (ctx, args) => captureForUser(ctx, await requireUserId(ctx), args),
});

/**
 * Called by the `/app-intents/capture` HTTP action. The token hash is the only
 * credential: the userId is taken from the token row, never from the request.
 * Returns null when the token is unknown (caller responds 401).
 */
export const captureInternal = internalMutation({
  args: { ...captureArgs, tokenHash: v.string() },
  returns: v.union(v.null(), captureResult),
  handler: async (ctx, args) => {
    const token = await claimCaptureToken(ctx, args.tokenHash);
    if (token === null) return null;
    return await captureForUser(ctx, token.userId, args);
  },
});

function invalidCapture(message: string): never {
  throw new ConvexError({ code: "INVALID_CAPTURE", message });
}

async function captureForUser(ctx: MutationCtx, userId: string, args: CaptureArgs) {
  // Optional only for native binaries released before request IDs were added.
  const requestId = args.requestId;
  if (requestId !== undefined) {
    if (!requestId.trim() || requestId.length > 200) {
      invalidCapture("Invalid capture request ID");
    }
    const receipt = await ctx.db
      .query("captureReceipts")
      .withIndex("by_user_request", (q) => q.eq("userId", userId).eq("requestId", requestId))
      .unique();
    if (receipt !== null) return { itemId: receipt.itemId };
  }

  // Stale, deleted and foreign Siri destinations do not prevent a capture.
  let spaceId: Id<"spaces"> | undefined;
  if (args.spaceId !== undefined) {
    const normalized = ctx.db.normalizeId("spaces", args.spaceId);
    const space = normalized === null ? null : await ctx.db.get(normalized);
    if (space?.userId === userId) spaceId = space._id;
  }

  let itemId: Id<"items">;
  if (args.kind === "image") {
    const storageId = args.storageId === undefined
      ? null
      : ctx.db.system.normalizeId("_storage", args.storageId);
    const file = storageId === null ? null : await ctx.db.system.get(storageId);
    if (storageId === null || file === null) invalidCapture("Uploaded image not found");
    if (file.contentType !== undefined && !file.contentType.startsWith("image/")) {
      invalidCapture("Upload is not an image");
    }
    if (args.aspectRatio !== undefined && (!Number.isFinite(args.aspectRatio) || args.aspectRatio <= 0)) {
      invalidCapture("Invalid aspect ratio");
    }
    const context = args.text?.trim().slice(0, MAX_CAPTURE_CONTEXT_LENGTH);
    itemId = await insertImageItem(ctx, userId, {
      storageId,
      aspectRatio: args.aspectRatio,
      isSticker: args.isSticker,
      captureContext: args.isSticker === true ? undefined : (context ?? ""),
      spaceId,
    });
  } else if (args.kind === "note") {
    const text = args.text?.trim() ?? "";
    if (!text || text.length > MAX_CAPTURE_NOTE_LENGTH) invalidCapture("Invalid note text");
    itemId = await insertNoteItem(ctx, userId, text, spaceId, "");
  } else {
    const url = args.url?.trim() ?? "";
    let parsed: URL;
    try { parsed = new URL(url); } catch { invalidCapture("Invalid URL"); }
    if (!["http:", "https:"].includes(parsed.protocol) || url.length > MAX_CAPTURE_URL_LENGTH) {
      invalidCapture("Invalid URL");
    }
    itemId = await insertLinkItem(ctx, userId, url, spaceId);
  }

  if (args.requestId !== undefined) {
    await ctx.db.insert("captureReceipts", { userId, requestId: args.requestId, itemId });
  }
  return { itemId };
}
