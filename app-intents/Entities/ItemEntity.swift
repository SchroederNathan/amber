import AppIntents
import CoreSpotlight
import CoreTransferable
internal import ExpoAppIntents
import Foundation
import UniformTypeIdentifiers

/// One thing saved in Amber: a link, a note, or a photo. Built from the `item` catalog.
@available(iOS 18.0, *)
struct ItemEntity: AppEntity, IndexedEntity, AppIntentEntityRecordConvertible {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(
    name: "Amber Save",
    numericFormat: "\(placeholder: .int) Amber saves"
  )
  static let defaultQuery = ItemQuery()

  var id: String

  @Property(title: "Title")
  var title: String

  @Property(title: "Summary")
  var summary: String?

  @Property(title: "Kind")
  var kind: String

  @Property(title: "Link")
  var url: URL?

  @Property(title: "Note")
  var text: String?

  @Property(title: "Tags")
  var tags: [String]

  @Property(title: "Saved")
  var savedAt: Date?

  var site: String?
  var imageUrl: URL?
  var hideInSpotlight: Bool

  init(record: AppIntentEntityRecord) {
    let metadata = record.metadata
    self.id = record.id
    self.hideInSpotlight = record.hideInSpotlight
    self.title = record.title
    self.summary = record.subtitle
    self.kind = metadata["kind"] ?? "note"
    self.url = metadata["url"].flatMap(URL.init(string:))
    self.text = metadata["text"]
    self.tags = record.synonyms
    self.savedAt = metadata["savedAt"].flatMap(Double.init).map { Date(timeIntervalSince1970: $0 / 1000) }
    self.site = metadata["site"]
    self.imageUrl = metadata["imageUrl"].flatMap(URL.init(string:))
  }

  var displayRepresentation: DisplayRepresentation {
    let subtitle = summary ?? site ?? kindLabel
    if let data = AmberCatalog.thumbnailData(for: id) {
      return DisplayRepresentation(title: "\(title)", subtitle: "\(subtitle)", image: .init(data: data))
    }
    return DisplayRepresentation(
      title: "\(title)",
      subtitle: "\(subtitle)",
      image: .init(systemName: symbolName)
    )
  }

  var kindLabel: String {
    switch kind {
    case "link": return "Link"
    case "image": return "Photo"
    default: return "Note"
    }
  }

  private var symbolName: String {
    switch kind {
    case "link": return "link"
    case "image": return "photo"
    default: return "note.text"
    }
  }

  static let spotlightDomainIdentifier = "amber.item"

  var attributeSet: CSSearchableItemAttributeSet {
    let attributes = defaultAttributeSet
    attributes.title = title
    attributes.displayName = title
    attributes.contentDescription = summary ?? text
    attributes.textContent = [summary, text, site].compactMap { $0 }.joined(separator: "\n")
    attributes.keywords = tags + [kindLabel, "Amber"]
    attributes.contentURL = url
    attributes.addedDate = savedAt
    attributes.thumbnailData = AmberCatalog.thumbnailData(for: id)
    attributes.domainIdentifier = Self.spotlightDomainIdentifier
    return attributes
  }

  /// Plain text Siri can hand to other apps ("send this to Sam").
  var shareText: String {
    if let url {
      return "\(title)\n\(url.absoluteString)"
    }
    if let text, !text.isEmpty {
      return text
    }
    return title
  }
}

@available(iOS 18.0, *)
extension ItemEntity: Transferable {
  static var transferRepresentation: some TransferRepresentation {
    ProxyRepresentation { (item: ItemEntity) in
      item.url ?? URL(string: "amber:///item/\(item.id)")!
    }
    .exportingCondition { $0.url != nil }

    FileRepresentation(exportedContentType: .jpeg) { item in
      let file = try await item.downloadImage()
      return SentTransferredFile(file)
    }
    .exportingCondition { $0.kind == "image" && $0.imageUrl != nil }

    ProxyRepresentation(exporting: \.shareText)
  }

  func downloadImage() async throws -> URL {
    guard let imageUrl else { throw CocoaError(.fileNoSuchFile) }
    let (temporary, _) = try await URLSession.shared.download(from: imageUrl)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(
      UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let destination = directory.appendingPathComponent("\(safeFilename).jpg")
    try FileManager.default.moveItem(at: temporary, to: destination)
    return destination
  }

  private var safeFilename: String {
    let invalid = CharacterSet(charactersIn: "/\\?%*|\"<>:").union(.newlines)
    let name = title.components(separatedBy: invalid).joined(separator: " ")
      .trimmingCharacters(in: .whitespaces)
    return name.isEmpty ? "Amber" : String(name.prefix(50))
  }
}

@available(iOS 18.0, *)
struct ItemQuery: EntityStringQuery, EnumerableEntityQuery {
  func entities(for identifiers: [String]) async throws -> [ItemEntity] {
    return await AmberCatalog.items(matching: identifiers).map(ItemEntity.init(record:))
  }

  func suggestedEntities() async throws -> [ItemEntity] {
    return await AmberCatalog.items().prefix(20).map(ItemEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [ItemEntity] {
    return await AmberCatalog.items()
      .filter { AmberCatalog.matches($0, query: string) }
      .prefix(30)
      .map(ItemEntity.init(record:))
  }

  func allEntities() async throws -> [ItemEntity] {
    return await AmberCatalog.items().map(ItemEntity.init(record:))
  }
}

#if compiler(>=6.4)
@available(iOS 27.0, *)
extension ItemQuery: IndexedEntityQuery {
  func reindexEntities(
    for identifiers: [ItemEntity.ID],
    indexDescription: CSSearchableIndexDescription
  ) async throws {
    _ = try await AmberSpotlight.syncItems()
  }

  func reindexAllEntities(indexDescription: CSSearchableIndexDescription) async throws {
    _ = try await AmberSpotlight.syncItems()
  }
}
#endif
