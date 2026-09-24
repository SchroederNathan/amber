// `held` is a Button's pressed and loading look: dimmed, never replaced by a spinner.
// `pressedSurface` dims large tappable surfaces (cards, tiles) less than text.
export const opacity = { pressed: 0.7, held: 0.85, pressedSurface: 0.85, disabled: 0.4 } as const;

export const control = { minHeight: 48, largeHeight: 56, pressRetentionOffset: 12 } as const;
