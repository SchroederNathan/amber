// Neutral black shadows read on every scheme, so they aren't derived from one.
export const shadows = {
  sticker: '0 3px 8px rgba(0, 0, 0, 0.18)',
  raised: '0 1px 4px rgba(0, 0, 0, 0.12)',
  camera: '0 2px 12px rgba(0, 0, 0, 0.4)',
  photoStack: '0 6px 14px rgba(0, 0, 0, 0.22)',
  text: { textShadowColor: 'rgba(0, 0, 0, 0.35)', textShadowRadius: 6 },
} as const;
