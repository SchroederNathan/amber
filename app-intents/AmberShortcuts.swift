import AppIntents

/// Phrases that work with classic Siri and show Amber's actions in Shortcuts and Spotlight.
/// The iOS 27 Siri also reaches the schema intents without these.
@available(iOS 17.4, *)
struct AmberShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    #if compiler(>=6.4)
    if #available(iOS 27.0, *) {
      AppShortcut(
        intent: SaveNoteIntent(),
        phrases: [
          "Save a note in \(.applicationName)",
          "Add a note to \(.applicationName)",
          "Save a note to \(\.$folder) in \(.applicationName)",
        ],
        shortTitle: "Save a Note",
        systemImageName: "square.and.pencil"
      )
      AppShortcut(
        intent: SearchAmberIntent(),
        phrases: [
          "Search \(.applicationName)",
          "Find something in \(.applicationName)",
        ],
        shortTitle: "Search Amber",
        systemImageName: "magnifyingglass"
      )
      AppShortcut(
        intent: OpenSpaceIntent(),
        phrases: [
          "Open \(\.$target) in \(.applicationName)",
          "Show my \(\.$target) space in \(.applicationName)",
        ],
        shortTitle: "Open a Space",
        systemImageName: "square.stack"
      )
    }
    #endif
    // `SaveImageIntent` has no phrases on purpose. "Save this image to Amber" then reaches
    // `SaveNoteIntent`, which gets the image on screen; a plain intent gets no screen content,
    // so Siri made the user pick the image in Shortcuts. The builder only allows `#available`,
    // so the phrases cannot be kept for older iOS alone.
    if #available(iOS 18.0, *) {
      AppShortcut(
        intent: SaveLinkIntent(),
        phrases: [
          "Save this page to \(.applicationName)",
          "Save this link to \(.applicationName)",
        ],
        shortTitle: "Save a Link",
        systemImageName: "link"
      )
    }
  }

  static let shortcutTileColor: ShortcutTileColor = .orange
}
