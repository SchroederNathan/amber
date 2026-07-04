import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  items: defineTable({
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
    isSticker: v.optional(v.boolean()),
    tags: v.array(v.string()),
    content: v.optional(v.string()),
    siteName: v.optional(v.string()),
    heroImageUrl: v.optional(v.string()),
    note: v.optional(v.string()),
    searchText: v.string(),
  })
    .index("by_user", ["userId"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["userId"],
    }),

  spaces: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  spaceItems: defineTable({
    userId: v.string(),
    spaceId: v.id("spaces"),
    itemId: v.id("items"),
  })
    .index("by_space", ["spaceId"])
    .index("by_item", ["itemId"])
    .index("by_user", ["userId"]),
});
