import CoreImage
import CoreImage.CIFilterBuiltins
import ExpoModulesCore
import UIKit
import Vision

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

  @available(iOS 17.0, *)
  private func lift(uri: String) throws -> [String: Any] {
    guard let cgImage = self.loadNormalizedCGImage(uri: uri) else {
      throw ImageLoadException()
    }

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])

    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      return ["hasSubject": false]
    }

    let maskBuffer = try observation.generateScaledMaskForImage(
      forInstances: observation.allInstances,
      from: handler
    )

    let original = CIImage(cgImage: cgImage)
    let maskImage = CIImage(cvPixelBuffer: maskBuffer)
      // The scaled mask matches the source resolution, but guard against any
      // off-by-a-pixel extent mismatch by clamping to the original extent.
      .cropped(to: original.extent)

    let maxDimension = max(original.extent.width, original.extent.height)
    let outlineWidth = min(max(maxDimension * 0.012, 8), 64)

    // 1. Isolate the subject onto a transparent background.
    let subjectBlend = CIFilter.blendWithMask()
    subjectBlend.inputImage = original
    subjectBlend.backgroundImage = CIImage.empty()
    subjectBlend.maskImage = maskImage
    guard let subject = subjectBlend.outputImage else { throw RenderException() }

    // 2. Grow the mask to form the die-cut outline silhouette.
    let dilate = CIFilter.morphologyMaximum()
    dilate.inputImage = maskImage
    dilate.radius = Float(outlineWidth)
    guard let dilatedMask = dilate.outputImage?.cropped(to: original.extent) else {
      throw RenderException()
    }

    // 3. Fill that grown silhouette with solid white.
    let white = CIImage(color: CIColor.white).cropped(to: original.extent)
    let whiteBlend = CIFilter.blendWithMask()
    whiteBlend.inputImage = white
    whiteBlend.backgroundImage = CIImage.empty()
    whiteBlend.maskImage = dilatedMask
    guard let whiteLayer = whiteBlend.outputImage else { throw RenderException() }

    // 4. Composite the subject over the white outline.
    let composite = CIFilter.sourceOverCompositing()
    composite.inputImage = subject
    composite.backgroundImage = whiteLayer
    guard let sticker = composite.outputImage?.cropped(to: original.extent) else {
      throw RenderException()
    }

    // 5. Render full-size, then crop to the opaque bounds + transparent margin.
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    guard
      let fullCG = ciContext.createCGImage(
        sticker,
        from: original.extent,
        format: .RGBA8,
        colorSpace: colorSpace
      )
    else {
      throw RenderException()
    }

    let margin = Int(min(max(maxDimension * 0.05, 24), 160).rounded())
    let cropped = self.cropToOpaque(fullCG, margin: margin)

    let outURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("sticker-\(UUID().uuidString).png")
    guard let pngData = UIImage(cgImage: cropped).pngData() else {
      throw RenderException()
    }
    try pngData.write(to: outURL)

    return [
      "uri": outURL.absoluteString,
      "width": cropped.width,
      "height": cropped.height,
      "hasSubject": true,
    ]
  }

  // MARK: - Helpers

  /// Loads the image and bakes in EXIF orientation so all downstream work is in
  /// a simple top-left pixel space.
  private func loadNormalizedCGImage(uri: String) -> CGImage? {
    let url = URL(string: uri) ?? URL(fileURLWithPath: uri)
    guard let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
      return nil
    }
    if image.imageOrientation == .up, let cg = image.cgImage {
      return cg
    }
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
    let normalized = renderer.image { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }
    return normalized.cgImage
  }

  /// Scans the alpha channel to find the sticker's opaque bounds, then returns a
  /// copy padded with `margin` transparent pixels on every side. All coordinates
  /// are top-left (CGImage space), so there is no CIImage y-flip to reconcile.
  private func cropToOpaque(_ cgImage: CGImage, margin: Int) -> CGImage {
    let width = cgImage.width
    let height = cgImage.height

    guard
      let data = cgImage.dataProvider?.data,
      let ptr = CFDataGetBytePtr(data)
    else {
      return cgImage
    }
    let bytesPerRow = cgImage.bytesPerRow
    let bytesPerPixel = cgImage.bitsPerPixel / 8
    guard bytesPerPixel >= 1 else { return cgImage }
    let alphaOffset = bytesPerPixel - 1 // RGBA8 => alpha is the last byte

    let threshold: UInt8 = 12
    // Sample on a stride for speed on large photos; the margin absorbs the slack.
    let stride = max(1, min(width, height) / 512)

    var minX = width, minY = height, maxX = -1, maxY = -1
    var y = 0
    while y < height {
      let row = y * bytesPerRow
      var x = 0
      while x < width {
        if ptr[row + x * bytesPerPixel + alphaOffset] > threshold {
          if x < minX { minX = x }
          if x > maxX { maxX = x }
          if y < minY { minY = y }
          if y > maxY { maxY = y }
        }
        x += stride
      }
      y += stride
    }

    guard maxX >= minX, maxY >= minY else { return cgImage }

    let contentW = maxX - minX + 1
    let contentH = maxY - minY + 1
    let cropRect = CGRect(x: minX, y: minY, width: contentW, height: contentH)
      .intersection(CGRect(x: 0, y: 0, width: width, height: height))
    guard !cropRect.isNull, let content = cgImage.cropping(to: cropRect) else {
      return cgImage
    }

    // Draw the tight crop onto a clear canvas expanded by `margin` on each side so
    // the sticker keeps its transparent breathing room even at the photo edges.
    let canvasSize = CGSize(width: content.width + margin * 2, height: content.height + margin * 2)
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = false
    let renderer = UIGraphicsImageRenderer(size: canvasSize, format: format)
    let padded = renderer.image { _ in
      UIImage(cgImage: content).draw(
        in: CGRect(x: margin, y: margin, width: content.width, height: content.height)
      )
    }
    return padded.cgImage ?? content
  }
}
