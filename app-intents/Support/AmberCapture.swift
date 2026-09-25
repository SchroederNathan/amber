import Foundation
import Security

/// Saves notes, links, and images straight to the Convex backend, so Siri can capture without launching
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

  /// POSTs one capture and returns the new item id. `trace` is diagnostic only (see
  /// `CaptureRouter.trace`); the server logs it.
  static func save(
    kind: String, text: String? = nil, url: String? = nil, storageId: String? = nil,
    aspectRatio: Double? = nil, spaceId: String? = nil, trace: String? = nil
  ) async throws -> String {
    var body: [String: Any] = ["kind": kind]
    body["text"] = text
    body["url"] = url
    body["storageId"] = storageId
    body["aspectRatio"] = aspectRatio
    body["spaceId"] = spaceId
    body["trace"] = trace

    let json = try await post(path: "/app-intents/capture", body: body)
    guard let itemId = json["itemId"] as? String else {
      throw Failure.badResponse
    }
    return itemId
  }

  /// Uploads one image to Convex storage and returns its storage id, for a `kind: "image"`
  /// capture.
  static func uploadImage(_ data: Data, contentType: String) async throws -> String {
    let json = try await post(path: "/app-intents/upload-url", body: [:])
    guard let uploadUrl = (json["uploadUrl"] as? String).flatMap(URL.init(string:)) else {
      throw Failure.badResponse
    }
    var request = URLRequest(url: uploadUrl, timeoutInterval: 30)
    request.httpMethod = "POST"
    request.setValue(contentType, forHTTPHeaderField: "Content-Type")
    let (responseData, response) = try await URLSession.shared.upload(for: request, from: data)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard status == 200 else {
      throw Failure.rejected(status, "upload failed")
    }
    let result = (try? JSONSerialization.jsonObject(with: responseData)) as? [String: Any]
    guard let storageId = result?["storageId"] as? String else {
      throw Failure.badResponse
    }
    return storageId
  }

  /// POSTs JSON to a capture endpoint with the device's token and returns the JSON reply.
  private static func post(path: String, body: [String: Any]) async throws -> [String: Any] {
    guard let credentials = load(), let endpoint = URL(string: credentials.siteUrl + path) else {
      throw Failure.signedOut
    }

    var request = URLRequest(url: endpoint, timeoutInterval: 15)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(credentials.token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONSerialization.data(withJSONObject: body)

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
    guard let json else {
      throw Failure.badResponse
    }
    return json
  }

  private static func baseQuery() -> [String: Any] {
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }
}
