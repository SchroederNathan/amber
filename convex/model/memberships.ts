import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type MembershipStatus = "suggested" | "saved" | "dismissed";

/**
 * A spaceItems row's effective state. Rows written before the suggestion
 * model existed have no `status` — they were real memberships, so they read
 * as "saved".
 */
export function effectiveStatus(row: Doc<"spaceItems">): MembershipStatus {
  return row.status ?? "saved";
}

/** The single membership row joining an item to a space, if any. */
export async function getMembership(
  ctx: QueryCtx,
  itemId: Id<"items">,
  spaceId: Id<"spaces">,
): Promise<Doc<"spaceItems"> | null> {
  return await ctx.db
    .query("spaceItems")
    .withIndex("by_item_and_space", (q) =>
      q.eq("itemId", itemId).eq("spaceId", spaceId),
    )
    .first();
}
