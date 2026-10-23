import AppIntents
internal import ExpoAppIntents
internal import ExpoModulesCore

/// App-target glue for expo-app-intents. Registers Amber's entity kinds (so catalogs published
/// from JavaScript reach Spotlight and on-screen awareness), and lets the signed-in app hand the
/// native capture intents their credentials. JavaScript side: `src/lib/app-intents.tsx`.
final class AppIntentsSetup: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("AppIntentsSetup")

    OnCreate {
      #if compiler(>=6.4)
      if #available(iOS 27.0, *) {
        // Use the same schema-backed save for on-screen awareness and Siri's semantic index.
        AppEntityIdentifierRegistry.shared.register(AmberCatalog.itemKind, as: NoteEntity.self)
        AppEntityIdentifierRegistry.shared.register(AmberCatalog.spaceKind, as: SpaceEntity.self)
      } else if #available(iOS 18.0, *) {
        AppEntityIdentifierRegistry.shared.register(AmberCatalog.itemKind, as: ItemEntity.self)
      }
      #else
      if #available(iOS 18.0, *) {
        // Plain registration: Spotlight indexing is done by `AmberSpotlight`, not the package.
        AppEntityIdentifierRegistry.shared.register(AmberCatalog.itemKind, as: ItemEntity.self)
      }
      #endif
      #if compiler(>=6.4)
      if #available(iOS 27.0, *) {
        Task {
          await AppIntentDispatcher.shared.setShortcutsRefreshHandler {
            AmberShortcuts.updateAppShortcutParameters()
          }
          AmberShortcuts.updateAppShortcutParameters()
        }
      }
      #endif
    }

    AsyncFunction("setCaptureCredentials") { (siteUrl: String, token: String, userId: String) in
      try AmberCapture.store(.init(siteUrl: siteUrl, token: token, userId: userId))
    }

    AsyncFunction("clearCaptureCredentials") {
      AmberCapture.clear()
      AmberIntentLog.clear()
    }

    AsyncFunction("hasCaptureCredentials") { (userId: String) -> Bool in
      return AmberCapture.load()?.userId == userId
    }

    AsyncFunction("indexItemsInSpotlight") { () async throws -> Int in
      guard #available(iOS 18.0, *) else { return 0 }
      return try await AmberSpotlight.syncItems()
    }

    AsyncFunction("getIntentLog") { () -> [String] in
      return AmberIntentLog.entries()
    }

    AsyncFunction("clearSpotlight") { () async throws in
      try await AmberSpotlight.clear()
    }
  }
}
