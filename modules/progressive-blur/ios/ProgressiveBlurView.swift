import ExpoModulesCore
import UIKit

// A blurred band behind a transparent navigation header. A standard, public
// `UIBlurEffect` is fully visible at the top edge, and the whole effect view's
// opacity feathers to zero near the header's lower edge so the band dissolves
// into the content beneath it.
//
// iOS has no public API for a live, spatially-varying blur radius. Rather than
// reach for undocumented, App-Review-sensitive runtime APIs, this uses only
// documented UIKit and Core Animation APIs: a fixed `UIBlurEffect` whose view
// opacity is faded out by a gradient `CALayer` mask. The result is a close
// visual approximation, not a true per-pixel variable-radius blur.
class ProgressiveBlurView: ExpoView {
  private let blurView = UIVisualEffectView(effect: UIBlurEffect(style: .regular))

  // Opacity mask on the whole effect view. A UIVisualEffectView draws a faint
  // hairline at its own bottom edge no matter its blur radius; only fading the
  // layer's opacity to zero makes that edge disappear. This gradient feathers
  // the view out across the bottom of the band so the hard edge is never seen.
  private let maskLayer = CAGradientLayer()

  // Extra height added below the header band. The UIVisualEffectView renders a
  // faint hairline at its own bottom edge regardless of the mask, so we push
  // that edge this far past the visible fade — into the fully-transparent
  // region — where it can't show over the content. The view is deliberately
  // left un-clipped so this overhang survives.
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

    // Extend the blur band `edgeMargin` below the header; the opacity mask fades
    // to zero by the header's bottom edge and stays zero through the overhang.
    let totalSize = CGSize(width: bounds.width, height: bounds.height + edgeMargin)
    blurView.frame = CGRect(origin: .zero, size: totalSize)
    updateOpacityMask(bandHeight: bounds.height, totalSize: totalSize)
  }

  /// Feathers the whole effect view's opacity to zero across the bottom of the
  /// band so its backdrop layer's hard edge is never visible. Opaque through the
  /// upper part so the public blur reads at full strength; below the header edge
  /// the terminal clear color fills the overhang.
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
}
