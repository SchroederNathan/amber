export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

// Existing layouts use this 8pt helper; new styles use named 4pt steps above.
export const gap = (v: number) => v * 8;
