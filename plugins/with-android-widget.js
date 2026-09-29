// Native resources for the Android "Recent Saves" widget
// (src/widgets/recent-saves-widget.android.tsx), which expo-widgets generates:
// - drawables from assets/widgets/android: Glance widgets can't draw SF Symbols
//   or gradients, so the icons (Material Symbols) and the photo scrim are
//   resources;
// - the widget picker preview (layout/amber_widget_preview.xml). Without one
//   the picker shows only the app icon. It takes the default scheme's colors
//   per mode, like the accent in with-android-accent.
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withDangerousMod,
  withFinalizedMod,
} = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const loadTheme = require('./load-theme');

const WIDGET_INFO = 'app/src/main/res/xml/recent_saves_info.xml';

module.exports = function withAndroidWidget(config) {
  const { buildColors, colorSchemes, defaultColorScheme } = loadTheme();
  const setColors = (mode) => (colors) => {
    const c = buildColors(colorSchemes[defaultColorScheme], mode);
    const roles = {
      background: c.background,
      tile: c.surfaceMuted,
      foreground: c.foreground,
      muted: c.muted,
      accent: c.tint,
    };
    for (const [role, value] of Object.entries(roles)) {
      colors = AndroidConfig.Colors.assignColorValue(colors, { name: `amber_widget_${role}`, value });
    }
    return colors;
  };

  config = withAndroidColors(config, (mod) => {
    mod.modResults = setColors('light')(mod.modResults);
    return mod;
  });
  config = withAndroidColorsNight(config, (mod) => {
    mod.modResults = setColors('dark')(mod.modResults);
    return mod;
  });

  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const source = path.join(mod.modRequest.projectRoot, 'assets/widgets/android');
      const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
      for (const folder of ['drawable', 'layout']) {
        await fs.mkdir(path.join(res, folder), { recursive: true });
        for (const name of await fs.readdir(path.join(source, folder))) {
          await fs.copyFile(path.join(source, folder, name), path.join(res, folder, name));
        }
      }
      return mod;
    },
  ]);

  // expo-widgets writes the provider info in its own dangerous mod and has no
  // option for a preview, so add it once every other mod has run.
  return withFinalizedMod(config, [
    'android',
    async (mod) => {
      const file = path.join(mod.modRequest.platformProjectRoot, WIDGET_INFO);
      const xml = await fs.readFile(file, 'utf8');
      if (!xml.includes('android:previewLayout')) {
        await fs.writeFile(
          file,
          xml.replace('<appwidget-provider ', '<appwidget-provider android:previewLayout="@layout/amber_widget_preview" '),
        );
      }
      return mod;
    },
  ]);
};
