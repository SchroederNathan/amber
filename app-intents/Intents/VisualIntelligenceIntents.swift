import AppIntents
internal import ExpoAppIntents
import Foundation

// Visual Intelligence (camera or screenshot search, iOS 26+) shows matching Amber saves.
#if canImport(VisualIntelligence)
import VisualIntelligence

/// "More results" from a Visual Intelligence search: opens Amber's Search with the labels the
/// system recognized.
@available(iOS 26.0, *)
@AppIntent(schema: .visualIntelligence.semanticContentSearch)
struct VisualSearchIntent {
  var semanticContent: SemanticContentDescriptor

  @MainActor
  func perform() async throws -> some IntentResult {
    let query = semanticContent.labels.prefix(3).joined(separator: " ")
    AmberIntentLog.record("VisualSearchIntent.perform labels=\(semanticContent.labels)")
    await AppIntentDispatcher.shared.dispatch(name: "search", params: ["query": .string(query)])
    return .result()
  }
}

/// Answers Visual Intelligence (camera or screenshot search) with matching Amber saves.
@available(iOS 26.0, *)
struct ItemVisualQuery: IntentValueQuery {
  func values(for input: SemanticContentDescriptor) async throws -> [ItemEntity] {
    let labels = input.labels
    AmberIntentLog.record("ItemVisualQuery labels=\(labels)")
    guard !labels.isEmpty else { return [] }
    return await AmberCatalog.items()
      .map { ($0, AmberCatalog.score($0, labels: labels)) }
      .filter { $0.1 > 0 }
      .sorted { $0.1 > $1.1 }
      .prefix(12)
      .map { ItemEntity(record: $0.0) }
  }
}
#endif
