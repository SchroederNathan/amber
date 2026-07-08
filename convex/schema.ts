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
    capturedAt: v.optional(v.number()),
    isSticker: v.optional(v.boolean()),
    tags: v.array(v.string()),
    content: v.optional(v.string()),
    siteName: v.optional(v.string()),
    heroImageUrl: v.optional(v.string()),
    note: v.optional(v.string()),
    // AI-proposed pressable actions. Optional so pre-existing rows validate
    // without a backfill. `kind` is a closed union (mirrors items.ts).
    intents: v.optional(
      v.array(
        v.object({
          kind: v.union(
            v.literal("open_url"),
            v.literal("copy"),
            v.literal("web_search"),
            v.literal("open_maps"),
            v.literal("call"),
            v.literal("email"),
            v.literal("message"),
            v.literal("add_event"),
          ),
          label: v.string(),
          value: v.string(),
        }),
      ),
    ),
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
    // Dynamic = Amber keeps suggesting new saves into this space. Absent means
    // false (legacy spaces stay quiet until edited).
    dynamic: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  spaceItems: defineTable({
    userId: v.string(),
    spaceId: v.id("spaces"),
    itemId: v.id("items"),
    // The membership state machine. The AI may only ever write `suggested`
    // rows and only ever touch `suggested` rows; `saved` and `dismissed` are
    // user-owned, so the pipeline can never clobber a user decision.
    // Absent = legacy row = "saved".
    status: v.optional(
      v.union(
        v.literal("suggested"),
        v.literal("saved"),
        v.literal("dismissed"),
      ),
    ),
    // Purpose-steered actions scoped to THIS space's membership: the same
    // couch gets a shopping link in "apartment shopping" and nothing extra in
    // "interior design". Mirrors items.intents; kinds kept in sync with items.ts.
    intents: v.optional(
      v.array(
        v.object({
          kind: v.union(
            v.literal("open_url"),
            v.literal("copy"),
            v.literal("web_search"),
            v.literal("open_maps"),
            v.literal("call"),
            v.literal("email"),
            v.literal("message"),
            v.literal("add_event"),
          ),
          label: v.string(),
          value: v.string(),
        }),
      ),
    ),
  })
    .index("by_space", ["spaceId"])
    .index("by_item", ["itemId"])
    .index("by_user", ["userId"]),
});
