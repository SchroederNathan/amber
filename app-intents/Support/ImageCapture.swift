import AppIntents
internal import ExpoAppIntents
internal import SubjectLift
import Foundation
import UniformTypeIdentifiers

/// Saves Siri's photos and screenshots straight to Amber as image items, for `SaveNoteIntent`
/// ("save this to Amber") and `SaveImageIntent` ("save this image to Amber"). When the user
/// named an object in a single photo ("save this chair"), that object alone is saved as a
/// die-cut sticker instead (see `StickerTarget`); if no object matches, the photo is saved as
/// is. Images that fail to upload wait for the app.
@available(iOS 18.0, *)
enum ImageCapture {
  /// Returns the first saved item id (nil when every image was queued for the app) and what
  /// Siri should say.
  @MainActor
  static func save(
    _ images: [CaptureRouter.Attachment], words: String, sticker: StickerTarget?, spaceId: String?,
    spaceName: String?, intent: String, trace: String
  ) async throws -> (itemId: String?, dialog: IntentDialog) {
    let whereSuffix = spaceName.map { " to \($0)" } ?? ""

    if images.count == 1, let target = sticker {
      if let saved = await saveSticker(images[0], target: target, spaceId: spaceId, intent: intent, trace: trace) {
        let what = saved.name.map { "the \($0)" } ?? "it"
        return (saved.itemId, "Cut out \(what) and saved it\(whereSuffix) in Amber.")
      }
    }

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
          words.isEmpty ? nil : "Siri: \(words)",
          prepared.recognizedText.isEmpty ? nil : "Text in the image:\n\(prepared.recognizedText)",
        ].compactMap { $0 }.joined(separator: "\n\n")
        let itemId = try await AmberCapture.save(
          kind: "image", text: context, storageId: storageId, aspectRatio: prepared.aspectRatio,
          spaceId: spaceId, trace: trace)
        AmberIntentLog.record("\(intent) saved image \(itemId)")
        savedIds.append(itemId)
      } catch {
        AmberIntentLog.record("\(intent) image capture failed: \(error)")
        unsaved.append(image)
      }
    }

    if !unsaved.isEmpty {
      let paths = try stage(unsaved)
      await AppIntentDispatcher.shared.dispatch(
        name: "saveImages",
        params: [
          "paths": .array(paths.map(AppIntentValue.string)),
          "spaceId": spaceId.map { .string($0) } ?? .null,
        ]
      )
    }

    if unsaved.isEmpty {
      let dialog: IntentDialog =
        images.count == 1
        ? (spaceName.map { "Saved to \($0) in Amber." } ?? "Saved to Amber.")
        : "Saved \(images.count) images\(whereSuffix) in Amber."
      return (savedIds.first, dialog)
    }
    if savedIds.isEmpty {
      return (nil, "Your images will be saved\(whereSuffix) when you open Amber.")
    }
    return (savedIds.first, "Saved \(savedIds.count) of \(images.count) images. Amber will save the rest when you open it.")
  }

  /// Cuts the named object out on the device and saves it as a sticker. Nil when no object
  /// matched or the save failed, so the caller saves the plain photo instead.
  @MainActor
  private static func saveSticker(
    _ image: CaptureRouter.Attachment, target: StickerTarget, spaceId: String?, intent: String, trace: String
  ) async -> (itemId: String, name: String?)? {
    do {
      let cut = try await Task.detached(priority: .userInitiated) { () -> (png: Data, ratio: Double, name: String?)? in
        guard let cut = try target.cut(from: image.data) else { return nil }
        return (cut.sticker.png, Double(cut.sticker.width) / Double(max(cut.sticker.height, 1)), cut.name)
      }.value
      guard let cut else {
        AmberIntentLog.record("\(intent) no object matched \(target.nouns); saving the photo")
        return nil
      }
      let storageId = try await AmberCapture.uploadImage(cut.png, contentType: "image/png")
      let itemId = try await AmberCapture.save(
        kind: "image", storageId: storageId, aspectRatio: cut.ratio, isSticker: true, spaceId: spaceId,
        trace: "\(trace) sticker=\(cut.name == nil ? "largest" : "matched")")
      AmberIntentLog.record("\(intent) saved sticker \(itemId)")
      return (itemId, cut.name)
    } catch {
      AmberIntentLog.record("\(intent) sticker capture failed: \(error); saving the photo")
      return nil
    }
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
