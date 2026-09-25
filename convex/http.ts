import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_TOKEN_LENGTH, sha256Hex } from "./model/tokens";
import {
  MAX_CAPTURE_NOTE_LENGTH,
  MAX_CAPTURE_URL_LENGTH,
} from "./appIntents";

const http = httpRouter();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type CapturePayload =
  | { kind: "note"; text: string; spaceId?: string }
  | { kind: "link"; url: string; spaceId?: string };

/** Validates the untrusted JSON body. Returns an error message on bad input. */
function parseCaptureBody(body: unknown): CapturePayload | string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "Body must be a JSON object";
  }
  const { kind, text, url, spaceId } = body as Record<string, unknown>;
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
  return 'kind must be "note" or "link"';
}

/**
 * Native App Intents (Siri) capture endpoint. Authenticated by a per-device
 * capture token minted by `appIntents.issueCaptureToken`, not a Clerk JWT.
 */
http.route({
  path: "/app-intents/capture",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(
      request.headers.get("Authorization") ?? "",
    );
    const token = match?.[1];
    if (token === undefined || token.length > MAX_TOKEN_LENGTH) {
      return json(401, { error: "Missing or invalid capture token" });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "Body must be valid JSON" });
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
        text: payload.kind === "note" ? payload.text : undefined,
        url: payload.kind === "link" ? payload.url : undefined,
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
