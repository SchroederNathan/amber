import AppIntents
internal import ExpoAppIntents
import Foundation
import UniformTypeIdentifiers

// Capture intents save straight to Convex (`AmberCapture`) so Siri answers without opening
// Amber. If that is not possible (signed out, offline), the capture is queued for JavaScript
// (`src/lib/app-intents.tsx`), which saves it the next time Amber opens.

#if compiler(>=6.4)
/// "Save a note in Amber: try the ramen place on 5th." The iOS 27 Siri finds this through the
/// `notes.createNote` schema, so no shortcut phrase is needed. Siri also sends "save this to
/// Amber" here for whatever is on screen, so `CaptureRouter` turns a page into a link and a
/// photo or screenshot into an image item; only plain text stays a note.
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
    let nameText = String(name.characters)
    let contentText = content.map { String($0.characters) }
    let text = Self.noteText(name: nameText, content: contentText)
    let links = CaptureRouter.linkAttributes(in: [name] + (content.map { [$0] } ?? []))
    let files = attachments.map { CaptureRouter.Attachment(data: $0.data, type: $0.type, filename: $0.filename) }
    let route = CaptureRouter.route(text: text, linkAttributes: links, attachments: files)
    let trace = CaptureRouter.trace(
      intent: "SaveNoteIntent", name: nameText, content: contentText, linkAttributes: links, attachments: files,
      route: route)
    AmberIntentLog.record("SaveNoteIntent.perform folder=\(folder?.id ?? "-") \(trace)")

    let saved: (NoteEntity, IntentDialog)
    switch route {
    case .link(let url):
      saved = await saveLink(url, trace: trace)
    case .images(let images):
      saved = try await saveImages(images, text: text, trace: trace)
    case .note:
      guard !text.isEmpty else {
        throw $name.needsValueError("What should the note say?")
      }
      saved = await saveNote(text, trace: trace)
    }
    return .result(value: saved.0, dialog: saved.1)
  }

  private var savedDialog: IntentDialog {
    folder.map { "Saved to \($0.name) in Amber." } ?? "Saved to Amber."
  }

  private var whereSuffix: String {
    folder.map { " to \($0.name)" } ?? ""
  }

  /// A page Siri passed along (from any browser): saved as a link, so Amber reads the article.
  @MainActor
  private func saveLink(_ url: URL, trace: String) async -> (NoteEntity, IntentDialog) {
    let title = url.host()?.replacingOccurrences(of: "www.", with: "") ?? url.absoluteString
    do {
      let itemId = try await AmberCapture.save(
        kind: "link", url: url.absoluteString, spaceId: folder?.id, trace: trace)
      AmberIntentLog.record("SaveNoteIntent saved link \(itemId)")
      let dialog: IntentDialog = folder.map { "Saved \(title) to \($0.name) in Amber." } ?? "Saved \(title) to Amber."
      return (NoteEntity(id: itemId, text: url.absoluteString, folder: folder), dialog)
    } catch {
      AmberIntentLog.record("SaveNoteIntent link capture failed: \(error)")
      let invocationId = await AppIntentDispatcher.shared.dispatch(
        name: "saveLink",
        params: ["url": .string(url.absoluteString), "spaceId": folder.map { .string($0.id) } ?? .null]
      )
      return (
        NoteEntity(id: invocationId, text: url.absoluteString, folder: folder),
        "Amber will finish saving \(title)\(whereSuffix) the next time you open it."
      )
    }
  }

  /// Photos and screenshots: uploaded straight to Amber as image items, with Siri's words and
  /// the text read on the device as context for the classifier. Images that fail wait for the
  /// app, as before.
  @MainActor
  private func saveImages(_ images: [CaptureRouter.Attachment], text: String, trace: String) async throws
    -> (NoteEntity, IntentDialog)
  {
    var savedIds: [String] = []
    var unsaved: [CaptureRouter.Attachment] = []
    for image in images {
      do {
        let prepared = await Task.detached(priority: .userInitiated) { await CaptureRouter.prepare(image) }.value
        guard let prepared else {
          throw AmberCapture.Failure.badResponse
        }
        let storageId = try await AmberCapture.uploadImage(prepared.data, contentType: prepared.contentType)
        let context = [
          text.isEmpty ? nil : "Siri: \(text)",
          prepared.recognizedText.isEmpty ? nil : "Text in the image:\n\(prepared.recognizedText)",
        ].compactMap { $0 }.joined(separator: "\n\n")
        let itemId = try await AmberCapture.save(
          kind: "image", text: context, storageId: storageId, aspectRatio: prepared.aspectRatio,
          spaceId: folder?.id, trace: trace)
        AmberIntentLog.record("SaveNoteIntent saved image \(itemId)")
        savedIds.append(itemId)
      } catch {
        AmberIntentLog.record("SaveNoteIntent image capture failed: \(error)")
        unsaved.append(image)
      }
    }

    if !unsaved.isEmpty {
      let paths = try Self.stage(unsaved)
      await AppIntentDispatcher.shared.dispatch(
        name: "saveImages",
        params: [
          "paths": .array(paths.map(AppIntentValue.string)),
          "spaceId": folder.map { .string($0.id) } ?? .null,
        ]
      )
    }

    let label = text.isEmpty ? (images.count == 1 ? "Image" : "Images") : text
    let entity = NoteEntity(id: savedIds.first ?? UUID().uuidString, text: label, folder: folder)
    if unsaved.isEmpty {
      let dialog: IntentDialog = images.count == 1 ? savedDialog : "Saved \(images.count) images\(whereSuffix) in Amber."
      return (entity, dialog)
    }
    if savedIds.isEmpty {
      return (entity, "Your images will be saved\(whereSuffix) when you open Amber.")
    }
    return (entity, "Saved \(savedIds.count) of \(images.count) images. Amber will save the rest when you open it.")
  }

  @MainActor
  private func saveNote(_ text: String, trace: String) async -> (NoteEntity, IntentDialog) {
    do {
      let itemId = try await AmberCapture.save(kind: "note", text: text, spaceId: folder?.id, trace: trace)
      AmberIntentLog.record("SaveNoteIntent saved \(itemId)")
      return (NoteEntity(id: itemId, text: text, folder: folder), savedDialog)
    } catch {
      AmberIntentLog.record("SaveNoteIntent capture failed: \(error)")
      let invocationId = await AppIntentDispatcher.shared.dispatch(
        name: "saveNote",
        params: ["text": .string(text), "spaceId": folder.map { .string($0.id) } ?? .null]
      )
      return (
        NoteEntity(id: invocationId, text: text, folder: folder),
        "Amber will finish saving your note\(whereSuffix) the next time you open it."
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

  /// Copies images somewhere JavaScript can read them after the intent returns.
  static func stage(_ images: [CaptureRouter.Attachment]) throws -> [String] {
    guard !images.isEmpty else { return [] }
    let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let directory = caches.appendingPathComponent("siri-attachments", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return try images.map { image in
      let ext = image.type?.preferredFilenameExtension ?? "jpg"
      let destination = directory.appendingPathComponent("\(UUID().uuidString).\(ext)")
      try image.data.write(to: destination)
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
      let itemId = try await AmberCapture.save(
        kind: "link", url: url.absoluteString, trace: "intent=SaveLinkIntent route=link")
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
