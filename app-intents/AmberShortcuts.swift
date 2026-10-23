import AppIntents

/// Phrases that work with classic Siri and show Amber's actions in Shortcuts and Spotlight.
/// The iOS 27 Siri also reaches the schema intents without these.
// Shortcut phrases are build-time metadata. Gate the provider with its intents.
#if compiler(>=6.4)
@available(iOS 27.0, *)
struct AmberShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
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
    // Keep the plain image and link actions available in Shortcuts without Siri phrases.
    // Phrases containing "this" selected those actions without the screen content: images
    // opened a picker, and links repeatedly asked which URL to save. On-screen capture uses
    // the iOS 27 `SaveNoteIntent` schema, which routes supplied links and attachments.
  }

  static let shortcutTileColor: ShortcutTileColor = .orange
}

#endif
