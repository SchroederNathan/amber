import AppIntents
import CoreSpotlight
import CoreTransferable
internal import ExpoAppIntents
import Foundation
import UniformTypeIdentifiers

// Amber speaks Apple's iOS 27 `notes` schema so the new Siri can create notes in Amber and
// file them into a space without any shortcut phrase: spaces are the schema's folders.

#if compiler(>=6.4)
/// An Amber space, exposed to Siri as a notes folder. Built from the `space` catalog.
@available(iOS 27.0, *)
@AppEntity(schema: .notes.folder)
struct SpaceEntity: AppIntentEntityRecordConvertible {
  static let defaultQuery = SpaceQuery()

  var id: String
  var name: String
  var parentFolder: SpaceEntity?
  var account: AmberAccountEntity?

  init(record: AppIntentEntityRecord) {
    self.id = record.id
    self.name = record.title
    self.parentFolder = nil
    self.account = .amber
  }

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)", subtitle: "Amber space", image: .init(systemName: "square.stack"))
  }
}

@available(iOS 27.0, *)
struct SpaceQuery: EntityStringQuery, EnumerableEntityQuery {
  func entities(for identifiers: [String]) async throws -> [SpaceEntity] {
    return try await AmberCatalog.spaces(matching: identifiers).map(SpaceEntity.init(record:))
  }

  func suggestedEntities() async throws -> [SpaceEntity] {
    return try await AmberCatalog.spaces().map(SpaceEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [SpaceEntity] {
    return try await AmberCatalog.spaces()
      .filter { AmberCatalog.matches($0, query: string) }
      .map(SpaceEntity.init(record:))
  }

  func allEntities() async throws -> [SpaceEntity] {
    return try await AmberCatalog.spaces().map(SpaceEntity.init(record:))
  }
}

/// Amber has one "account": the signed-in user's hub.
@available(iOS 27.0, *)
@AppEntity(schema: .notes.account)
struct AmberAccountEntity {
  static let defaultQuery = AmberAccountQuery()
  static let amber = AmberAccountEntity(id: "amber", name: "Amber")

  var id: String
  var name: String

  init(id: String, name: String) {
    self.id = id
    self.name = name
  }

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)")
  }
}

@available(iOS 27.0, *)
struct AmberAccountQuery: EntityStringQuery {
  func entities(matching string: String) async throws -> [AmberAccountEntity] {
    return "Amber".localizedStandardContains(string) ? [.amber] : []
  }
  func entities(for identifiers: [String]) async throws -> [AmberAccountEntity] {
    return identifiers.contains(AmberAccountEntity.amber.id) ? [.amber] : []
  }

  func suggestedEntities() async throws -> [AmberAccountEntity] {
    return [.amber]
  }
}

/// Amber saves as schema-backed notes, including links with their saved article bodies.
/// Indexing only the generic ItemEntity lets Siri find a title, but not reason about its content.
@available(iOS 27.0, *)
@AppEntity(schema: .notes.note)
struct NoteEntity: IndexedEntity, AppIntentEntityRecordConvertible {
  static let defaultQuery = NoteQuery()
  static let spotlightDomainIdentifier = "amber.note"

  var id: String
  var name: AttributedString

  @Property(indexingKey: \.textContent)
  var content: AttributedString?
  var attachments: [IntentFile]
  var isPinned: Bool
  var creationDate: Date?
  var modificationDate: Date?
  var folder: SpaceEntity?

  // Retain the original save's URL/image transfer behavior when this schema represents it.
  private var originalItem: ItemEntity?

  init(id: String, text: String, folder: SpaceEntity?, creationDate: Date? = Date()) {
    let firstLine = text.split(separator: "\n", maxSplits: 1).first.map(String.init) ?? text
    self.id = id
    self.name = AttributedString(String(firstLine.prefix(80)))
    self.content = AttributedString(text)
    self.attachments = []
    self.isPinned = false
    self.creationDate = creationDate
    self.modificationDate = creationDate
    self.folder = folder
    self.originalItem = nil
  }

  init(record: AppIntentEntityRecord) {
    let source = AmberCatalog.content(for: record.id) ?? record.metadata["text"]
    self.init(
      id: record.id,
      text: source ?? "",
      folder: nil,
      creationDate: record.metadata["savedAt"].flatMap(Double.init).map {
        Date(timeIntervalSince1970: $0 / 1000)
      }
    )
    self.name = AttributedString(record.title)
    self.content = source.map { AttributedString($0) }
    self.originalItem = ItemEntity(record: record)
  }

  var displayRepresentation: DisplayRepresentation {
    if let originalItem { return originalItem.displayRepresentation }
    return DisplayRepresentation(title: "\(String(name.characters))", subtitle: "Amber save")
  }

  var attributeSet: CSSearchableItemAttributeSet {
    let attributes = defaultAttributeSet
    attributes.title = String(name.characters)
    attributes.displayName = String(name.characters)
    attributes.contentDescription = originalItem?.summary
    attributes.textContent = content.map { String($0.characters) }
    attributes.keywords = (originalItem?.tags ?? []) + ["Amber"]
    attributes.contentURL = originalItem?.url
    attributes.addedDate = creationDate
    attributes.thumbnailData = AmberCatalog.thumbnailData(for: id)
    attributes.domainIdentifier = Self.spotlightDomainIdentifier
    return attributes
  }
}

@available(iOS 27.0, *)
extension NoteEntity: Transferable {
  static var transferRepresentation: some TransferRepresentation {
    ProxyRepresentation { (note: NoteEntity) in
      note.originalItem?.url ?? URL(string: "amber:///item/\(note.id)")!
    }
    .exportingCondition { $0.originalItem?.url != nil }

    FileRepresentation(exportedContentType: .image) { (note: NoteEntity) in
      guard let item = note.originalItem else { throw CocoaError(.fileNoSuchFile) }
      return SentTransferredFile(try await item.downloadImage())
    }
    .exportingCondition { $0.originalItem?.kind == "image" && $0.originalItem?.imageUrl != nil }

    ProxyRepresentation(exporting: { (note: NoteEntity) in
      note.originalItem?.shareText ?? note.content.map { String($0.characters) } ?? String(note.name.characters)
    })
  }
}

@available(iOS 27.0, *)
struct NoteQuery: EntityStringQuery, EnumerableEntityQuery, IndexedEntityQuery {
  func entities(for identifiers: [String]) async throws -> [NoteEntity] {
    return try await AmberCatalog.items(matching: identifiers)
      .map(NoteEntity.init(record:))
  }

  func suggestedEntities() async throws -> [NoteEntity] {
    return try await AmberCatalog.items()
      .prefix(20)
      .map(NoteEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [NoteEntity] {
    return try await AmberCatalog.items()
      .filter { AmberCatalog.matches($0, query: string) }
      .prefix(20)
      .map(NoteEntity.init(record:))
  }

  func allEntities() async throws -> [NoteEntity] {
    return try await AmberCatalog.items().map(NoteEntity.init(record:))
  }

  func reindexEntities(
    for identifiers: [NoteEntity.ID], indexDescription: CSSearchableIndexDescription
  ) async throws {
    _ = try await AmberSpotlight.syncItems()
  }

  func reindexAllEntities(indexDescription: CSSearchableIndexDescription) async throws {
    _ = try await AmberSpotlight.syncItems()
  }
}
#endif
