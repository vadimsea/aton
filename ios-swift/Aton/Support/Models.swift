import Foundation
import SwiftUI

struct AtonUser: Identifiable, Codable, Hashable {
    let id: String
    var email: String?
    var username: String
    var publicId: String?
    var displayName: String
    var bio: String?
    var avatarDataUrl: String?
    var lastSeen: Date?
    var verified: Bool?
    var isVerified: Bool?
    var isSuperAdmin: Bool?
}

struct AtonChat: Identifiable, Codable, Hashable {
    let id: String
    var type: String
    var title: String?
    var description: String?
    var owner: String?
    var ownerId: String?
    var visibility: String?
    var verified: Bool?
    var avatarDataUrl: String?
    var peerUsername: String?
    var peerDisplayName: String?
    var peerAvatarDataUrl: String?
    var preview: String?
    var lastTime: String?
    var unread: Int?
    var createdAt: Date?
    var members: [String]?
    var admins: [String]?
}

struct AtonMessage: Identifiable, Codable, Hashable {
    let id: String
    var chatId: String
    var from: String
    var to: String?
    var type: String
    var text: String?
    var imageDataUrl: String?
    var audioDataUrl: String?
    var time: Date
    var status: String?
    var pinned: Bool?
    var reactions: [AtonReaction]?
    var senderDisplayName: String?
    var senderAvatarDataUrl: String?
}

struct AtonReaction: Codable, Hashable {
    var emoji: String
    var user: String?
    var by: String?
}

struct AtonReport: Identifiable, Codable, Hashable {
    let id: String
    var targetType: String?
    var chatId: String?
    var targetUserId: String?
    var messageId: String?
    var reportedBy: String
    var reason: String
    var status: String
    var createdAt: Date?
    var reporter: AtonUser?
    var targetUser: AtonUser?
    var chat: AtonChat?
    var message: AtonMessage?
}

struct AtonLinkPreview: Codable, Hashable {
    var url: String
    var finalUrl: String?
    var title: String?
    var description: String?
    var image: String?
    var siteName: String?
    var type: String?
    var provider: String?
}

struct LoginResponse: Codable {
    let token: String
    let user: AtonUser
}

struct MessageEnvelope: Codable {
    var chats: [AtonChat]?
    var messages: [AtonMessage]?
}

enum AtonLanguage: String, CaseIterable, Identifiable {
    case ru
    case de
    case en

    var id: String { rawValue }

    var title: String {
        switch self {
        case .ru: return "Русский"
        case .de: return "Deutsch"
        case .en: return "English"
        }
    }
}

enum AtonTheme: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

extension AtonChat {
    var lastTimeDate: Date? {
        guard let lastTime, !lastTime.isEmpty else { return nil }
        if let date = ISO8601DateFormatter.aton.date(from: lastTime) { return date }
        return ISO8601DateFormatter().date(from: lastTime)
    }
}
