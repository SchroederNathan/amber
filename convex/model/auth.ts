import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

/**
 * Returns the authenticated user's stable id (Clerk `sub`), or throws.
 * Every public function derives its userId from this — never from an argument.
 */
export async function requireUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}
