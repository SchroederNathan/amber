import AppIntents
internal import ExpoAppIntents
import Foundation

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
    return await AmberCatalog.spaces(matching: identifiers).map(SpaceEntity.init(record:))
  }

  func suggestedEntities() async throws -> [SpaceEntity] {
    return await AmberCatalog.spaces().map(SpaceEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [SpaceEntity] {
    return await AmberCatalog.spaces()
      .filter { AmberCatalog.matches($0, query: string) }
      .map(SpaceEntity.init(record:))
  }

  func allEntities() async throws -> [SpaceEntity] {
    return await AmberCatalog.spaces().map(SpaceEntity.init(record:))
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
struct AmberAccountQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [AmberAccountEntity] {
    return identifiers.contains(AmberAccountEntity.amber.id) ? [.amber] : []
  }

  func suggestedEntities() async throws -> [AmberAccountEntity] {
    return [.amber]
  }
}

/// A note saved in Amber, as the `notes` schema describes it. Returned by `SaveNoteIntent`.
@available(iOS 27.0, *)
@AppEntity(schema: .notes.note)
struct NoteEntity {
  static let defaultQuery = NoteQuery()

  var id: String
  var name: AttributedString
  var content: AttributedString?
  var attachments: [IntentFile]
  var isPinned: Bool
  var creationDate: Date?
  var modificationDate: Date?
  var folder: SpaceEntity?

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
  }

  init(record: AppIntentEntityRecord) {
    self.init(
      id: record.id,
      text: record.metadata["text"] ?? record.title,
      folder: nil,
      creationDate: record.metadata["savedAt"].flatMap(Double.init).map {
        Date(timeIntervalSince1970: $0 / 1000)
      }
    )
    self.name = AttributedString(record.title)
  }

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(String(name.characters))", subtitle: "Amber note")
  }
}

@available(iOS 27.0, *)
struct NoteQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [NoteEntity] {
    return await AmberCatalog.items(matching: identifiers)
      .filter { $0.metadata["kind"] == "note" }
      .map(NoteEntity.init(record:))
  }

  func suggestedEntities() async throws -> [NoteEntity] {
    return await AmberCatalog.items()
      .filter { $0.metadata["kind"] == "note" }
      .prefix(20)
      .map(NoteEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [NoteEntity] {
    return await AmberCatalog.items()
      .filter { $0.metadata["kind"] == "note" && AmberCatalog.matches($0, query: string) }
      .prefix(20)
      .map(NoteEntity.init(record:))
  }
}
#endif
