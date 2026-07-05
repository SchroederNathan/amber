import ExpoModulesCore

public class ProgressiveBlurModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ProgressiveBlur")

    View(ProgressiveBlurView.self) {
      // Max blur radius (points) at the fully-blurred top edge.
      Prop("intensity") { (view: ProgressiveBlurView, intensity: Double) in
        view.maxBlurRadius = CGFloat(intensity)
      }
    }
  }
}
