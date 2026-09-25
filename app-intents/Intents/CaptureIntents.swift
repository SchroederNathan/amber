import AppIntents
internal import ExpoAppIntents
import Foundation
import UniformTypeIdentifiers

// Capture intents save straight to Convex (`AmberCapture`) so Siri answers without opening
// Amber. If that is not possible (signed out, offline), the capture is queued for JavaScript
// (`src/lib/app-intents.tsx`), which saves it the next time Amber opens.

#if compiler(>=6.4)
/// "Save a note in Amber: try the ramen place on 5th." The iOS 27 Siri finds this through the
/// `notes.createNote` schema, so no shortcut phrase is needed.
@available(iOS 27.0, *)
@AppIntent(schema: .notes.createNote)
struct SaveNoteIntent {
  static let openAppWhenRun: Bool = false

  var name: AttributedString
  var content: AttributedString?
  var attachments: [IntentFile]
  var isPinned: Bool
  var folder: SpaceEntity?

  @MainActor
  func perform() async throws -> some IntentResult & ReturnsValue<NoteEntity> & ProvidesDialog {
    AmberIntentLog.record("SaveNoteIntent.perform folder=\(folder?.id ?? "-") attachments=\(attachments.count)")
    let text = Self.noteText(name: String(name.characters), content: content.map { String($0.characters) })
    let spaceId = folder?.id
    let where_ = folder.map { " to \($0.name)" } ?? ""
    let savedDialog: IntentDialog = folder.map { "Saved to \($0.name) in Amber." } ?? "Saved to Amber."

    let imagePaths = try Self.stageAttachments(attachments)
    if !imagePaths.isEmpty {
      await AppIntentDispatcher.shared.dispatch(
        name: "saveImages",
        params: [
          "paths": .array(imagePaths.map(AppIntentValue.string)),
          "spaceId": spaceId.map(AppIntentValue.string) ?? .null,
        ]
      )
    }

    guard !text.isEmpty else {
      guard !imagePaths.isEmpty else {
        throw $name.needsValueError("What should the note say?")
      }
      let note = NoteEntity(id: UUID().uuidString, text: "Photos", folder: folder)
      return .result(value: note, dialog: "Your photos will be saved\(where_) when you open Amber.")
    }

    do {
      let itemId = try await AmberCapture.save(kind: "note", text: text, spaceId: spaceId)
      AmberIntentLog.record("SaveNoteIntent saved \(itemId)")
      return .result(value: NoteEntity(id: itemId, text: text, folder: folder), dialog: savedDialog)
    } catch {
      AmberIntentLog.record("SaveNoteIntent capture failed: \(error)")
      let invocationId = await AppIntentDispatcher.shared.dispatch(
        name: "saveNote",
        params: ["text": .string(text), "spaceId": spaceId.map(AppIntentValue.string) ?? .null]
      )
      return .result(
        value: NoteEntity(id: invocationId, text: text, folder: folder),
        dialog: "Amber will finish saving your note\(where_) the next time you open it."
      )
    }
  }

  /// Siri may put the whole note in `name`, or a title in `name` and the body in `content`.
  static func noteText(name: String, content: String?) -> String {
    let title = name.trimmingCharacters(in: .whitespacesAndNewlines)
    let body = content?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if body.isEmpty || body == title { return title }
    if title.isEmpty || body.hasPrefix(title) { return body }
    return "\(title)\n\n\(body)"
  }

  /// Copies attached images somewhere JavaScript can read them after the intent returns.
  static func stageAttachments(_ files: [IntentFile]) throws -> [String] {
    guard !files.isEmpty else { return [] }
    let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let directory = caches.appendingPathComponent("siri-attachments", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return try files
      .filter { $0.type?.conforms(to: .image) ?? true }
      .map { file in
        let ext = file.type?.preferredFilenameExtension ?? "jpg"
        let destination = directory.appendingPathComponent("\(UUID().uuidString).\(ext)")
        try file.data.write(to: destination)
        return destination.path
      }
  }
}
#endif

/// "Save this page to Amber." A plain intent with a URL parameter, so Siri can pass it the page
/// on screen. It returns only a dialog: returning a `browser.bookmark` schema entity (or using the
/// `browser.bookmarkURL` schema, which requires one) made iOS 27 stall the action before
/// `perform()` ran, until the app was killed.
@available(iOS 18.0, *)
struct SaveLinkIntent: AppIntent {
  static let title: LocalizedStringResource = "Save a Link"
  static let description = IntentDescription("Saves a web page to Amber, which reads and tags it for you.")
  static let openAppWhenRun: Bool = false

  @Parameter(title: "URL", requestValueDialog: "Which link should Amber save?")
  var url: URL

  @Parameter(title: "Name")
  var name: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Save \(\.$url) to Amber")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    AmberIntentLog.record("SaveLinkIntent.perform url=\(url.absoluteString)")
    let title = name?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? url.host() ?? url.absoluteString
    do {
      let itemId = try await AmberCapture.save(kind: "link", url: url.absoluteString)
      AmberIntentLog.record("SaveLinkIntent saved \(itemId)")
      return .result(dialog: "Saved \(title) to Amber.")
    } catch {
      AmberIntentLog.record("SaveLinkIntent capture failed: \(error)")
      await AppIntentDispatcher.shared.dispatch(name: "saveLink", params: ["url": .string(url.absoluteString)])
      return .result(dialog: "Amber will finish saving \(title) the next time you open it.")
    }
  }
}

extension String {
  fileprivate var nilIfEmpty: String? { isEmpty ? nil : self }
}
