import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_TOKEN_LENGTH, sha256Hex } from "./model/tokens";
import {
  MAX_CAPTURE_CONTEXT_LENGTH,
  MAX_CAPTURE_NOTE_LENGTH,
  MAX_CAPTURE_URL_LENGTH,
} from "./appIntents";

/** Upper bound on the diagnostic trace a native capture may send. */
const MAX_TRACE_LENGTH = 2000;

const http = httpRouter();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type CapturePayload =
  | { kind: "note"; text: string; spaceId?: string }
  | { kind: "link"; url: string; spaceId?: string }
  | {
      kind: "image";
      storageId: string;
      aspectRatio?: number;
      text?: string;
      spaceId?: string;
    };

/** Reads the capture token from `Authorization: Bearer <token>`. */
function bearerToken(request: Request): string | undefined {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(
    request.headers.get("Authorization") ?? "",
  );
  const token = match?.[1];
  return token !== undefined && token.length <= MAX_TOKEN_LENGTH
    ? token
    : undefined;
}

/** Validates the untrusted JSON body. Returns an error message on bad input. */
function parseCaptureBody(body: unknown): CapturePayload | string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "Body must be a JSON object";
  }
  const { kind, text, url, spaceId, storageId, aspectRatio } = body as Record<
    string,
    unknown
  >;
  if (spaceId !== undefined && spaceId !== null && typeof spaceId !== "string") {
    return "spaceId must be a string";
  }
  const space =
    typeof spaceId === "string" && spaceId.length > 0 && spaceId.length <= 128
      ? spaceId
      : undefined;

  if (kind === "note") {
    if (typeof text !== "string" || text.trim() === "") {
      return "Note text is required";
    }
    if (text.length > MAX_CAPTURE_NOTE_LENGTH) {
      return `Note text must be at most ${MAX_CAPTURE_NOTE_LENGTH} characters`;
    }
    return { kind, text, spaceId: space };
  }
  if (kind === "link") {
    if (typeof url !== "string" || url.trim() === "") {
      return "url is required";
    }
    if (url.length > MAX_CAPTURE_URL_LENGTH) {
      return `url must be at most ${MAX_CAPTURE_URL_LENGTH} characters`;
    }
    return { kind, url, spaceId: space };
  }
  if (kind === "image") {
    if (
      typeof storageId !== "string" ||
      storageId === "" ||
      storageId.length > 128
    ) {
      return "storageId is required";
    }
    if (
      aspectRatio !== undefined &&
      aspectRatio !== null &&
      (typeof aspectRatio !== "number" ||
        !Number.isFinite(aspectRatio) ||
        aspectRatio <= 0)
    ) {
      return "aspectRatio must be a positive number";
    }
    if (text !== undefined && text !== null && typeof text !== "string") {
      return "text must be a string";
    }
    return {
      kind,
      storageId,
      aspectRatio: typeof aspectRatio === "number" ? aspectRatio : undefined,
      // Context is advisory, so overlong context is cut instead of refused.
      text:
        typeof text === "string"
          ? text.slice(0, MAX_CAPTURE_CONTEXT_LENGTH)
          : undefined,
      spaceId: space,
    };
  }
  return 'kind must be "note", "link", or "image"';
}

/**
 * Native App Intents (Siri) capture endpoint. Authenticated by a per-device
 * capture token minted by `appIntents.issueCaptureToken`, not a Clerk JWT.
 */
http.route({
  path: "/app-intents/upload-url",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = bearerToken(request);
    if (token === undefined) {
      return json(401, { error: "Missing or invalid capture token" });
    }
    const uploadUrl = await ctx.runMutation(
      internal.appIntents.generateUploadUrlInternal,
      { tokenHash: await sha256Hex(token) },
    );
    if (uploadUrl === null) {
      return json(401, { error: "Missing or invalid capture token" });
    }
    return json(200, { uploadUrl });
  }),
});

http.route({
  path: "/app-intents/capture",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = bearerToken(request);
    if (token === undefined) {
      return json(401, { error: "Missing or invalid capture token" });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "Body must be valid JSON" });
    }
    // What Siri handed the intent (types and lengths, never content), so the
    // shapes different apps and browsers send can be read from the logs.
    const trace = (body as { trace?: unknown } | null)?.trace;
    if (typeof trace === "string" && trace !== "") {
      console.log(`app-intents capture trace: ${trace.slice(0, MAX_TRACE_LENGTH)}`);
    }
    const payload = parseCaptureBody(body);
    if (typeof payload === "string") {
      return json(400, { error: payload });
    }

    const tokenHash = await sha256Hex(token);
    let result: { itemId: Id<"items"> } | null;
    try {
      result = await ctx.runMutation(internal.appIntents.captureInternal, {
        tokenHash,
        kind: payload.kind,
        text: payload.kind === "link" ? undefined : payload.text,
        url: payload.kind === "link" ? payload.url : undefined,
        storageId: payload.kind === "image" ? payload.storageId : undefined,
        aspectRatio: payload.kind === "image" ? payload.aspectRatio : undefined,
        spaceId: payload.spaceId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Capture failed";
      return json(400, { error: message });
    }
    if (result === null) {
      return json(401, { error: "Missing or invalid capture token" });
    }
    return json(200, { itemId: result.itemId });
  }),
});

export default http;
