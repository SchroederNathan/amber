import CoreImage
import Foundation
#if canImport(SubjectLift)
internal import SubjectLift
#endif

/// What Siri's words ask Amber to cut out of a photo. "Save this chair to Amber" names a chair,
/// so the capture becomes a die-cut sticker of the chair alone; "save this image" names nothing
/// and stays a plain image. Asking for a sticker or a cutout lifts the main object even when its
/// name doesn't match what Vision sees.
struct StickerTarget {
  /// The object words, singular, from before any "to", "into", or "for" (which names a space
  /// or a purpose, not the object).
  let nouns: [String]
  /// The user asked for a sticker or cutout outright.
  let explicit: Bool

  /// Nil when the words ask for no object. `explicit` marks words that only name the object
  /// (`SaveImageIntent`'s "Cut Out" parameter), which is a sticker request by itself.
  init?(words: String, explicit: Bool = false) {
    let tokens = words.lowercased()
      .components(separatedBy: CharacterSet.letters.inverted)
      .filter { !$0.isEmpty }
    let explicit =
      explicit || tokens.contains { $0 == "sticker" || $0 == "stickers" || $0 == "cutout" }
      || zip(tokens, tokens.dropFirst()).contains { $0 == "cut" && $1 == "out" }
    // Long words are Siri describing the screen ("Screenshot of a post showing a lamp"), not
    // the user naming one thing.
    guard explicit || tokens.count <= Self.maxWords else { return nil }
    let objectPart = tokens.prefix { !Self.boundaries.contains($0) }
    let nouns = objectPart
      .filter { $0.count > 2 && !Self.ignored.contains($0) }
      .map { Self.synonyms[$0] ?? Self.singular($0) }
    guard explicit || !nouns.isEmpty else { return nil }
    self.nouns = nouns
    self.explicit = explicit
  }

  /// Longer words name an object only when they ask for a sticker outright.
  static let maxWords = 8
  /// Vision labels count only at or above this confidence.
  static let minConfidence: Float = 0.1
  /// Specks smaller than this share of a window are never the object.
  static let minCoverage = 0.005
  /// Photos are cut at this size: plenty for a feed sticker, and fast for Vision.
  static let maxPixelSize = 2048
  /// Grown windows tried per round for matches that a window cut through, and how many times
  /// a still-cut match may grow again.
  static let maxRegrows = 4
  static let regrowRounds = 2

  /// Cuts the named object out of a photo. Vision's foreground mask often merges a whole room
  /// (two chairs, the table between them, the fireplace behind) into one subject, so it runs on
  /// the full photo and on overlapping windows of it: in a window around one chair, that chair
  /// is the subject. The best window is the one whose object matches a noun most confidently
  /// without being cut off at the window's edge; a match that was cut off is tried again in a
  /// window grown around it. Only when a sticker was asked for outright
  /// and nothing matches does it fall back to the full photo's largest object. Nil means save
  /// the plain photo.
  @available(iOS 17.0, macOS 14.0, *)
  func cut(from data: Data) throws -> (sticker: StickerCutter.Sticker, name: String?)? {
    guard let photo = StickerCutter.loadImage(data: data, maxPixelSize: Self.maxPixelSize) else { return nil }
    let full = CGRect(x: 0, y: 0, width: photo.width, height: photo.height)
    let context = CIContext(options: [.workingColorSpace: CGColorSpaceCreateDeviceRGB()])

    var best: (cutter: StickerCutter, instance: Int, name: String, confidence: Float)?
    var fallback: (cutter: StickerCutter, object: StickerCutter.DetectedObject)?
    // A match the window cut through gets one more try in a window grown around it.
    var regrow: [CGRect] = []
    func search(_ windows: [CGRect]) throws {
      for window in windows {
        guard let crop = photo.cropping(to: window) else { continue }
        let cutter = try StickerCutter(image: crop, context: context)
        let objects = try cutter.objects().filter { $0.coverage >= Self.minCoverage }
        if window == full, let largest = objects.max(by: { $0.coverage < $1.coverage }) {
          fallback = (cutter, largest)
        }
        for object in objects {
          guard let match = match(object) else { continue }
          if Self.isCutOff(object, window: window, photo: full) {
            regrow.append(Self.grown(object.bounds, in: window, photo: full))
            continue
          }
          if match.confidence > (best?.confidence ?? 0) {
            best = (cutter, object.instance, match.name, match.confidence)
          }
        }
      }
    }
    try search(nouns.isEmpty ? [full] : Self.windows(in: full))
    for _ in 0..<Self.regrowRounds where !regrow.isEmpty {
      let retries = regrow.prefix(Self.maxRegrows)
      regrow = []
      try search(Array(retries))
    }

    if let best, let sticker = try best.cutter.sticker(of: [best.instance]) {
      return (sticker, best.name)
    }
    if explicit, let fallback, let sticker = try fallback.cutter.sticker(of: [fallback.object.instance]) {
      return (sticker, nouns.first)
    }
    return nil
  }

  /// The noun an object's labels name, with Vision's confidence in that label.
  @available(iOS 17.0, macOS 14.0, *)
  func match(_ object: StickerCutter.DetectedObject) -> (name: String, confidence: Float)? {
    var best: (name: String, confidence: Float)?
    for label in object.labels where label.confidence >= Self.minConfidence {
      let parts = Set(label.identifier.split(separator: "_").map { Self.singular(String($0)) })
      if let noun = nouns.first(where: parts.contains), label.confidence > (best?.confidence ?? 0) {
        best = (noun, label.confidence)
      }
    }
    return best
  }

  /// The full photo, then overlapping windows at two scales (a 2 by 2 and a 3 by 3 grid).
  static func windows(in photo: CGRect) -> [CGRect] {
    var windows = [photo]
    for (size, count) in [(0.6, 2), (0.45, 3)] {
      let step = count > 1 ? (1 - size) / Double(count - 1) : 0
      for row in 0..<count {
        for column in 0..<count {
          windows.append(
            CGRect(
              x: photo.width * step * Double(column), y: photo.height * step * Double(row),
              width: photo.width * size, height: photo.height * size
            ).integral.intersection(photo))
        }
      }
    }
    return windows
  }

  /// A window around `bounds` (fractions of `window`), in photo pixels, with room to spare on
  /// every side.
  static func grown(_ bounds: CGRect, in window: CGRect, photo: CGRect) -> CGRect {
    let object = CGRect(
      x: window.minX + bounds.minX * window.width, y: window.minY + bounds.minY * window.height,
      width: bounds.width * window.width, height: bounds.height * window.height)
    return object.insetBy(dx: -object.width * 0.5, dy: -object.height * 0.5).integral.intersection(photo)
  }

  /// True when the object touches a window edge that lies inside the photo: the window cut
  /// through it, so its sticker would be missing a piece.
  @available(iOS 17.0, macOS 14.0, *)
  static func isCutOff(_ object: StickerCutter.DetectedObject, window: CGRect, photo: CGRect) -> Bool {
    let edge = 0.01
    let bounds = object.bounds
    return (window.minX > photo.minX && bounds.minX < edge)
      || (window.maxX < photo.maxX && bounds.maxX > 1 - edge)
      || (window.minY > photo.minY && bounds.minY < edge)
      || (window.maxY < photo.maxY && bounds.maxY > 1 - edge)
  }

  /// Crude English singular, enough to line spoken words up with Vision's labels ("shoes").
  static func singular(_ word: String) -> String {
    if word.hasSuffix("ies"), word.count > 4 { return String(word.dropLast(3)) + "y" }
    if ["ses", "xes", "ches", "shes"].contains(where: word.hasSuffix) { return String(word.dropLast(2)) }
    if word.hasSuffix("s"), !word.hasSuffix("ss"), word.count > 3 { return String(word.dropLast()) }
    return word
  }

  private static let boundaries: Set<String> = ["to", "into", "in", "for", "under", "onto"]

  /// Words that never name the object: the request itself, and "this image".
  private static let ignored: Set<String> = [
    "save", "saved", "add", "put", "keep", "store", "grab", "clip", "make", "turn", "cut", "out",
    "cutout", "sticker", "stickers", "please", "can", "you", "could", "hey", "siri", "amber",
    "this", "that", "these", "those", "the", "and", "with", "from", "just", "here", "there", "one",
    "thing", "things", "stuff", "image", "images", "photo", "photos", "picture", "pictures", "pic",
    "pics", "screenshot", "screenshots", "screen", "post", "note", "notes", "all", "some", "its",
  ]

  /// Spoken names that Vision labels differently.
  private static let synonyms: [String: String] = [
    "couch": "sofa", "couches": "sofa", "sneakers": "sneaker", "trainers": "sneaker", "purse": "bag",
    "handbag": "bag", "bike": "bicycle", "puppy": "dog", "kitty": "cat", "kitten": "cat",
  ]
}
