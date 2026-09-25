import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

/// Decides which one item a Siri capture becomes. Siri sends "save this" to the notes schema
/// whatever is on screen, so the note's text and attachments can really hold a web page, a
/// screenshot, or a photo. In order: a page link Siri passed explicitly, then images, then a
/// text that is just a URL, then a plain note.
enum CaptureRouter {
  /// One attachment, copied out of `IntentFile` so it can cross actors.
  struct Attachment: Sendable {
    let data: Data
    let type: UTType?
    let filename: String
  }

  /// An image ready to upload, with the text read from it on the device.
  struct PreparedImage: Sendable {
    let data: Data
    let contentType: String
    let aspectRatio: Double?
    let recognizedText: String
  }

  enum Route {
    case link(URL)
    case images([Attachment])
    case note
  }

  /// Text-only captures longer than this stay notes even when they hold a URL: that is a note
  /// that mentions a link, not a link.
  static let maxLinkTextLength = 500
  static let maxImages = 10
  static let maxRecognizedTextLength = 4000

  static func route(text: String, linkAttributes: [URL], attachments: [Attachment]) -> Route {
    if let url = linkAttributes.first(where: isWebURL) ?? attachments.lazy.compactMap(pageURL).first {
      return .link(url)
    }
    let images = attachments.filter(isImage)
    if !images.isEmpty {
      return .images(Array(images.prefix(maxImages)))
    }
    let textURLs = Set(webURLs(in: text))
    if textURLs.count == 1, let url = textURLs.first, text.count <= maxLinkTextLength {
      return .link(url)
    }
    return .note
  }

  /// Every link attribute in Siri's attributed text (`name` and `content`).
  static func linkAttributes(in strings: [AttributedString]) -> [URL] {
    return strings.flatMap { string in string.runs.compactMap { $0.link } }
  }

  static func isImage(_ attachment: Attachment) -> Bool {
    if let type = attachment.type {
      return type.conforms(to: .image)
    }
    return CGImageSourceCreateWithData(attachment.data as CFData, nil).map(CGImageSourceGetCount) ?? 0 > 0
  }

  static func isWebURL(_ url: URL) -> Bool {
    return url.scheme == "https" || url.scheme == "http"
  }

  static func webURLs(in text: String) -> [URL] {
    guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else {
      return []
    }
    return detector.matches(in: text, range: NSRange(text.startIndex..., in: text))
      .compactMap(\.url)
      .filter(isWebURL)
  }

  /// The web page an attachment stands for: a URL, a web archive, a `.webloc` or internet
  /// shortcut, or an HTML file that names its canonical URL. Nil for anything else.
  static func pageURL(_ attachment: Attachment) -> URL? {
    guard let type = attachment.type else { return nil }
    if type.conforms(to: .url) || type.conforms(to: .internetShortcut) {
      let text = String(decoding: attachment.data, as: UTF8.self)
      return webURLs(in: text).first
    }
    if type.conforms(to: .webArchive) {
      let plist = try? PropertyListSerialization.propertyList(from: attachment.data, format: nil)
      let main = (plist as? [String: Any])?["WebMainResource"] as? [String: Any]
      return (main?["WebResourceURL"] as? String).flatMap(URL.init(string:)).flatMap { isWebURL($0) ? $0 : nil }
    }
    if type.conforms(to: .internetLocation) {
      let plist = try? PropertyListSerialization.propertyList(from: attachment.data, format: nil)
      return ((plist as? [String: Any])?["URL"] as? String).flatMap(URL.init(string:)).flatMap { isWebURL($0) ? $0 : nil }
    }
    if type.conforms(to: .html) {
      return canonicalURL(inHTML: String(decoding: attachment.data.prefix(200_000), as: UTF8.self))
    }
    return nil
  }

  /// `<link rel="canonical">` or `og:url` from a saved HTML page.
  static func canonicalURL(inHTML html: String) -> URL? {
    let patterns = [
      #"<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']"#,
      #"<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']"#,
      #"<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']"#,
      #"<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']"#,
    ]
    for pattern in patterns {
      guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
        let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
        let range = Range(match.range(at: 1), in: html),
        let url = URL(string: String(html[range])), isWebURL(url)
      else { continue }
      return url
    }
    return nil
  }

  /// Converts anything but JPEG and PNG to JPEG (so the classifier can read it), reads the
  /// display aspect ratio, and runs on-device text recognition.
  @available(iOS 18.0, *)
  static func prepare(_ attachment: Attachment) async -> PreparedImage? {
    guard let source = CGImageSourceCreateWithData(attachment.data as CFData, nil),
      CGImageSourceGetCount(source) > 0
    else { return nil }

    let sourceType = (CGImageSourceGetType(source) as String?).flatMap(UTType.init) ?? attachment.type
    var data = attachment.data
    var contentType = sourceType?.preferredMIMEType ?? "image/jpeg"
    if sourceType != .jpeg && sourceType != .png {
      guard let jpeg = jpegData(from: source) else { return nil }
      data = jpeg
      contentType = "image/jpeg"
    }

    let recognized = (try? await RecognizeTextRequest().perform(on: attachment.data)) ?? []
    let text = recognized.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    return PreparedImage(
      data: data,
      contentType: contentType,
      aspectRatio: aspectRatio(of: source),
      recognizedText: String(text.prefix(maxRecognizedTextLength))
    )
  }

  static func aspectRatio(of source: CGImageSource) -> Double? {
    guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Double,
      let height = properties[kCGImagePropertyPixelHeight] as? Double,
      width > 0, height > 0
    else { return nil }
    // EXIF orientations 5-8 are rotated a quarter turn, so the displayed image is height x width.
    let orientation = properties[kCGImagePropertyOrientation] as? Int ?? 1
    return orientation >= 5 ? height / width : width / height
  }

  static func jpegData(from source: CGImageSource) -> Data? {
    let output = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil)
    else { return nil }
    CGImageDestinationAddImageFromSource(
      destination, source, 0, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
    return CGImageDestinationFinalize(destination) ? output as Data : nil
  }

  /// Types, sizes, and link hosts, never text: shows in the Convex logs which shapes Siri
  /// sends from each app and browser.
  static func trace(
    intent: String, name: String, content: String?, linkAttributes: [URL], attachments: [Attachment], route: Route
  ) -> String {
    let files = attachments.map { "\($0.type?.identifier ?? "unknown"):\($0.data.count)" }
    let routeName: String
    switch route {
    case .link: routeName = "link"
    case .images(let images): routeName = "images(\(images.count))"
    case .note: routeName = "note"
    }
    return [
      "intent=\(intent)",
      "name=\(name.count)",
      "content=\(content?.count ?? -1)",
      "linkAttributes=\(linkAttributes.map { $0.host() ?? "?" })",
      "textURLs=\(webURLs(in: [name, content ?? ""].joined(separator: "\n")).count)",
      "attachments=\(files)",
      "route=\(routeName)",
    ].joined(separator: " ")
  }
}
