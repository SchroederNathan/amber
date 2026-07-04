import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireUserId } from "./model/auth";
import { enrichItem } from "./items";

const spaceFields = {
  _id: v.id("spaces"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  emoji: v.optional(v.string()),
};

const enrichedItemValidator = v.object({
  _id: v.id("items"),
  _creationTime: v.number(),
  userId: v.string(),
  type: v.union(v.literal("image"), v.literal("link"), v.literal("note")),
  status: v.union(
    v.literal("processing"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  url: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
  aspectRatio: v.optional(v.number()),
  tags: v.array(v.string()),
  content: v.optional(v.string()),
  siteName: v.optional(v.string()),
  heroImageUrl: v.optional(v.string()),
  note: v.optional(v.string()),
  searchText: v.string(),
  imageUrl: v.union(v.string(), v.null()),
});

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export const listSpaces = query({
  args: {},
  returns: v.array(
    v.object({
      ...spaceFields,
      itemCount: v.number(),
      previewImageUrls: v.array(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const spaces = await ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const results = [];
    for (const space of spaces) {
      const joins = await ctx.db
        .query("spaceItems")
        .withIndex("by_space", (q) => q.eq("spaceId", space._id))
        .collect();

      // Newest items first for previews.
      const items: Doc<"items">[] = [];
      for (const join of joins) {
        const item = await ctx.db.get(join.itemId);
        if (item !== null) {
          items.push(item);
        }
      }
      items.sort((a, b) => b._creationTime - a._creationTime);

      const previewImageUrls: string[] = [];
      for (const item of items) {
        if (previewImageUrls.length >= 3) {
          break;
        }
        if (item.storageId) {
          const url = await ctx.storage.getUrl(item.storageId);
          if (url !== null) {
            previewImageUrls.push(url);
          }
        } else if (item.heroImageUrl) {
          previewImageUrls.push(item.heroImageUrl);
        }
      }

      results.push({ ...space, itemCount: joins.length, previewImageUrls });
    }
    return results;
  },
});

export const getSpace = query({
  args: { id: v.id("spaces") },
  returns: v.union(
    v.object({
      ...spaceFields,
      items: v.array(enrichedItemValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const space = await ctx.db.get(args.id);
    if (space === null || space.userId !== userId) {
      return null;
    }
    const joins = await ctx.db
      .query("spaceItems")
      .withIndex("by_space", (q) => q.eq("spaceId", space._id))
      .collect();
    const items: Doc<"items">[] = [];
    for (const join of joins) {
      const item = await ctx.db.get(join.itemId);
      if (item !== null) {
        items.push(item);
      }
    }
    items.sort((a, b) => b._creationTime - a._creationTime);
    const enriched = await Promise.all(
      items.map((item) => enrichItem(ctx, item)),
    );
    return { ...space, items: enriched };
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

export const createSpace = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  returns: v.id("spaces"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = args.name.trim();
    if (name === "") {
      throw new Error("Space name is empty");
    }
    const spaceId = await ctx.db.insert("spaces", {
      userId,
      name,
      description: args.description,
      emoji: args.emoji,
    });
    await ctx.scheduler.runAfter(0, internal.ai.reclassifyForNewSpace, {
      spaceId,
    });
    return spaceId;
  },
});

export const deleteSpace = mutation({
  args: { id: v.id("spaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const space = await ctx.db.get(args.id);
    if (space === null || space.userId !== userId) {
      throw new Error("Space not found");
    }
    const joins = await ctx.db
      .query("spaceItems")
      .withIndex("by_space", (q) => q.eq("spaceId", space._id))
      .collect();
    for (const join of joins) {
      await ctx.db.delete(join._id);
    }
    await ctx.db.delete(space._id);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Internal — used by the AI actions
// ---------------------------------------------------------------------------

export const listSpacesInternal = internalQuery({
  args: { userId: v.string() },
  returns: v.array(v.object(spaceFields)),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getSpaceInternal = internalQuery({
  args: { spaceId: v.id("spaces") },
  returns: v.union(v.object(spaceFields), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.spaceId);
  },
});
