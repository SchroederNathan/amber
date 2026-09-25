import AppIntents
internal import ExpoAppIntents
import Foundation

// Intents that open Amber at a screen. Each one queues an invocation that
// `src/lib/app-intents.tsx` turns into a router navigation.

#if compiler(>=6.4)
/// "Find the ramen place I saved in Amber." Opens Search with the query.
@available(iOS 27.0, *)
@AppIntent(schema: .system.searchInApp)
struct SearchAmberIntent {
  static let searchScopes: [StringSearchScope] = [.general]

  var criteria: StringSearchCriteria

  @MainActor
  func perform() async throws -> some IntentResult {
    AmberIntentLog.record("SearchAmberIntent.perform term=\(criteria.term)")
    await AppIntentDispatcher.shared.dispatch(name: "search", params: ["query": .string(criteria.term)])
    return .result()
  }
}

/// Opens a saved item, from Siri ("open that recipe I saved") or a Spotlight result.
@available(iOS 27.0, *)
@AppIntent(schema: .system.open)
struct OpenItemIntent {
  var target: ItemEntity

  @MainActor
  func perform() async throws -> some IntentResult {
    AmberIntentLog.record("OpenItemIntent.perform \(target.id)")
    await AppIntentDispatcher.shared.dispatch(name: "openItem", params: ["id": .string(target.id)])
    return .result()
  }
}

/// "Open my Tokyo trip space in Amber."
@available(iOS 27.0, *)
@AppIntent(schema: .system.open)
struct OpenSpaceIntent {
  var target: SpaceEntity

  @MainActor
  func perform() async throws -> some IntentResult {
    AmberIntentLog.record("OpenSpaceIntent.perform \(target.id)")
    await AppIntentDispatcher.shared.dispatch(name: "openSpace", params: ["id": .string(target.id)])
    return .result()
  }
}
#endif
