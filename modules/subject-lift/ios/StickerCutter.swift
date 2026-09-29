import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

public enum StickerCutterError: Error {
  case unreadableImage
  case renderFailed
}

/// Lifts subjects out of one photo with Vision and bakes them into a die-cut sticker PNG.
/// The camera screen (`SubjectLiftModule`) lifts every subject at once; Siri captures
/// (`app-intents/`) lift the one object the user named. No UIKit, so it also runs in a macOS
/// test harness (Vision can't run on the simulator).
@available(iOS 17.0, macOS 14.0, *)
public final class StickerCutter {
  public struct Label {
    public let identifier: String
    public let confidence: Float
  }

  /// One separate object Vision found in the photo.
  public struct DetectedObject {
    public let instance: Int
    /// Share of the photo the object covers, 0...1.
    public let coverage: Double
    /// Where the object sits, as fractions of the photo with a top-left origin.
    public let bounds: CGRect
    /// Vision's classifier labels for the object alone, most confident first.
    public let labels: [Label]
  }

  public struct Sticker {
    public let png: Data
    public let width: Int
    public let height: Int
  }

  private let image: CGImage
  private let handler: VNImageRequestHandler
  private let observation: VNInstanceMaskObservation?
  private let ciContext: CIContext

  /// Decodes the photo (orientation baked in, optionally downscaled so its longest side is at
  /// most `maxPixelSize`) and runs Vision's foreground instance mask once.
  public convenience init(data: Data, maxPixelSize: Int? = nil, context: CIContext? = nil) throws {
    guard let image = Self.loadImage(data: data, maxPixelSize: maxPixelSize) else {
      throw StickerCutterError.unreadableImage
    }
    try self.init(image: image, context: context)
  }

  /// Runs Vision's foreground instance mask once on an upright image (for example a crop of a
  /// photo from `loadImage`).
  public init(image: CGImage, context: CIContext? = nil) throws {
    self.image = image
    self.ciContext = context ?? CIContext(options: [.workingColorSpace: CGColorSpaceCreateDeviceRGB()])
    self.handler = VNImageRequestHandler(cgImage: image, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])
    self.observation = request.results?.first
  }

  /// False when Vision found no foreground subject at all.
  public var hasSubject: Bool {
    return !(observation?.allInstances.isEmpty ?? true)
  }

  /// Every object Vision separated, each classified on its own (masked, cropped to itself).
  public func objects() throws -> [DetectedObject] {
    guard let observation, !observation.allInstances.isEmpty else { return [] }
    let regions = Self.regions(of: observation.instanceMask)
    return try observation.allInstances.map { instance in
      let masked = try observation.generateMaskedImage(
        ofInstances: [instance], from: handler, croppedToInstancesExtent: true)
      let request = VNClassifyImageRequest()
      try VNImageRequestHandler(cvPixelBuffer: masked, options: [:]).perform([request])
      let labels = (request.results ?? [])
        .filter { $0.confidence >= 0.05 }
        .prefix(12)
        .map { Label(identifier: $0.identifier, confidence: $0.confidence) }
      let region = regions[instance]
      return DetectedObject(
        instance: instance, coverage: region?.coverage ?? 0, bounds: region?.bounds ?? .zero, labels: Array(labels))
    }
  }

  /// The die-cut sticker for `instances`, or for every subject when nil. Nil when Vision found
  /// no subject.
  public func sticker(of instances: IndexSet? = nil) throws -> Sticker? {
    guard let observation, !observation.allInstances.isEmpty else { return nil }
    let maskBuffer = try observation.generateScaledMaskForImage(
      forInstances: instances ?? observation.allInstances,
      from: handler
    )

    let original = CIImage(cgImage: image)
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
    guard let subject = subjectBlend.outputImage else { throw StickerCutterError.renderFailed }

    // 2. Grow the mask to form the die-cut silhouette. The disc-shaped dilation
    // rounds convex corners by its radius, so where the subject meets a frame
    // edge the outline turns with a small radius instead of a hard 90°. Do NOT
    // clamp before dilating (that would flood the whole margin white); dilation
    // grows the finite mask outward by exactly `outlineWidth`.
    let dilate = CIFilter.morphologyMaximum()
    dilate.inputImage = maskImage
    dilate.radius = Float(outlineWidth)
    guard let dilatedRaw = dilate.outputImage else { throw StickerCutterError.renderFailed }
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
    guard let whiteLayer = whiteBlend.outputImage else { throw StickerCutterError.renderFailed }

    // 4. Composite the subject over the white outline.
    let composite = CIFilter.sourceOverCompositing()
    composite.inputImage = subject
    composite.backgroundImage = whiteLayer
    guard let sticker = composite.outputImage?.cropped(to: workExtent) else {
      throw StickerCutterError.renderFailed
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
      throw StickerCutterError.renderFailed
    }

    let margin = Int(min(max(maxDimension * 0.05, 24), 160).rounded())
    let cropped = Self.cropToOpaque(fullCG, margin: margin, colorSpace: colorSpace)
    guard let png = Self.pngData(cropped) else { throw StickerCutterError.renderFailed }
    return Sticker(png: png, width: cropped.width, height: cropped.height)
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

  /// Decodes the image with its EXIF orientation baked in, so all downstream work is in a
  /// simple top-left pixel space.
  public static func loadImage(data: Data, maxPixelSize: Int? = nil) -> CGImage? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetCount(source) > 0,
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int
    else {
      return nil
    }
    let longest = max(width, height)
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceThumbnailMaxPixelSize: min(longest, maxPixelSize ?? longest),
    ]
    return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
  }

  /// Share of the photo and normalized top-left bounds of each instance label in Vision's
  /// low-res instance mask.
  private static func regions(of mask: CVPixelBuffer) -> [Int: (coverage: Double, bounds: CGRect)] {
    CVPixelBufferLockBaseAddress(mask, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(mask) else { return [:] }
    let width = CVPixelBufferGetWidth(mask)
    let height = CVPixelBufferGetHeight(mask)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(mask)
    let pixels = base.assumingMemoryBound(to: UInt8.self)
    var counts = [Int](repeating: 0, count: 256)
    var minX = [Int](repeating: width, count: 256), minY = [Int](repeating: height, count: 256)
    var maxX = [Int](repeating: -1, count: 256), maxY = [Int](repeating: -1, count: 256)
    for y in 0..<height {
      let row = pixels + y * bytesPerRow
      for x in 0..<width {
        let label = Int(row[x])
        guard label > 0 else { continue }
        counts[label] += 1
        minX[label] = min(minX[label], x)
        maxX[label] = max(maxX[label], x)
        minY[label] = min(minY[label], y)
        maxY[label] = max(maxY[label], y)
      }
    }
    let total = Double(max(width * height, 1))
    var result: [Int: (coverage: Double, bounds: CGRect)] = [:]
    for label in 1..<256 where counts[label] > 0 {
      let bounds = CGRect(
        x: Double(minX[label]) / Double(width),
        y: Double(minY[label]) / Double(height),
        width: Double(maxX[label] - minX[label] + 1) / Double(width),
        height: Double(maxY[label] - minY[label] + 1) / Double(height))
      result[label] = (Double(counts[label]) / total, bounds)
    }
    return result
  }

  /// Scans the alpha channel to find the sticker's opaque bounds, then returns a
  /// copy padded with `margin` transparent pixels on every side. All coordinates
  /// are top-left (CGImage space), so there is no CIImage y-flip to reconcile.
  private static func cropToOpaque(_ cgImage: CGImage, margin: Int, colorSpace: CGColorSpace) -> CGImage {
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
    guard
      let canvas = CGContext(
        data: nil,
        width: content.width + margin * 2,
        height: content.height + margin * 2,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      )
    else {
      return content
    }
    canvas.draw(content, in: CGRect(x: margin, y: margin, width: content.width, height: content.height))
    return canvas.makeImage() ?? content
  }

  private static func pngData(_ image: CGImage) -> Data? {
    let output = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(output, UTType.png.identifier as CFString, 1, nil)
    else { return nil }
    CGImageDestinationAddImage(destination, image, nil)
    return CGImageDestinationFinalize(destination) ? output as Data : nil
  }
}
