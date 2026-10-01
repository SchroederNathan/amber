import { v, type Infer } from "convex/values";

// The colors a note can be saved in, in picker order. The client draws each
// one from its theme (src/theme/colors.ts), so only the names live here.
export const NOTE_COLORS = ["yellow", "green", "blue", "pink"] as const;

export const noteColorValidator = v.union(
  v.literal("yellow"),
  v.literal("green"),
  v.literal("blue"),
  v.literal("pink"),
);

export type NoteColor = Infer<typeof noteColorValidator>;
