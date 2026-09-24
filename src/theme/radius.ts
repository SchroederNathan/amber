// Soft, capsule-adjacent corners to match the capsule buttons. Steps are
// concentric: a matted photo's inner radius is its frame's radius minus the
// mat (md 20 - 4pt mat = sm 16; lg 28 - 8pt mat = md 20).
export const radius = {
  sm: 16,
  md: 20,
  lg: 28,
  xl: 32,
  full: 9999,
} as const;
