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

    let ownerId = AmberCapture.load()?.userId
    var savedIds: [String] = []
    var queuedCount = 0
    for image in images {
      let prepared: CaptureRouter.PreparedImage
      var stickerName: String?
      var isSticker = false
      if images.count == 1, let target = sticker,
        let cut = try? await Task.detached(priority: .userInitiated, operation: {
          try target.cut(from: image.data)
        }).value {
        prepared = CaptureRouter.PreparedImage(
          data: cut.sticker.png, contentType: "image/png",
          aspectRatio: Double(cut.sticker.width) / Double(max(cut.sticker.height, 1)), recognizedText: "")
        stickerName = cut.name
        isSticker = true
      } else {
        guard let result = await Task.detached(priority: .userInitiated, operation: {
          await CaptureRouter.prepare(image)
        }).value else { throw AmberCapture.Failure.badResponse }
        prepared = result
      }
      let requestId = UUID().uuidString
      let context = [
        words.isEmpty ? nil : "Siri: \(words)",
        prepared.recognizedText.isEmpty ? nil : "Text in the image:\n\(prepared.recognizedText)",
      ].compactMap { $0 }.joined(separator: "\n\n")
      do {
        let storageId = try await AmberCapture.uploadImage(prepared.data, contentType: prepared.contentType)
        let itemId = try await AmberCapture.save(
          requestId: requestId, kind: "image", text: context, storageId: storageId,
          aspectRatio: prepared.aspectRatio, isSticker: isSticker, spaceId: spaceId, trace: trace)
        savedIds.append(itemId)
        AmberIntentLog.record("\(intent) saved image \(itemId)")
        if isSticker {
          let what = stickerName.map { "the \($0)" } ?? "it"
          return (itemId, "Cut out \(what) and saved it\(whereSuffix) in Amber.")
        }
      } catch {
        AmberIntentLog.record("\(intent) image capture failed: \(error)")
        // Persist the prepared bytes and request ID, so retries keep OCR, format and sticker
        // metadata and cannot duplicate a save whose HTTP response was lost.
        let file = CaptureRouter.Attachment(
          data: prepared.data, type: UTType(mimeType: prepared.contentType), filename: image.filename)
        let paths = try stage([file])
        await AppIntentDispatcher.shared.dispatch(name: "saveImages", params: [
          "paths": .array(paths.map(AppIntentValue.string)),
          "requestId": .string(requestId),
          "userId": ownerId.map(AppIntentValue.string) ?? .null,
          "spaceId": spaceId.map(AppIntentValue.string) ?? .null,
          "text": .string(context),
          "mimeType": .string(prepared.contentType),
          "aspectRatio": prepared.aspectRatio.map(AppIntentValue.double) ?? .null,
          "isSticker": .bool(isSticker),
        ])
        queuedCount += 1
      }
    }

    if queuedCount == 0 {
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

  /// Copies images somewhere JavaScript can read them after the intent returns.
  static func stage(_ images: [CaptureRouter.Attachment]) throws -> [String] {
    guard !images.isEmpty else { return [] }
    let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let directory = documents.appendingPathComponent("siri-attachments", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return try images.map { image in
      let ext = image.type?.preferredFilenameExtension ?? "jpg"
      let destination = directory.appendingPathComponent("\(UUID().uuidString).\(ext)")
      try image.data.write(to: destination, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      return destination.path
    }
  }
}
