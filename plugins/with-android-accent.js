// AppCompat's accent tints Android dialogs and the text cursor; left unset it
// falls back to stock teal. Native resources are fixed at build time, so they
// take the default scheme's `tint` (accent text on the canvas) per mode.
const { AndroidConfig, withAndroidColors, withAndroidColorsNight, withAndroidStyles } = require('expo/config-plugins');
const loadTheme = require('./load-theme');

module.exports = function withAndroidAccent(config) {
  const { buildColors, colorSchemes, defaultColorScheme } = loadTheme();
  const tint = (mode) => buildColors(colorSchemes[defaultColorScheme], mode).tint;
  const setAccent = (value) => (colors) =>
    AndroidConfig.Colors.assignColorValue(colors, { name: 'colorAccent', value });

  config = withAndroidColors(config, (mod) => {
    mod.modResults = setAccent(tint('light'))(mod.modResults);
    return mod;
  });
  config = withAndroidColorsNight(config, (mod) => {
    mod.modResults = setAccent(tint('dark'))(mod.modResults);
    return mod;
  });
  return withAndroidStyles(config, (mod) => {
    mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'colorAccent',
      value: '@color/colorAccent',
    });
    return mod;
  });
};
