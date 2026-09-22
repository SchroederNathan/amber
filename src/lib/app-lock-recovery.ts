export type LockRecoveryRequest = { userId: string; sessionId: string };

// OAuth recovery is explicit and bound to the account and session that asked
// for it. A restored or unchanged session cannot count as signing in again.
export function canResetLock(
  request: LockRecoveryRequest | null,
  userId: string,
  sessionId: string,
): boolean {
  return request?.userId === userId && request.sessionId !== sessionId;
}
