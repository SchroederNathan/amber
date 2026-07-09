import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./model/auth";
import { effectiveStatus, getMembership } from "./model/memberships";
import { enrichItem, enrichedItemValidator, intentValidator } from "./items";

const spaceFields = {
  _id: v.id("spaces"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  dynamic: v.optional(v.boolean()),
};

/** A space's joins split by who owns them: the user (saved) vs Amber (suggested). */
async function splitJoins(ctx: QueryCtx, spaceId: Id<"spaces">) {
  const joins = await ctx.db
    .query("spaceItems")
    .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
    .collect();
  const saved: Doc<"spaceItems">[] = [];
  const suggested: Doc<"spaceItems">[] = [];
  for (const join of joins) {
    const status = effectiveStatus(join);
    if (status === "saved") {
      saved.push(join);
    } else if (status === "suggested") {
      suggested.push(join);
    }
    // Dismissed rows exist only so the AI never re-suggests; never surfaced.
  }
  return { saved, suggested };
}

async function loadItems(
  ctx: QueryCtx,
  joins: Doc<"spaceItems">[],
): Promise<Doc<"items">[]> {
  const rows = await Promise.all(joins.map((join) => ctx.db.get(join.itemId)));
  const items = rows.filter((item): item is Doc<"items"> => item !== null);
  items.sort((a, b) => b._creationTime - a._creationTime);
  return items;
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export const listSpaces = query({
  args: {},
  returns: v.array(
    v.object({
      ...spaceFields,
      // Saved memberships only — pending suggestions don't inflate the count.
      itemCount: v.number(),
      suggestionCount: v.number(),
      previews: v.array(
        v.object({
          url: v.string(),
          type: v.union(v.literal("image"), v.literal("link"), v.literal("note")),
          aspectRatio: v.optional(v.number()),
          suggested: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const spaces = await ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return await Promise.all(
      spaces.map(async (space) => {
        const { saved, suggested } = await splitJoins(ctx, space._id);
        const [savedItems, suggestedItems] = await Promise.all([
          loadItems(ctx, saved),
          loadItems(ctx, suggested),
        ]);

        // Saved items front the pile; a fresh space with only suggestions still
        // gets covers (sparkled client-side) instead of looking dead.
        const pool: { item: Doc<"items">; suggested: boolean }[] = [
          ...savedItems.map((item) => ({ item, suggested: false })),
          ...suggestedItems.map((item) => ({ item, suggested: true })),
        ];
        const previews: {
          url: string;
          type: Doc<"items">["type"];
          aspectRatio?: number;
          suggested: boolean;
        }[] = [];
        for (const { item, suggested: isSuggested } of pool) {
          if (previews.length >= 3) {
            break;
          }
          if (item.storageId) {
            const url = await ctx.storage.getUrl(item.storageId);
            if (url !== null) {
              previews.push({
                url,
                type: item.type,
                aspectRatio: item.aspectRatio,
                suggested: isSuggested,
              });
            }
          } else if (item.heroImageUrl) {
            previews.push({
              url: item.heroImageUrl,
              type: item.type,
              aspectRatio: item.aspectRatio,
              suggested: isSuggested,
            });
          }
        }

        return {
          ...space,
          itemCount: saved.length,
          suggestionCount: suggested.length,
          previews,
        };
      }),
    );
  },
});

export const getSpace = query({
  args: { id: v.id("spaces") },
  returns: v.union(
    v.object({
      ...spaceFields,
      // Saved items additionally carry this membership's purpose-steered
      // intents — the same item can act differently on a different shelf.
      items: v.array(
        v.object({
          ...enrichedItemValidator.fields,
          spaceIntents: v.optional(v.array(intentValidator)),
        }),
      ),
      suggestions: v.array(enrichedItemValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const space = await ctx.db.get(args.id);
    if (space === null || space.userId !== userId) {
      return null;
    }
    const { saved, suggested } = await splitJoins(ctx, space._id);
    const intentsByItem = new Map(
      saved.map((join) => [join.itemId, join.intents]),
    );
    const [items, suggestions] = await Promise.all([
      loadItems(ctx, saved).then((rows) =>
        Promise.all(
          rows.map(async (item) => ({
            ...(await enrichItem(ctx, item)),
            spaceIntents: intentsByItem.get(item._id),
          })),
        ),
      ),
      loadItems(ctx, suggested).then((rows) =>
        Promise.all(rows.map((item) => enrichItem(ctx, item))),
      ),
    ]);
    return { ...space, items, suggestions };
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

export const createSpace = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    dynamic: v.optional(v.boolean()),
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
      dynamic: args.dynamic ?? false,
    });
    // Every new space gets one recommendation pass off its title; the dynamic
    // toggle only governs whether future saves keep getting suggested.
    await ctx.scheduler.runAfter(0, internal.ai.recommendForSpace, {
      spaceId,
    });
    return spaceId;
  },
});

export const updateSpace = mutation({
  args: {
    id: v.id("spaces"),
    name: v.optional(v.string()),
    dynamic: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const space = await ctx.db.get(args.id);
    if (space === null || space.userId !== userId) {
      throw new Error("Space not found");
    }
    const patch: { name?: string; dynamic?: boolean } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name === "") {
        throw new Error("Space name is empty");
      }
      patch.name = name;
    }
    if (args.dynamic !== undefined) {
      patch.dynamic = args.dynamic;
    }
    await ctx.db.patch(space._id, patch);
    // Turning dynamic on (re-)opens the door: run a fresh recommendation pass.
    const wasDynamic = space.dynamic === true;
    if (args.dynamic === true && !wasDynamic) {
      await ctx.scheduler.runAfter(0, internal.ai.recommendForSpace, {
        spaceId: space._id,
      });
    }
    return null;
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

/** Guard shared by the membership mutations: both ends must exist and be the caller's. */
async function requireItemAndSpace(
  ctx: MutationCtx,
  userId: string,
  itemId: Id<"items">,
  spaceId: Id<"spaces">,
): Promise<{ item: Doc<"items">; space: Doc<"spaces"> }> {
  const item = await ctx.db.get(itemId);
  if (item === null || item.userId !== userId) {
    throw new Error("Item not found");
  }
  const space = await ctx.db.get(spaceId);
  if (space === null || space.userId !== userId) {
    throw new Error("Space not found");
  }
  return { item, space };
}

/** Schedule the phase-2 purpose-steering enrich pass for a ready item. */
async function scheduleSteering(
  ctx: MutationCtx,
  item: Doc<"items">,
  spaceId: Id<"spaces">,
): Promise<void> {
  if (item.status === "ready") {
    await ctx.scheduler.runAfter(0, internal.ai.steerItemForSpace, {
      itemId: item._id,
      spaceId,
    });
  }
}

export const addItemToSpace = mutation({
  args: { itemId: v.id("items"), spaceId: v.id("spaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { item } = await requireItemAndSpace(
      ctx,
      userId,
      args.itemId,
      args.spaceId,
    );
    const row = await getMembership(ctx, args.itemId, args.spaceId);
    if (row === null) {
      await ctx.db.insert("spaceItems", {
        userId,
        spaceId: args.spaceId,
        itemId: args.itemId,
        status: "saved",
      });
    } else if (effectiveStatus(row) !== "saved") {
      // A direct add upgrades a pending suggestion or overrides a dismissal.
      await ctx.db.patch(row._id, { status: "saved" });
    } else {
      return null;
    }
    await scheduleSteering(ctx, item, args.spaceId);
    return null;
  },
});

export const removeItemFromSpace = mutation({
  args: { itemId: v.id("items"), spaceId: v.id("spaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireItemAndSpace(ctx, userId, args.itemId, args.spaceId);
    const row = await getMembership(ctx, args.itemId, args.spaceId);
    if (row !== null && effectiveStatus(row) === "saved") {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

export const acceptSuggestion = mutation({
  args: { itemId: v.id("items"), spaceId: v.id("spaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { item } = await requireItemAndSpace(
      ctx,
      userId,
      args.itemId,
      args.spaceId,
    );
    const row = await getMembership(ctx, args.itemId, args.spaceId);
    // Tolerate double-taps and races: only a live suggestion flips.
    if (row === null || effectiveStatus(row) !== "suggested") {
      return null;
    }
    await ctx.db.patch(row._id, { status: "saved" });
    await scheduleSteering(ctx, item, args.spaceId);
    return null;
  },
});

export const dismissSuggestion = mutation({
  args: { itemId: v.id("items"), spaceId: v.id("spaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireItemAndSpace(ctx, userId, args.itemId, args.spaceId);
    const row = await getMembership(ctx, args.itemId, args.spaceId);
    if (row === null || effectiveStatus(row) !== "suggested") {
      return null;
    }
    // Kept (not deleted) so the AI never nags about this item again.
    await ctx.db.patch(row._id, { status: "dismissed" });
    return null;
  },
});

export const acceptAllSuggestions = mutation({
  args: { spaceId: v.id("spaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const space = await ctx.db.get(args.spaceId);
    if (space === null || space.userId !== userId) {
      throw new Error("Space not found");
    }
    const { suggested } = await splitJoins(ctx, space._id);
    const items = await Promise.all(
      suggested.map((row) => ctx.db.get(row.itemId)),
    );
    await Promise.all(
      suggested.map(async (row, i) => {
        await ctx.db.patch(row._id, { status: "saved" });
        const item = items[i];
        if (item !== null) {
          await scheduleSteering(ctx, item, args.spaceId);
        }
      }),
    );
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

/**
 * Item ids that already have any membership row for a space — the
 * recommendation pass excludes them up front so the model's picks aren't
 * wasted on items the user already filed or dismissed.
 */
export const listMemberItemIdsInternal = internalQuery({
  args: { spaceId: v.id("spaces") },
  returns: v.array(v.id("items")),
  handler: async (ctx, args) => {
    const joins = await ctx.db
      .query("spaceItems")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    return joins.map((join) => join.itemId);
  },
});

/**
 * Ids of spaces the user has directly filed this item into. processItem uses
 * these to kick off the purpose-steering pass once classification lands (a
 * couch saved to "apartment shopping" wants a shopping link on that shelf).
 */
export const listSavedSpaceIdsForItemInternal = internalQuery({
  args: { itemId: v.id("items") },
  returns: v.array(v.id("spaces")),
  handler: async (ctx, args) => {
    const joins = await ctx.db
      .query("spaceItems")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    return joins
      .filter((join) => effectiveStatus(join) === "saved")
      .map((join) => join.spaceId);
  },
});

/**
 * The steering pass's write path: intents scoped to one membership row. Only
 * `saved` rows carry them — steering never runs for pending suggestions.
 */
export const setMembershipIntentsInternal = internalMutation({
  args: {
    itemId: v.id("items"),
    spaceId: v.id("spaces"),
    intents: v.array(intentValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await getMembership(ctx, args.itemId, args.spaceId);
    if (row === null || effectiveStatus(row) !== "saved") {
      return null;
    }
    await ctx.db.patch(row._id, { intents: args.intents });
    return null;
  },
});
