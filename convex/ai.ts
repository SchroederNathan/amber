"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { generateObject } from "ai";
import { z } from "zod";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// Bare model-id strings route through the Vercel AI Gateway automatically
// (authenticated via the AI_GATEWAY_API_KEY deployment env var).
const MODEL = "google/gemini-3.1-flash-lite";

const SYSTEM_PROMPT =
  "You are the classifier for Amber, a save-it-for-later app. Titles must be short and " +
  "punchy — like a label on a folder, not a headline. Aim for 2-4 words, never a full " +
  "sentence, and never end with a period.";

// The closed set of intent kinds the model may emit. Kept in sync with the
// Convex validator in items.ts; anything outside this set is dropped before
// finalize so a hallucinated kind can never reach the DB.
const INTENT_KINDS = [
  "open_url",
  "copy",
  "web_search",
  "open_maps",
  "call",
  "email",
  "message",
  "add_event",
] as const;

// Appended to every classification prompt. Describes the catalog and the rules
// that keep intents genuinely useful (and, for social posts, honest).
const INTENTS_PROMPT_BLOCK = [
  "Also propose up to 5 useful actions ('intents') the user could take on this item. Only include ones that clearly apply — an empty list is fine, and do not pad. Each intent has a kind, a short label (1-3 words, no trailing punctuation), and a value (the payload). Available kinds:",
  "- open_url: open a link, or deep-link into a native app (a social post, video, profile, product page). value must be a full https:// URL. For a social post in a screenshot, if you can clearly read the @handle, link to that profile (e.g. https://x.com/HANDLE) — NEVER invent a post/status id you cannot actually see. If the saved item already has a URL pointing at a specific post, use that exact URL.",
  "- copy: copy a short, specific string to the clipboard (an address, code, wallet/handle, quoted line). Put the exact text in value.",
  "- web_search: search the web. value is the query.",
  "- open_maps: open a place in maps. value is a place name or address.",
  "- call: call a phone number. value is the phone number.",
  "- message: text a phone number. value is the phone number.",
  "- email: email someone. value is the email address.",
  "- add_event: add a calendar event. value is the event title.",
  "Give each a concrete label like 'Open in X', 'Copy address', 'Call', or 'Add to calendar'.",
].join("\n");

// How much extracted text to feed the classifier. The model only needs enough
// to understand the piece — it doesn't read the whole thing.
const MAX_CONTENT_CHARS = 8000;
// How much of the article body to store & render. Kept well under Convex's
// 1MB document limit; long-form essays run tens of thousands of chars.
const MAX_STORED_CONTENT_CHARS = 100000;

// ---------------------------------------------------------------------------
// HTML extraction
// ---------------------------------------------------------------------------

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      const n = parseInt(code, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“");
}

/** Find the content of a meta tag by property/name, tolerant of attribute order. */
function extractMetaContent(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]*(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1].trim() !== "") {
      return decodeEntities(match[1].trim());
    }
  }
  return undefined;
}

/**
 * Read the pixel dimensions straight from an image file's header bytes.
 * Covers PNG, GIF, WebP (VP8/VP8L/VP8X) and JPEG — no dependencies. Returns
 * undefined for formats we don't recognize or truncated buffers.
 */
function readImageSize(
  buf: Uint8Array,
): { width: number; height: number } | undefined {
  // PNG — IHDR width/height are big-endian uint32 at offset 16/20.
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    const width = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
    const height = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
    return { width, height };
  }
  // GIF — little-endian uint16 at offset 6/8.
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf[6] | (buf[7] << 8), height: buf[8] | (buf[9] << 8) };
  }
  // WebP — RIFF container tagged "WEBP", three sub-formats.
  if (
    buf.length >= 30 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    const fourCC = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (fourCC === "VP8 ") {
      const width = (buf[26] | (buf[27] << 8)) & 0x3fff;
      const height = (buf[28] | (buf[29] << 8)) & 0x3fff;
      return { width, height };
    }
    if (fourCC === "VP8L") {
      const b0 = buf[21];
      const b1 = buf[22];
      const b2 = buf[23];
      const b3 = buf[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
    if (fourCC === "VP8X") {
      const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width, height };
    }
  }
  // JPEG — walk segments to the start-of-frame marker.
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = (buf[offset + 5] << 8) | buf[offset + 6];
        const width = (buf[offset + 7] << 8) | buf[offset + 8];
        return { width, height };
      }
      const segLen = (buf[offset + 2] << 8) | buf[offset + 3];
      if (segLen <= 0) {
        break;
      }
      offset += 2 + segLen;
    }
  }
  return undefined;
}

/** Fetch just enough of an image to read its real width/height ratio. */
async function fetchImageAspectRatio(
  imageUrl: string,
): Promise<number | undefined> {
  try {
    const response = await fetch(imageUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        // Header bytes live at the front; 128KB covers even large EXIF blocks.
        Range: "bytes=0-131071",
      },
    });
    if (!response.ok && response.status !== 206) {
      return undefined;
    }
    const size = readImageSize(new Uint8Array(await response.arrayBuffer()));
    if (size && size.width > 0 && size.height > 0) {
      return size.width / size.height;
    }
  } catch {
    // Best-effort — a missing ratio just falls back to a sensible default.
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const ogTitle = extractMetaContent(html, "og:title");
  if (ogTitle) {
    return ogTitle;
  }
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match) {
    const title = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
    if (title !== "") {
      return title;
    }
  }
  return undefined;
}

/** Strip whole elements (including content) for the given tag names. */
function stripElements(html: string, tags: string[]): string {
  let out = html;
  for (const tag of tags) {
    out = out.replace(
      new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"),
      " ",
    );
  }
  return out;
}

function htmlToText(html: string): string {
  let text = html;
  // Block-level boundaries become paragraph breaks.
  text = text.replace(/<\/(p|div|section|h[1-6]|li|blockquote|tr|figcaption|pre)>/gi, "\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "- ");
  // Drop every remaining tag.
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  // Collapse intra-line whitespace, keep paragraph breaks.
  text = text
    .split(/\n{2,}/)
    .map((para) => para.replace(/[ \t]+/g, " ").replace(/\n/g, " ").trim())
    .filter((para) => para !== "")
    .join("\n\n");
  return text.slice(0, MAX_STORED_CONTENT_CHARS);
}

/**
 * Fallback extractor: crude tag-scoping + tag-stripping. Only used when
 * Readability can't isolate an article (e.g. malformed markup). It leaks page
 * chrome (nav menus, share counts, captions) on many sites, which is exactly
 * why Readability is preferred.
 */
function extractBodyTextRegex(html: string): string {
  let scope = html;
  const article = html.match(/<article[\s\S]*?<\/article>/i);
  if (article) {
    scope = article[0];
  } else {
    const main = html.match(/<main[\s\S]*?<\/main>/i);
    if (main) {
      scope = main[0];
    } else {
      const body = html.match(/<body[\s\S]*<\/body>/i);
      if (body) {
        scope = body[0];
      }
    }
  }
  scope = stripElements(scope, [
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "iframe",
    "template",
  ]);
  scope = scope.replace(/<!--[\s\S]*?-->/g, " ");
  return htmlToText(scope);
}

/**
 * Extract the readable article body. Mozilla Readability (the engine behind
 * Firefox Reader View) scores DOM blocks by text density and link ratio to
 * isolate the real article, discarding nav, ads, share widgets, comment
 * counts, captions, and other boilerplate — so it works across arbitrary
 * article pages rather than one site's markup. We feed its cleaned article
 * HTML through htmlToText to get the paragraph-separated plain text the client
 * renders. Falls back to the regex extractor if Readability finds nothing
 * (e.g. non-article pages or JS-rendered shells with no server-side content).
 */
function extractBodyText(html: string, url: string): string {
  try {
    const { document } = parseHTML(html);
    // Give Readability a base URL so it can resolve/keep links correctly.
    try {
      const base = document.createElement("base");
      base.setAttribute("href", url);
      document.head?.appendChild(base);
    } catch {
      // Non-fatal — Readability still parses without a <base>.
    }
    const article = new Readability(document).parse();
    if (article?.content) {
      const text = htmlToText(article.content);
      if (text.trim() !== "") {
        return text;
      }
    }
  } catch {
    // Fall through to the regex extractor below.
  }
  return extractBodyTextRegex(html);
}

type PageData = {
  title?: string;
  description?: string;
  heroImageUrl?: string;
  heroAspectRatio?: number;
  siteName?: string;
  content?: string;
};

async function fetchPage(url: string): Promise<PageData> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }
  const finalUrl = response.url || url;
  const html = await response.text();

  const title = extractTitle(html);
  const description =
    extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description");

  let heroImageUrl =
    extractMetaContent(html, "og:image") ??
    extractMetaContent(html, "og:image:url") ??
    extractMetaContent(html, "twitter:image");
  if (heroImageUrl) {
    try {
      heroImageUrl = new URL(heroImageUrl, finalUrl).toString();
    } catch {
      heroImageUrl = undefined;
    }
  }

  // Match the preview to the OG image's real shape. Prefer the dimensions the
  // page declares; if absent, read them from the image file itself.
  let heroAspectRatio: number | undefined;
  if (heroImageUrl) {
    const ogWidth = Number(extractMetaContent(html, "og:image:width"));
    const ogHeight = Number(extractMetaContent(html, "og:image:height"));
    if (
      Number.isFinite(ogWidth) &&
      Number.isFinite(ogHeight) &&
      ogWidth > 0 &&
      ogHeight > 0
    ) {
      heroAspectRatio = ogWidth / ogHeight;
    } else {
      heroAspectRatio = await fetchImageAspectRatio(heroImageUrl);
    }
  }

  let siteName = extractMetaContent(html, "og:site_name");
  if (!siteName) {
    try {
      siteName = new URL(finalUrl).hostname.replace(/^www\./, "");
    } catch {
      siteName = undefined;
    }
  }

  const content = extractBodyText(html, finalUrl);

  return {
    title,
    description,
    heroImageUrl,
    heroAspectRatio,
    siteName,
    content: content !== "" ? content : undefined,
  };
}

// ---------------------------------------------------------------------------
// AI classification
// ---------------------------------------------------------------------------

const intentSchema = z.object({
  kind: z
    .enum(INTENT_KINDS)
    .describe(
      "The action type. open_url: open a link / deep-link into a native app via an https URL. copy: copy exact text. web_search: search a term. open_maps: open a place. call/message: a phone number. email: an email address. add_event: add a calendar event.",
    ),
  label: z
    .string()
    .describe(
      "Short button text, 1-3 words, e.g. 'Open in X', 'Copy address', 'Call'. No trailing punctuation.",
    ),
  value: z
    .string()
    .describe(
      "The payload. open_url: a real https:// URL you can actually see (never a guessed id). copy: the exact text. web_search: the query. open_maps: place/address. call/message: phone number. email: email address. add_event: event title.",
    ),
});

const itemAnalysisSchema = z.object({
  title: z
    .string()
    .describe(
      "A very short title, ideally 2-4 words and never more than ~6. No trailing punctuation, no full sentences.",
    ),
  description: z
    .string()
    .describe("A 1-2 sentence summary of what this item is"),
  tags: z
    .array(z.string())
    .describe("4-8 lowercase tags, each one or two words"),
  spaceNames: z
    .array(z.string())
    .describe(
      "The names of the provided spaces this item clearly belongs to; empty if none match",
    ),
  intents: z
    .array(intentSchema)
    .describe(
      "0-5 pressable actions that would be genuinely useful for this item. Empty if none clearly apply; do not pad.",
    ),
});

type Intent = z.infer<typeof intentSchema>;

const ALLOWED_INTENT_KINDS = new Set<string>(INTENT_KINDS);

/**
 * Clean the model's proposed intents before they're persisted: drop unknown
 * kinds, trim/limit text, require a plausible payload per kind (open_url must
 * be http(s); email needs an @; call/message need a digit), dedupe, and cap the
 * count. A rejected intent is simply omitted — never fails the whole finalize.
 */
function sanitizeIntents(raw: Intent[] | undefined): Intent[] {
  const seen = new Set<string>();
  return (raw ?? [])
    .filter((i) => ALLOWED_INTENT_KINDS.has(i.kind))
    .map((i) => ({
      kind: i.kind,
      label: i.label.trim().slice(0, 40),
      value: i.value.trim(),
    }))
    .filter((i) => i.label !== "" && i.value !== "")
    .filter((i) => {
      switch (i.kind) {
        case "open_url":
          return /^https?:\/\//i.test(i.value);
        case "email":
          return i.value.includes("@");
        case "call":
        case "message":
          return /\d/.test(i.value);
        default:
          return true;
      }
    })
    .filter((i) => {
      const key = `${i.kind}|${i.value.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function spacesPromptBlock(
  spaces: { name: string; description?: string }[],
): string {
  if (spaces.length === 0) {
    return "The user has no spaces yet, so spaceNames must be an empty array.";
  }
  const lines = spaces
    .map(
      (s) => `- "${s.name}"${s.description ? `: ${s.description}` : ""}`,
    )
    .join("\n");
  return `The user organizes items into spaces. Candidate spaces:\n${lines}\n\nIn spaceNames, include only the exact names of spaces this item CLEARLY belongs to. Only include confident matches. If none clearly match, return an empty array.`;
}

export const processItem = internalAction({
  args: { itemId: v.id("items") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const item = await ctx.runQuery(internal.items.getItemInternal, {
        itemId: args.itemId,
      });
      if (item === null) {
        return null;
      }
      const spaces = await ctx.runQuery(internal.spaces.listSpacesInternal, {
        userId: item.userId,
      });
      const spacesBlock = spacesPromptBlock(spaces);

      let page: PageData | undefined;
      let result: z.infer<typeof itemAnalysisSchema>;

      if (item.type === "link") {
        if (!item.url) {
          throw new Error("Link item has no url");
        }
        page = await fetchPage(item.url);
        const { object } = await generateObject({
          model: MODEL,
          system: SYSTEM_PROMPT,
          schema: itemAnalysisSchema,
          prompt: [
            "You are helping organize a save-it-for-later app. Analyze this saved web page and produce a title, a 1-2 sentence description, 4-8 lowercase tags (one or two words each), and matching space names.",
            spacesBlock,
            `URL: ${item.url}`,
            page.title ? `Page title: ${page.title}` : "",
            page.siteName ? `Site: ${page.siteName}` : "",
            page.description ? `Meta description: ${page.description}` : "",
            page.content
              ? `Page content:\n${page.content.slice(0, 6000)}`
              : "No page content could be extracted.",
            INTENTS_PROMPT_BLOCK,
          ]
            .filter((line) => line !== "")
            .join("\n\n"),
        });
        result = object;
      } else if (item.type === "image") {
        if (!item.storageId) {
          throw new Error("Image item has no storageId");
        }
        const imageUrl = await ctx.storage.getUrl(item.storageId);
        if (imageUrl === null) {
          throw new Error("Image file not found in storage");
        }
        const { object } = await generateObject({
          model: MODEL,
          system: SYSTEM_PROMPT,
          schema: itemAnalysisSchema,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: [
                    "You are helping organize a save-it-for-later app. Analyze this saved image and produce a short evocative title, a 1-2 sentence description of what it shows, 4-8 lowercase tags (one or two words each), and matching space names.",
                    spacesBlock,
                    INTENTS_PROMPT_BLOCK,
                  ].join("\n\n"),
                },
                { type: "image", image: new URL(imageUrl) },
              ],
            },
          ],
        });
        result = object;
      } else {
        if (!item.note) {
          throw new Error("Note item has no text");
        }
        const { object } = await generateObject({
          model: MODEL,
          system: SYSTEM_PROMPT,
          schema: itemAnalysisSchema,
          prompt: [
            "You are helping organize a save-it-for-later app. Analyze this saved note and produce a short evocative title, a 1-2 sentence description, 4-8 lowercase tags (one or two words each), and matching space names.",
            spacesBlock,
            `Note:\n${item.note.slice(0, MAX_CONTENT_CHARS)}`,
            INTENTS_PROMPT_BLOCK,
          ].join("\n\n"),
        });
        result = object;
      }

      // Map returned space names back to ids (case-insensitive, trimmed).
      const spaceIdByName = new Map(
        spaces.map((s) => [s.name.trim().toLowerCase(), s._id]),
      );
      const spaceIds: Id<"spaces">[] = [];
      for (const name of result.spaceNames) {
        const id = spaceIdByName.get(name.trim().toLowerCase());
        if (id !== undefined) {
          spaceIds.push(id);
        }
      }

      await ctx.runMutation(internal.items.finalizeItem, {
        itemId: args.itemId,
        title: result.title,
        description: result.description,
        tags: result.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
        content: item.type === "link" ? page?.content : undefined,
        siteName: item.type === "link" ? page?.siteName : undefined,
        heroImageUrl: item.type === "link" ? page?.heroImageUrl : undefined,
        // Links: the OG image's shape. Images/notes: preserve the ratio the
        // client captured on upload (patching undefined would drop the field).
        aspectRatio:
          item.type === "link" ? page?.heroAspectRatio : item.aspectRatio,
        intents: sanitizeIntents(result.intents),
        status: "ready",
      });
      if (spaceIds.length > 0) {
        await ctx.runMutation(internal.items.setSpacesForItem, {
          itemId: args.itemId,
          spaceIds,
        });
      }
    } catch (error) {
      console.error(`processItem failed for ${args.itemId}:`, error);
      await ctx.runMutation(internal.items.failItem, { itemId: args.itemId });
    }
    return null;
  },
});

/**
 * One-off: fill in aspectRatio for existing image items that don't have one
 * (older saves whose ratio was dropped before it was persisted). Reads the
 * stored file's header bytes directly — no re-upload needed.
 */
export const backfillImageAspectRatios = internalAction({
  args: {},
  returns: v.object({ scanned: v.number(), updated: v.number() }),
  handler: async (ctx): Promise<{ scanned: number; updated: number }> => {
    const targets = await ctx.runQuery(
      internal.items.listImagesNeedingRatioInternal,
      {},
    );
    let updated = 0;
    for (const target of targets) {
      const blob = await ctx.storage.get(target.storageId);
      if (blob === null) {
        continue;
      }
      const size = readImageSize(new Uint8Array(await blob.arrayBuffer()));
      if (size && size.width > 0 && size.height > 0) {
        await ctx.runMutation(internal.items.setAspectRatioInternal, {
          itemId: target._id,
          aspectRatio: size.width / size.height,
        });
        updated++;
      }
    }
    return { scanned: targets.length, updated };
  },
});

const reclassifySchema = z.object({
  itemNumbers: z
    .array(z.number().int())
    .describe(
      "The numbers of the items that clearly belong in this space; empty if none",
    ),
});

export const reclassifyForNewSpace = internalAction({
  args: { spaceId: v.id("spaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const space = await ctx.runQuery(internal.spaces.getSpaceInternal, {
        spaceId: args.spaceId,
      });
      if (space === null) {
        return null;
      }
      const items = await ctx.runQuery(internal.items.listReadyItemsInternal, {
        userId: space.userId,
        limit: 100,
      });
      if (items.length === 0) {
        return null;
      }

      const itemLines = items
        .map((item, i) => {
          const parts = [
            item.title ?? "(untitled)",
            item.description ?? "",
            item.tags.length > 0 ? `tags: ${item.tags.join(", ")}` : "",
          ].filter((p) => p !== "");
          return `${i + 1}. ${parts.join(" — ")}`;
        })
        .join("\n");

      const { object } = await generateObject({
        model: MODEL,
        schema: reclassifySchema,
        prompt: [
          "You are helping organize a save-it-for-later app. The user just created a new space (a themed collection).",
          `Space name: "${space.name}"${space.description ? `\nSpace description: ${space.description}` : ""}`,
          "Below is a numbered list of the user's saved items. Return the numbers of the items that CLEARLY belong in this space. Only include confident matches; if nothing clearly fits, return an empty array.",
          itemLines,
        ].join("\n\n"),
      });

      const itemIds: Id<"items">[] = [];
      for (const n of object.itemNumbers) {
        if (Number.isInteger(n) && n >= 1 && n <= items.length) {
          itemIds.push(items[n - 1]._id);
        }
      }
      if (itemIds.length > 0) {
        await ctx.runMutation(internal.items.addItemsToSpace, {
          spaceId: args.spaceId,
          itemIds,
        });
      }
    } catch (error) {
      console.error(
        `reclassifyForNewSpace failed for ${args.spaceId}:`,
        error,
      );
    }
    return null;
  },
});
