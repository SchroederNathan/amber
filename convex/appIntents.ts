import { v } from "convex/values";
import { action, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./model/auth";
import { base64UrlEncode, MAX_TOKEN_LENGTH, sha256Hex } from "./model/tokens";
import { insertLinkItem, insertNoteItem } from "./items";

/** Tokens kept per user; the oldest beyond this are deleted on issue. */
const MAX_TOKENS_PER_USER = 5;

/** Upper bound on the note text accepted from a native capture. */
export const MAX_CAPTURE_NOTE_LENGTH = 20000;

/** Upper bound on the URL accepted from a native capture. */
export const MAX_CAPTURE_URL_LENGTH = 8192;

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

/**
 * Called by the `/app-intents/capture` HTTP action. The token hash is the only
 * credential: the userId is taken from the token row, never from the request.
 * Returns null when the token is unknown (caller responds 401).
 */
export const captureInternal = internalMutation({
  args: {
    tokenHash: v.string(),
    kind: v.union(v.literal("note"), v.literal("link")),
    text: v.optional(v.string()),
    url: v.optional(v.string()),
    spaceId: v.optional(v.string()),
  },
  returns: v.union(v.null(), v.object({ itemId: v.id("items") })),
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("captureTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (token === null) {
      return null;
    }
    const userId = token.userId;
    await ctx.db.patch(token._id, { lastUsedAt: Date.now() });

    // An invalid, deleted, or foreign spaceId is dropped silently: the save
    // itself must not fail because of a stale space picked in Siri.
    let spaceId: Id<"spaces"> | undefined = undefined;
    if (args.spaceId !== undefined) {
      const normalized = ctx.db.normalizeId("spaces", args.spaceId);
      if (normalized !== null) {
        const space = await ctx.db.get(normalized);
        if (space !== null && space.userId === userId) {
          spaceId = normalized;
        }
      }
    }

    if (args.kind === "note") {
      const text = args.text ?? "";
      if (text.length > MAX_CAPTURE_NOTE_LENGTH) {
        throw new Error("Note text is too long");
      }
      const itemId = await insertNoteItem(ctx, userId, text, spaceId);
      return { itemId };
    }

    const url = args.url ?? "";
    if (url.length > MAX_CAPTURE_URL_LENGTH) {
      throw new Error("URL is too long");
    }
    const itemId = await insertLinkItem(ctx, userId, url, spaceId);
    return { itemId };
  },
});
