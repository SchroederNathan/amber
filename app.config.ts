import { ExpoConfig, ConfigContext } from "expo/config";

const appName = "Amber";

const APP_ID_PREFIX = "com.schroedernathan";

function getName(base: string) {
  switch (process.env.APP_VARIANT) {
    case "production":
      return base;
    case "preview":
      return `${base} (Preview)`;
    default:
      return `${base} (Dev)`;
  }
}

function getAppId() {
  switch (process.env.APP_VARIANT) {
    // Must stay `com.schroedernathan.amber`: it is the App Store Connect
    // record, and Clerk verifies the Apple identity token's `aud` claim
    // against this exact bundle identifier for native Sign in with Apple.
    case "production":
      return `${APP_ID_PREFIX}.amber`;
    case "preview":
      return `${APP_ID_PREFIX}.preview`;
    default:
      return `${APP_ID_PREFIX}.dev`;
  }
}

function getIcon() {
  switch (process.env.APP_VARIANT) {
    case "production":
      return undefined; // production keeps the icons from app.json
    default:
      return "./assets/icon-dev.png";
  }
}

const icon = getIcon();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getName(config.name ?? "Amber"),
  slug: "amber",
  runtimeVersion: {
    // Automatic production OTA delivery needs a native compatibility
    // boundary even when the marketing version stays the same. Development
    // and preview builds keep the appVersion runtime.
    policy: process.env.APP_VARIANT === "production" ? "fingerprint" : "appVersion",
  },
  updates: {
    ...config.updates,
    url: `https://u.expo.dev/${config.extra?.eas?.projectId}`,
  },
  extra: {
    ...config.extra,
    variant: process.env.APP_VARIANT ?? "unset",
  },
  icon: icon ?? config.icon,
  ios: {
    ...config.ios,
    deploymentTarget: "17.0",
    bundleIdentifier: getAppId(),
    icon: icon ?? config.ios?.icon,
  },
  android: {
    ...config.android,
    package: getAppId(),
  },
  plugins: [
    // Keep the static plugins from app.json — an inline array here would
    // silently replace them (expo-font, expo-router, expo-sharing, …).
    ...(config.plugins ?? []),
    [
      "expo-build-properties",
      {
        ios: {
          enableSceneSupport: true,
        },
      },
    ],
    [
      "expo-dev-client",
      {
        addGeneratedScheme: process.env.APP_VARIANT === "development",
      },
    ],
    [
      "expo-widgets",
      {
        widgets: [
          {
            name: "RecentSaves",
            displayName: "Recent Saves",
            description: "Your latest saves, at a glance.",
            supportedFamilies: ["systemSmall", "systemMedium"],
            contentMarginsDisabled: true,
          },
        ],
      },
    ],
    "./plugins/with-android-accent",
  ],
});
