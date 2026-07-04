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
    // Vision upscales a lower-res model mask to full resolution, so its edge is
    // aliased/stair-stepped. Feather + re-tighten it to anti-alias the edge.
    let edgeSoftness = min(max(maxDimension * 0.0025, 2), 14)

    // When the subject runs off the edge of the photo, the outline has to grow
    // OUTSIDE the original frame — otherwise the white border (and its rounded
    // corner) gets clipped at that edge and the cut looks flush/hard. Give the
    // whole composite that much breathing room on every side.
    let pad = ceil(outlineWidth + edgeSoftness + 2)
    let workExtent = original.extent.insetBy(dx: -pad, dy: -pad)

    // Smoothed subject matte: blur the ramp, then pull it back toward a crisp
    // edge so the subject isn't left with a hazy translucent fringe. Clamped so
    // a subject touching the frame stays solid to that edge (white sits beyond).
    let smoothMask = refineEdge(maskImage, softness: edgeSoftness, extent: original.extent, clamp: true)

    // 1. Isolate the subject onto a transparent background.
    let subjectBlend = CIFilter.blendWithMask()
    subjectBlend.inputImage = original
    subjectBlend.backgroundImage = CIImage.empty()
    subjectBlend.maskImage = smoothMask
    guard let subject = subjectBlend.outputImage else { throw RenderException() }

    // 2. Grow the mask to form the die-cut silhouette. The disc-shaped dilation
    // rounds convex corners by its radius, so where the subject meets a frame
    // edge the outline turns with a small radius instead of a hard 90°. Do NOT
    // clamp before dilating (that would flood the whole margin white); dilation
    // grows the finite mask outward by exactly `outlineWidth`.
    let dilate = CIFilter.morphologyMaximum()
    dilate.inputImage = maskImage
    dilate.radius = Float(outlineWidth)
    guard let dilatedRaw = dilate.outputImage else { throw RenderException() }
    // Soften the grown edge, unclamped so it fades to 0 at its outer boundary,
    // and keep the growth that now extends beyond the original frame.
    let dilatedMask = refineEdge(dilatedRaw, softness: edgeSoftness, extent: workExtent, clamp: false)

    // 3. Fill that grown silhouette with solid white across the expanded canvas
    // so padding can appear beyond the original photo edges.
    let white = CIImage(color: CIColor.white).cropped(to: workExtent)
    let whiteBlend = CIFilter.blendWithMask()
    whiteBlend.inputImage = white
    whiteBlend.backgroundImage = CIImage.empty()
    whiteBlend.maskImage = dilatedMask
    guard let whiteLayer = whiteBlend.outputImage else { throw RenderException() }

    // 4. Composite the subject over the white outline.
    let composite = CIFilter.sourceOverCompositing()
    composite.inputImage = subject
    composite.backgroundImage = whiteLayer
    guard let sticker = composite.outputImage?.cropped(to: workExtent) else {
      throw RenderException()
    }

    // 5. Render the expanded canvas, then crop to opaque bounds + transparent margin.
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    guard
      let fullCG = ciContext.createCGImage(
        sticker,
        from: workExtent,
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

  // MARK: - Edge smoothing

  /// Anti-aliases a hard/aliased mask edge: a small Gaussian blur feathers the
  /// alpha ramp, then a contrast boost around 0.5 pulls it back toward a crisp
  /// (but now smooth) edge — a poor-man's smoothstep matte refine. Channels are
  /// scaled uniformly so it works whether the mask carries its signal in luma
  /// or alpha. `clampedToExtent` keeps the blur from darkening the borders; the
  /// result is cropped back to the source extent.
  private func refineEdge(
    _ mask: CIImage,
    softness: CGFloat,
    extent: CGRect,
    clamp: Bool = true
  ) -> CIImage {
    let blur = CIFilter.gaussianBlur()
    // Clamp for a subject matte (keep edges solid to the frame); don't clamp for
    // the outline (let it fall off to 0 beyond its grown boundary).
    blur.inputImage = clamp ? mask.clampedToExtent() : mask
    blur.radius = Float(softness)
    let blurred = blur.outputImage ?? mask

    let slope: CGFloat = 2.2
    let bias = (1 - slope) / 2
    let contrast = CIFilter.colorMatrix()
    contrast.inputImage = blurred
    contrast.rVector = CIVector(x: slope, y: 0, z: 0, w: 0)
    contrast.gVector = CIVector(x: 0, y: slope, z: 0, w: 0)
    contrast.bVector = CIVector(x: 0, y: 0, z: slope, w: 0)
    contrast.aVector = CIVector(x: 0, y: 0, z: 0, w: slope)
    contrast.biasVector = CIVector(x: bias, y: bias, z: bias, w: bias)

    // CRITICAL: the contrast matrix overshoots (1.0 -> 1.6) and undershoots
    // (0.0 -> -0.6), and CoreImage does NOT clamp intermediate values. A matte
    // value > 1 makes CIBlendWithMask multiply the subject by > 1 — blowing the
    // colors toward white and corrupting the premultiplied alpha, which is what
    // produced blown-out / hollow stickers. Clamp back to a valid [0,1] matte.
    let clampFilter = CIFilter.colorClamp()
    clampFilter.inputImage = contrast.outputImage ?? blurred
    clampFilter.minComponents = CIVector(x: 0, y: 0, z: 0, w: 0)
    clampFilter.maxComponents = CIVector(x: 1, y: 1, z: 1, w: 1)

    return (clampFilter.outputImage ?? contrast.outputImage ?? blurred).cropped(to: extent)
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
