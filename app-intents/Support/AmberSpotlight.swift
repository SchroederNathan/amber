import AppIntents
@preconcurrency import CoreSpotlight
internal import ExpoAppIntents
import Foundation

/// Mirrors the `item` catalog into Spotlight (and so into Siri's semantic index).
///
/// expo-app-intents can do this itself with `registerIndexed`, but it rebuilds the index with
/// `deleteAppEntities(ofType:)` inside the same serial section as the catalog write, and on the
/// iOS 27 simulator that call never returns - which also blocks every later catalog write. Here the
/// catalog write stays independent, each Spotlight call has a deadline, and only removed items are
/// deleted.
enum AmberSpotlight {
  private static let indexedKey = "amber.spotlight.indexedItemIds"
  private static let batchSize = 100
  private static let deadline: Duration = .seconds(20)

  struct TimedOut: Error, CustomStringConvertible {
    let operation: String
    var description: String { "Spotlight did not finish \(operation) in time." }
  }

  /// Indexes every item in the catalog and removes items that left it. Returns the indexed count.
  @available(iOS 18.0, *)
  static func syncItems() async throws -> Int {
    let entities = await AmberCatalog.items()
      .filter { !$0.hideInSpotlight }
      .map(ItemEntity.init(record:))
    let index = CSSearchableIndex.default()
    let previous = Set(UserDefaults.standard.stringArray(forKey: indexedKey) ?? [])
    let current = Set(entities.map(\.id))

    let removed = Array(previous.subtracting(current))
    if !removed.isEmpty {
      try await withDeadline("deleting removed saves") {
        try await index.deleteAppEntities(identifiedBy: removed, ofType: ItemEntity.self)
      }
    }
    for start in stride(from: 0, to: entities.count, by: batchSize) {
      let batch = Array(entities[start..<min(start + batchSize, entities.count)])
      try await withDeadline("indexing saves") {
        try await index.indexAppEntities(batch)
      }
    }
    UserDefaults.standard.set(Array(current), forKey: indexedKey)
    return entities.count
  }

  /// Removes everything Amber put in Spotlight (sign-out, app lock).
  static func clear() async throws {
    UserDefaults.standard.removeObject(forKey: indexedKey)
    try await withDeadline("clearing saves") {
      try await CSSearchableIndex.default().deleteAllSearchableItems()
    }
  }

  /// Waits for `work` or the deadline, whichever comes first. A hung Spotlight call keeps running
  /// in the background but no longer holds up the caller (a task group would wait for it).
  private static func withDeadline(_ operation: String, _ work: @escaping @Sendable () async throws -> Void)
    async throws
  {
    let once = ResumeOnce()
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      Task {
        do {
          try await work()
          if once.claim() { continuation.resume() }
        } catch {
          if once.claim() { continuation.resume(throwing: error) }
        }
      }
      Task {
        try? await Task.sleep(for: deadline)
        if once.claim() { continuation.resume(throwing: TimedOut(operation: operation)) }
      }
    }
  }
}

private final class ResumeOnce: @unchecked Sendable {
  private let lock = NSLock()
  private var claimed = false

  func claim() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if claimed { return false }
    claimed = true
    return true
  }
}
