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
  @Parameter(supportedContentTypes: [.image, .url, .webArchive, .internetLocation, .html])
  var attachments: [IntentFile]
  var isPinned: Bool
  var folder: SpaceEntity?

  @MainActor
  func perform() async throws -> some IntentResult & ReturnsValue<NoteEntity> & ProvidesDialog {
    guard !isPinned else { throw CaptureInputError.pinningUnsupported }
    let nameText = String(name.characters)
    let contentText = content.map { String($0.characters) }
    let text = Self.noteText(name: nameText, content: contentText)
    let links = CaptureRouter.linkAttributes(in: [name] + (content.map { [$0] } ?? []))
    let files = attachments.map { CaptureRouter.Attachment(data: $0.data, type: $0.type, filename: $0.filename) }
    guard files.filter(CaptureRouter.isImage).count <= CaptureRouter.maxImages else {
      throw CaptureInputError.tooManyImages
    }
    guard files.allSatisfy({ CaptureRouter.isImage($0) || CaptureRouter.pageURL($0) != nil }) else {
      throw CaptureInputError.unsupportedAttachment
    }
    let route = CaptureRouter.route(text: text, linkAttributes: links, attachments: files)
    let trace = CaptureRouter.trace(
      intent: "SaveNoteIntent", name: nameText, content: contentText, linkAttributes: links, attachments: files,
      route: route)
    AmberIntentLog.record("SaveNoteIntent.perform folder=\(folder?.id ?? "-") \(trace)")

    let saved: (NoteEntity, IntentDialog)
    switch route {
    case .link(let url):
      saved = try await saveLink(url, trace: trace)
    case .images(let images):
      saved = try await saveImages(images, text: text, trace: trace)
    case .note:
      guard !text.isEmpty else {
        throw $name.needsValueError("What should the note say?")
      }
      saved = try await saveNote(text, trace: trace)
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
  private func saveLink(_ url: URL, trace: String) async throws -> (NoteEntity, IntentDialog) {
    let requestId = UUID().uuidString
    let ownerId = AmberCapture.load()?.userId
    let title = url.host()?.replacingOccurrences(of: "www.", with: "") ?? url.absoluteString
    do {
      let itemId = try await AmberCapture.save(
        requestId: requestId, kind: "link", url: url.absoluteString, spaceId: folder?.id, trace: trace)
      AmberIntentLog.record("SaveNoteIntent saved link \(itemId)")
      let dialog: IntentDialog = folder.map { "Saved \(title) to \($0.name) in Amber." } ?? "Saved \(title) to Amber."
      return (NoteEntity(id: itemId, text: url.absoluteString, folder: folder), dialog)
    } catch {
      AmberIntentLog.record("SaveNoteIntent link capture failed: \(error)")
      await AppIntentDispatcher.shared.dispatch(
        name: "saveLink",
        params: ["url": .string(url.absoluteString), "spaceId": folder.map { .string($0.id) } ?? .null,
          "requestId": .string(requestId), "userId": ownerId.map(AppIntentValue.string) ?? .null]
      )
      throw CaptureInputError.deferred("Amber will finish saving \(title)\(whereSuffix) the next time you open it.")
    }
  }

  /// Photos and screenshots: uploaded straight to Amber as image items, with Siri's words and
  /// the text read on the device as context for the classifier. "Save this chair" on one photo
  /// saves the chair alone as a sticker. Images that fail wait for the app, as before.
  @MainActor
  private func saveImages(_ images: [CaptureRouter.Attachment], text: String, trace: String) async throws
    -> (NoteEntity, IntentDialog)
  {
    let saved = try await ImageCapture.save(
      images, words: text, sticker: StickerTarget(words: text), spaceId: folder?.id, spaceName: folder?.name,
      intent: "SaveNoteIntent", trace: trace)
    let label = text.isEmpty ? (images.count == 1 ? "Image" : "Images") : text
    guard let itemId = saved.itemId else {
      throw CaptureInputError.deferred("Amber will finish saving your images\(whereSuffix) the next time you open it.")
    }
    return (NoteEntity(id: itemId, text: label, folder: folder), saved.dialog)
  }

  @MainActor
  private func saveNote(_ text: String, trace: String) async throws -> (NoteEntity, IntentDialog) {
    let requestId = UUID().uuidString
    let ownerId = AmberCapture.load()?.userId
    do {
      let itemId = try await AmberCapture.save(requestId: requestId, kind: "note", text: text, spaceId: folder?.id, trace: trace)
      AmberIntentLog.record("SaveNoteIntent saved \(itemId)")
      return (NoteEntity(id: itemId, text: text, folder: folder), savedDialog)
    } catch {
      AmberIntentLog.record("SaveNoteIntent capture failed: \(error)")
      await AppIntentDispatcher.shared.dispatch(
        name: "saveNote",
        params: ["text": .string(text), "spaceId": folder.map { .string($0.id) } ?? .null,
          "requestId": .string(requestId), "userId": ownerId.map(AppIntentValue.string) ?? .null]
      )
      throw CaptureInputError.deferred("Amber will finish saving your note\(whereSuffix) the next time you open it.")
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
}
#endif

/// A plain intent with an image parameter, so Shortcuts and the share sheet can hand Amber
/// photos and screenshots on any iOS 18 device. It has no Siri phrases: Siri cannot fill the
/// parameter from the screen, so "save this image to Amber" goes to `SaveNoteIntent` instead.
/// Naming an object in "Cut Out" ("the chair") saves that object as a die-cut sticker instead.
@available(iOS 18.0, *)
struct SaveImageIntent: AppIntent {
  static let title: LocalizedStringResource = "Save an Image"
  static let description = IntentDescription(
    "Saves photos and screenshots to Amber, which tags and files them. Name an object to cut it out as a sticker.")
  static let openAppWhenRun: Bool = false

  @Parameter(title: "Images", supportedContentTypes: [.image], requestValueDialog: "Which image should Amber save?")
  var images: [IntentFile]

  @Parameter(
    title: "Cut Out", description: "An object to cut out of the image as a sticker, like \"the chair\".")
  var cutOut: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Save \(\.$images) to Amber") {
      \.$cutOut
    }
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard images.count <= CaptureRouter.maxImages else { throw CaptureInputError.tooManyImages }
    let files = images
      .map { CaptureRouter.Attachment(data: $0.data, type: $0.type, filename: $0.filename) }
      .filter(CaptureRouter.isImage)
    guard !files.isEmpty else {
      throw $images.needsValueError("Which image should Amber save?")
    }
    let words = cutOut?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let batch = Array(files.prefix(CaptureRouter.maxImages))
    let trace = CaptureRouter.trace(
      intent: "SaveImageIntent", name: words, content: nil, linkAttributes: [], attachments: files,
      route: .images(batch))
    AmberIntentLog.record("SaveImageIntent.perform \(trace)")
    let saved = try await ImageCapture.save(
      batch, words: words, sticker: StickerTarget(words: words, explicit: true), spaceId: nil, spaceName: nil,
      intent: "SaveImageIntent", trace: trace)
    return .result(dialog: saved.dialog)
  }
}

/// Saves an explicit URL supplied by Shortcuts. On-screen Siri capture uses `SaveNoteIntent`;
/// this plain intent cannot assume it receives Safari's current page. It returns only a dialog:
/// returning a `browser.bookmark` schema entity (or using `browser.bookmarkURL`) made iOS 27
/// stall the action before `perform()` ran, until the app was killed.
@available(iOS 18.0, *)
struct SaveLinkIntent: AppIntent {
  static let title: LocalizedStringResource = "Save a Link"
  static let description = IntentDescription("Saves a web page to Amber, which reads and tags it for you.")
  static let openAppWhenRun: Bool = false

  // Optional so missing screen context reaches `perform()` instead of looping in Siri's
  // required-parameter resolution. Never report a save or queue an invocation without a URL.
  @Parameter(title: "URL")
  var url: URL?

  @Parameter(title: "Name")
  var name: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Save \(\.$url) to Amber")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let url else {
      AmberIntentLog.record("SaveLinkIntent.perform missing URL")
      return .result(dialog: "No link was provided. In Safari, tap Share and choose Amber to save this page.")
    }
    guard CaptureRouter.isWebURL(url) else { throw CaptureInputError.webURLRequired }
    let requestId = UUID().uuidString
    let ownerId = AmberCapture.load()?.userId
    AmberIntentLog.record("SaveLinkIntent.perform")
    let title = name?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? url.host() ?? url.absoluteString
    do {
      let itemId = try await AmberCapture.save(
        requestId: requestId, kind: "link", url: url.absoluteString, trace: "intent=SaveLinkIntent route=link")
      AmberIntentLog.record("SaveLinkIntent saved \(itemId)")
      return .result(dialog: "Saved \(title) to Amber.")
    } catch {
      AmberIntentLog.record("SaveLinkIntent capture failed: \(error)")
      await AppIntentDispatcher.shared.dispatch(name: "saveLink", params: [
        "url": .string(url.absoluteString), "requestId": .string(requestId),
        "userId": ownerId.map(AppIntentValue.string) ?? .null,
      ])
      return .result(dialog: "Amber will finish saving \(title) the next time you open it.")
    }
  }
}

extension String {
  fileprivate var nilIfEmpty: String? { isEmpty ? nil : self }
}

enum CaptureInputError: LocalizedError {
  case tooManyImages
  case unsupportedAttachment
  case deferred(String)
  case pinningUnsupported
  case webURLRequired

  var errorDescription: String? {
    switch self {
    case .tooManyImages: return "Save at most 10 images at a time in Amber."
    case .unsupportedAttachment: return "Amber can save images and web links. Remove the other attachments and try again."
    case .deferred(let message): return message
    case .pinningUnsupported: return "Amber does not support pinned saves. Save this without pinning it."
    case .webURLRequired: return "Choose an http or https web link to save in Amber."
    }
  }
}
