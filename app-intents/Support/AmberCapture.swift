import Foundation
import Security

/// Saves notes and links straight to the Convex backend, so Siri can capture without launching
/// the JavaScript app. The signed-in app hands over a per-device capture token (see
/// `convex/appIntents.ts`); it lives in the keychain, readable after first unlock so a locked
/// phone can still capture.
enum AmberCapture {
  struct Credentials: Codable {
    let siteUrl: String
    let token: String
  }

  enum Failure: Error, CustomStringConvertible {
    case signedOut
    case rejected(Int, String)
    case badResponse

    var description: String {
      switch self {
      case .signedOut: return "Amber has no capture token. Open Amber and sign in."
      case .rejected(let status, let message): return "Amber rejected the save (\(status)): \(message)"
      case .badResponse: return "Amber returned an unreadable response."
      }
    }
  }

  private static let service = "amber.app-intents.capture"
  private static let account = "credentials"

  static func store(_ credentials: Credentials) throws {
    let data = try JSONEncoder().encode(credentials)
    var query = baseQuery()
    SecItemDelete(query as CFDictionary)
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
    }
  }

  static func clear() {
    SecItemDelete(baseQuery() as CFDictionary)
  }

  static func load() -> Credentials? {
    var query = baseQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
      let data = result as? Data
    else {
      return nil
    }
    return try? JSONDecoder().decode(Credentials.self, from: data)
  }

  /// POSTs one capture and returns the new item id.
  static func save(kind: String, text: String? = nil, url: String? = nil, spaceId: String? = nil)
    async throws -> String
  {
    guard let credentials = load(), let endpoint = URL(string: credentials.siteUrl + "/app-intents/capture")
    else {
      throw Failure.signedOut
    }

    var body: [String: String] = ["kind": kind]
    body["text"] = text
    body["url"] = url
    body["spaceId"] = spaceId

    var request = URLRequest(url: endpoint, timeoutInterval: 15)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(credentials.token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(body)

    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    guard status == 200 else {
      if status == 401 {
        // The token was revoked (sign-out on another path) or never existed server-side.
        clear()
      }
      throw Failure.rejected(status, json?["error"] as? String ?? "")
    }
    guard let itemId = json?["itemId"] as? String else {
      throw Failure.badResponse
    }
    return itemId
  }

  private static func baseQuery() -> [String: Any] {
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }
}
