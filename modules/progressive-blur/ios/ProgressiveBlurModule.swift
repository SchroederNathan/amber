import ExpoModulesCore

public class ProgressiveBlurModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ProgressiveBlur")

    View(ProgressiveBlurView.self) {
      // No tunable props: the view renders a fixed public UIBlurEffect whose
      // opacity feathers out via a gradient mask. iOS exposes no public API to
      // map a numeric radius onto a UIBlurEffect, so there is nothing to set.
    }
  }
}
