import CoreImage
import ExpoModulesCore

final class ImageLoadException: Exception {
  override var reason: String { "Could not load an image from the given URI." }
}

final class UnsupportedOSException: Exception {
  override var reason: String { "Subject lifting requires iOS 17 or newer." }
}

final class RenderException: Exception {
  override var reason: String { "Failed to render the sticker image." }
}

public class SubjectLiftModule: Module {
  // Reuse a single GPU-backed context across calls.
  private let ciContext = CIContext(options: [.workingColorSpace: CGColorSpaceCreateDeviceRGB()])

  public func definition() -> ModuleDefinition {
    Name("SubjectLift")

    AsyncFunction("liftSubject") { (uri: String) -> [String: Any] in
      guard #available(iOS 17.0, *) else {
        throw UnsupportedOSException()
      }
      return try self.lift(uri: uri)
    }
  }

  // MARK: - Pipeline

  /// Lifts every subject at once (the camera frames one thing); `StickerCutter` does the work
  /// and is shared with the Siri capture intents.
  @available(iOS 17.0, *)
  private func lift(uri: String) throws -> [String: Any] {
    let url = URL(string: uri) ?? URL(fileURLWithPath: uri)
    guard let data = try? Data(contentsOf: url) else {
      throw ImageLoadException()
    }
    let sticker: StickerCutter.Sticker?
    do {
      sticker = try StickerCutter(data: data, context: ciContext).sticker()
    } catch StickerCutterError.unreadableImage {
      throw ImageLoadException()
    } catch StickerCutterError.renderFailed {
      throw RenderException()
    }
    guard let sticker else {
      return ["hasSubject": false]
    }

    let outURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("sticker-\(UUID().uuidString).png")
    try sticker.png.write(to: outURL)

    return [
      "uri": outURL.absoluteString,
      "width": sticker.width,
      "height": sticker.height,
      "hasSubject": true,
    ]
  }
}
