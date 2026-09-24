export const fonts = {
  regular: 'Satoshi-Regular',
  medium: 'Satoshi-Medium',
  bold: 'Satoshi-Bold',
  display: 'ExposureTrial-0',
} as const;

// Amber's type ramp. Each step names a role and a bundled font file (one file
// per weight, so no `fontWeight`). Screens pick a step; they never set sizes.
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 48 },
  largeTitle: { fontFamily: fonts.display, fontSize: 26 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 24 },
  title: { fontFamily: fonts.display, fontSize: 22 },
  header: { fontFamily: fonts.display, fontSize: 19 },
  displaySmall: { fontFamily: fonts.display, fontSize: 18 },
  reader: { fontFamily: fonts.regular, fontSize: 18 },
  headline: { fontFamily: fonts.bold, fontSize: 17 },
  body: { fontFamily: fonts.regular, fontSize: 16 },
  bodyLabel: { fontFamily: fonts.medium, fontSize: 16 },
  button: { fontFamily: fonts.bold, fontSize: 16 },
  subhead: { fontFamily: fonts.regular, fontSize: 15 },
  subheadLabel: { fontFamily: fonts.medium, fontSize: 15 },
  subheadStrong: { fontFamily: fonts.bold, fontSize: 15 },
  footnote: { fontFamily: fonts.regular, fontSize: 14 },
  secondaryLabel: { fontFamily: fonts.medium, fontSize: 14 },
  caption: { fontFamily: fonts.regular, fontSize: 13 },
  label: { fontFamily: fonts.medium, fontSize: 13 },
  labelStrong: { fontFamily: fonts.bold, fontSize: 13 },
  captionLabel: { fontFamily: fonts.medium, fontSize: 12 },
  captionStrong: { fontFamily: fonts.bold, fontSize: 12 },
  finePrint: { fontFamily: fonts.regular, fontSize: 11 },
  badge: { fontFamily: fonts.bold, fontSize: 10 },
} as const;
