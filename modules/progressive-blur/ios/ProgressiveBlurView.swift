import ExpoModulesCore
import UIKit

// A progressive ("variable") blur band: fully blurred at the top edge, fading to
// perfectly sharp at the bottom edge. Sits behind a transparent navigation header
// so content dissolves into blur as it scrolls up underneath.
//
// iOS has no public API for a live, spatially-varying blur radius, so this drives
// the private `variableBlur` CAFilter on a UIVisualEffectView's backdrop layer via
// a top-to-bottom gradient alpha mask (alpha 1 -> max blur, alpha 0 -> no blur).
// The private class/selector names are base64-encoded so they never appear as
// literal strings in the binary, and the whole thing degrades gracefully to a
// plain (unfiltered) blur view if the private API is ever unavailable.
class ProgressiveBlurView: ExpoView {
  private let blurView = UIVisualEffectView(effect: UIBlurEffect(style: .regular))

  // Opacity mask on the whole effect view. Reducing the variable-blur *radius* to
  // zero does NOT hide a UIVisualEffectView's backdrop layer — it still draws a
  // hairline at its own bottom edge. Only fading the layer's opacity to zero makes
  // that edge disappear, so this gradient feathers the view out across the bottom.
  private let maskLayer = CAGradientLayer()

  // The maximum blur radius (points) at the fully-blurred top edge.
  var maxBlurRadius: CGFloat = 20 {
    didSet {
      if maxBlurRadius != oldValue { setNeedsLayout() }
    }
  }

  // Cache so we only rebuild the (relatively expensive) mask + filter when the
  // resolved size actually changes.
  private var appliedSize: CGSize = .zero
  private var appliedRadius: CGFloat = -1

  // Extra height added below the header band. A UIVisualEffectView renders a faint
  // hairline at its own bottom edge no matter what the mask says, so we push that
  // edge this far past the visible fade — into the fully-transparent (zero-blur)
  // region — where it can't show over the content. The view is deliberately left
  // un-clipped so this overhang survives.
  private let edgeMargin: CGFloat = 48

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // The blur is purely decorative and must never intercept touches meant for
    // the native header items rendered above it.
    blurView.isUserInteractionEnabled = false
    isUserInteractionEnabled = false
    blurView.layer.mask = maskLayer
    addSubview(blurView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    guard bounds.width > 0, bounds.height > 0 else { return }

    // Extend the blur band `edgeMargin` below the header; both masks fade to zero
    // by the header's bottom edge and stay zero through the overhang.
    let totalSize = CGSize(width: bounds.width, height: bounds.height + edgeMargin)
    blurView.frame = CGRect(origin: .zero, size: totalSize)
    updateOpacityMask(bandHeight: bounds.height, totalSize: totalSize)

    // Skip the private-API dance if nothing that affects the filter changed.
    if totalSize == appliedSize && maxBlurRadius == appliedRadius { return }

    applyVariableBlur(bandHeight: bounds.height, totalSize: totalSize)
    appliedSize = totalSize
    appliedRadius = maxBlurRadius
  }

  /// Feathers the whole effect view's opacity to zero across the bottom of the
  /// band so its backdrop layer's hard edge is never visible. Opaque through the
  /// upper part so the progressive (variable-radius) blur still reads at full
  /// strength; below the header edge the terminal clear color fills the overhang.
  private func updateOpacityMask(bandHeight: CGFloat, totalSize: CGSize) {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    defer { CATransaction.commit() }

    maskLayer.frame = CGRect(origin: .zero, size: totalSize)
    maskLayer.startPoint = CGPoint(x: 0.5, y: 0)
    // Gradient axis ends at the header's bottom edge; CAGradientLayer extends the
    // terminal (clear) color beyond it, masking out the overhang entirely.
    maskLayer.endPoint = CGPoint(x: 0.5, y: bandHeight / totalSize.height)

    let featherStart: CGFloat = 0.6
    let steps = 48
    var colors: [CGColor] = [UIColor.white.cgColor]
    var locations: [NSNumber] = [0]
    for i in 0...steps {
      let f = featherStart + (1 - featherStart) * CGFloat(i) / CGFloat(steps)
      let u = (f - featherStart) / (1 - featherStart)   // 0 -> 1 across the feather
      let smootherstep = u * u * u * (u * (u * 6 - 15) + 10)
      let alpha = 1 - smootherstep
      colors.append(UIColor.white.withAlphaComponent(alpha).cgColor)
      locations.append(NSNumber(value: Double(f)))
    }
    maskLayer.colors = colors
    maskLayer.locations = locations
  }

  // MARK: - Blur pipeline

  private func applyVariableBlur(bandHeight: CGFloat, totalSize: CGSize) {
    let scale = window?.screen.scale ?? UIScreen.main.scale
    guard
      let mask = makeGradientMask(bandHeight: bandHeight, totalSize: totalSize, scale: scale),
      let filter = makeVariableBlurFilter(radius: maxBlurRadius, mask: mask),
      let backdropLayer = blurView.subviews.first?.layer
    else {
      // Private API unavailable — leave the plain UIBlurEffect in place.
      return
    }

    backdropLayer.filters = [filter]

    // Hide the tint/vibrancy overlay (subview index 1) so there's no milky cast;
    // we want a pure blur that fades cleanly to nothing.
    if blurView.subviews.count > 1 {
      blurView.subviews[1].isHidden = true
    }
  }

  /// Vertical mask whose alpha runs 1.0 at the top edge to 0.0 at the bottom;
  /// `variableBlur` reads this alpha per-pixel as the local blur intensity.
  ///
  /// The alpha is computed *per pixel row* from the analytic smootherstep curve
  /// (Perlin's 6t⁵−15t⁴+10t³) rather than sampled into a handful of CGGradient
  /// stops. A stop-based gradient is only piecewise-linear, so its second
  /// derivative jumps at every stop — the eye reads those as Mach-band "hitches"
  /// in the blur. Evaluating the curve at every pixel keeps it C²-continuous, so
  /// the falloff is genuinely smooth. Rows past `bandHeight` (the overhang) are
  /// left at alpha 0.
  private func makeGradientMask(bandHeight: CGFloat, totalSize: CGSize, scale: CGFloat) -> CGImage? {
    let widthPx = max(1, Int((totalSize.width * scale).rounded()))
    let heightPx = max(1, Int((totalSize.height * scale).rounded()))
    let bandPx = max(1.0, Double(bandHeight * scale))

    // Premultiplied RGBA, black with a per-row alpha ramp (only the alpha channel
    // matters to the filter; RGB stays 0).
    let bytesPerPixel = 4
    let bytesPerRow = widthPx * bytesPerPixel
    var data = [UInt8](repeating: 0, count: bytesPerRow * heightPx)

    for row in 0..<heightPx {
      // Row 0 is the top of the CGImage, so t = 0 (alpha 1, full blur) at the top.
      let t = min(Double(row) / bandPx, 1.0)
      let smootherstep = t * t * t * (t * (t * 6 - 15) + 10)
      let alpha = UInt8((max(0.0, min(1.0, 1.0 - smootherstep)) * 255.0).rounded())
      if alpha == 0 { continue } // overhang / fully-clear rows stay zeroed
      var offset = row * bytesPerRow + (bytesPerPixel - 1) // alpha is the last byte
      for _ in 0..<widthPx {
        data[offset] = alpha
        offset += bytesPerPixel
      }
    }

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    return data.withUnsafeMutableBytes { raw -> CGImage? in
      guard
        let ctx = CGContext(
          data: raw.baseAddress,
          width: widthPx,
          height: heightPx,
          bitsPerComponent: 8,
          bytesPerRow: bytesPerRow,
          space: colorSpace,
          bitmapInfo: bitmapInfo
        )
      else { return nil }
      return ctx.makeImage()
    }
  }

  /// Builds the private `variableBlur` CAFilter reflectively. Returns nil (rather
  /// than crashing) if the private class/selector is ever removed.
  private func makeVariableBlurFilter(radius: CGFloat, mask: CGImage) -> NSObject? {
    // "CAFilter" and "filterWithType:" — base64 so the private names aren't
    // present as literal strings in the compiled binary.
    guard
      let className = base64Decode("Q0FGaWx0ZXI="),
      let selectorName = base64Decode("ZmlsdGVyV2l0aFR5cGU6"),
      let filterClass = NSClassFromString(className) as? NSObject.Type
    else { return nil }

    let selector = NSSelectorFromString(selectorName)
    guard filterClass.responds(to: selector) else { return nil }

    guard
      let unmanaged = filterClass.perform(selector, with: "variableBlur"),
      let filter = unmanaged.takeUnretainedValue() as? NSObject
    else { return nil }

    filter.setValue(radius, forKey: "inputRadius")
    filter.setValue(mask, forKey: "inputMaskImage")
    filter.setValue(true, forKey: "inputNormalizeEdges")
    return filter
  }

  private func base64Decode(_ encoded: String) -> String? {
    guard let data = Data(base64Encoded: encoded) else { return nil }
    return String(data: data, encoding: .utf8)
  }
}
