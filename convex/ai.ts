"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { generateObject } from "ai";
import { z } from "zod";

// Bare model-id strings route through the Vercel AI Gateway automatically
// (authenticated via the AI_GATEWAY_API_KEY deployment env var).
const MODEL = "google/gemini-2.5-flash-lite";

const MAX_CONTENT_CHARS = 8000;

// ---------------------------------------------------------------------------
// HTML extraction (hand-rolled, no extra deps)
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
  return text.slice(0, MAX_CONTENT_CHARS);
}

function extractBodyText(html: string): string {
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

type PageData = {
  title?: string;
  description?: string;
  heroImageUrl?: string;
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

  let heroImageUrl = extractMetaContent(html, "og:image");
  if (heroImageUrl) {
    try {
      heroImageUrl = new URL(heroImageUrl, finalUrl).toString();
    } catch {
      heroImageUrl = undefined;
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

  const content = extractBodyText(html);

  return {
    title,
    description,
    heroImageUrl,
    siteName,
    content: content !== "" ? content : undefined,
  };
}

// ---------------------------------------------------------------------------
// AI classification
// ---------------------------------------------------------------------------

const itemAnalysisSchema = z.object({
  title: z.string().describe("A short, evocative title for the saved item"),
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
});

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
          schema: itemAnalysisSchema,
          prompt: [
            "You are helping organize a save-it-for-later app. Analyze this saved note and produce a short evocative title, a 1-2 sentence description, 4-8 lowercase tags (one or two words each), and matching space names.",
            spacesBlock,
            `Note:\n${item.note.slice(0, MAX_CONTENT_CHARS)}`,
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
