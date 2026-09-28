// The launch screen is only the canvas color: the JS splash (`src/lib/splash`)
// shows the wordmark, and the biometric lock shows it again. With no image,
// expo-splash-screen strips the logo from the iOS storyboard but leaves the
// system background (pure white / black) and the logo's constraints. Point the
// view at the plugin's `SplashScreenBackground` color set, which carries the
// light and dark colors from app.json.
const { withFinalizedMod, XML } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = function withPlainSplash(config) {
  return withFinalizedMod(config, [
    'ios',
    async (mod) => {
      const { platformProjectRoot, projectName } = mod.modRequest;
      const file = path.join(platformProjectRoot, projectName, 'SplashScreen.storyboard');
      const xml = await XML.readXMLAsync({ path: file });
      const view = xml.document.scenes[0].scene[0].objects[0].viewController[0].view[0];
      view.constraints = [];
      view.color = [{ $: { key: 'backgroundColor', name: 'SplashScreenBackground' } }];
      xml.document.resources[0] = { namedColor: [{ $: { name: 'SplashScreenBackground' } }] };
      await fs.writeFile(file, `<?xml version="1.0" encoding="UTF-8"?>\n${XML.format(xml)}\n`);
      return mod;
    },
  ]);
};
