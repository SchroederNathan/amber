internal import ExpoAppIntents
import Foundation

/// Names and helpers for the entity catalogs that `src/lib/app-intents.tsx` publishes with
/// `setEntityCatalogAsync`. Keep the kinds and metadata keys in sync with that file.
enum AmberCatalog {
  static let itemKind = "item"
  static let spaceKind = "space"

  /// Every published item, newest first.
  static func items() async -> [AppIntentEntityRecord] {
    return (try? await AppIntentEntityStore.shared.entities(ofKind: itemKind)) ?? []
  }

  static func items(matching identifiers: [String]) async -> [AppIntentEntityRecord] {
    return (try? await AppIntentEntityStore.shared.entities(ofKind: itemKind, matching: identifiers)) ?? []
  }

  static func spaces() async -> [AppIntentEntityRecord] {
    return (try? await AppIntentEntityStore.shared.entities(ofKind: spaceKind)) ?? []
  }

  static func spaces(matching identifiers: [String]) async -> [AppIntentEntityRecord] {
    return (try? await AppIntentEntityStore.shared.entities(ofKind: spaceKind, matching: identifiers)) ?? []
  }

  /// Case- and accent-insensitive match of every word in `query` against the record's text.
  static func matches(_ record: AppIntentEntityRecord, query: String) -> Bool {
    let words = normalize(query).split(separator: " ")
    guard !words.isEmpty else { return true }
    let haystack = normalize(searchableText(record))
    return words.allSatisfy { haystack.contains($0) }
  }

  /// How strongly a record matches a set of Visual Intelligence labels. 0 means no match.
  static func score(_ record: AppIntentEntityRecord, labels: [String]) -> Int {
    let haystack = normalize(searchableText(record))
    var score = 0
    for label in labels {
      let words = normalize(label).split(separator: " ").filter { $0.count > 2 }
      for word in words where haystack.contains(word) {
        score += 1
      }
    }
    return score
  }

  static func searchableText(_ record: AppIntentEntityRecord) -> String {
    return ([record.title, record.subtitle ?? ""] + record.synonyms + [
      record.metadata["text"] ?? "", record.metadata["site"] ?? "", record.metadata["url"] ?? "",
    ]).joined(separator: " ")
  }

  static func normalize(_ value: String) -> String {
    return value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }
      .joined(separator: " ")
  }

  /// A small JPEG thumbnail the app wrote for this item, if any.
  static func thumbnailData(for id: String) -> Data? {
    guard let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
    else {
      return nil
    }
    let file = documents.appendingPathComponent("app-intent-thumbs/\(id).jpg")
    return try? Data(contentsOf: file)
  }
}
