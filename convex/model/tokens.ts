// Capture-token helpers shared by the appIntents mutations and the HTTP action.
// Web Crypto only (no Node builtins), so this runs in the default Convex runtime.

/** Hex-encoded SHA-256 of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  let hex = "";
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Unpadded base64url encoding of raw bytes. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      BASE64URL_ALPHABET[(n >> 18) & 63] +
      BASE64URL_ALPHABET[(n >> 12) & 63] +
      BASE64URL_ALPHABET[(n >> 6) & 63] +
      BASE64URL_ALPHABET[n & 63];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    out += BASE64URL_ALPHABET[(n >> 18) & 63] + BASE64URL_ALPHABET[(n >> 12) & 63];
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      BASE64URL_ALPHABET[(n >> 18) & 63] +
      BASE64URL_ALPHABET[(n >> 12) & 63] +
      BASE64URL_ALPHABET[(n >> 6) & 63];
  }
  return out;
}

/** Longest raw token accepted from a client. Issued tokens are 43 chars. */
export const MAX_TOKEN_LENGTH = 256;
