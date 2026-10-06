// The session Clerk biometric sign-in just created. The user passed Face ID a
// moment ago, so the lock opens it without asking a second time.
const FRESH_MS = 30_000;
let verified: { sessionId: string; at: number } | null = null;

export function markBiometricSession(sessionId: string) {
  verified = { sessionId, at: Date.now() };
}

export function isFreshBiometricSession(sessionId: string) {
  return verified?.sessionId === sessionId && Date.now() - verified.at < FRESH_MS;
}
