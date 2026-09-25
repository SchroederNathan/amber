import Foundation

/// A short ring buffer of what the intents did, readable from JavaScript with
/// `AppIntentsSetup.getIntentLog()`. Intents run while the JS debugger is detached (often in a
/// background launch), so this is the only after-the-fact view of a failed run.
enum AmberIntentLog {
  private static let key = "amber.intentLog"
  private static let limit = 40

  static func record(_ message: String) {
    let stamp = ISO8601DateFormatter().string(from: Date())
    var entries = UserDefaults.standard.stringArray(forKey: key) ?? []
    entries.append("\(stamp) \(message)")
    UserDefaults.standard.set(Array(entries.suffix(limit)), forKey: key)
  }

  static func entries() -> [String] {
    return UserDefaults.standard.stringArray(forKey: key) ?? []
  }
}
