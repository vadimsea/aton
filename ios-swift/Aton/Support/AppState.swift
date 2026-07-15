import Foundation
import SwiftUI
import UIKit

@MainActor
final class AppState: ObservableObject {
    @Published var currentUser: AtonUser?
    @Published var chats: [AtonChat] = []
    @Published var adminChats: [AtonChat] = []
    @Published var discoverChats: [AtonChat] = []
    @Published var messages: [AtonMessage] = []
    @Published var selectedChatId: String?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var language: AtonLanguage {
        didSet {
            UserDefaults.standard.set(language.rawValue, forKey: "aton_lang")
        }
    }
    @Published var theme: AtonTheme {
        didSet {
            UserDefaults.standard.set(theme.rawValue, forKey: "aton_theme")
        }
    }
    @Published private var messagePaging: [String: MessagePagingState] = [:]

    private let api = APIClient.shared
    private let session = SessionStore()
    private var token: String?
    private var refreshDataInFlight = false
    private let messagePageLimit = 20

    init() {
        let lang = UserDefaults.standard.string(forKey: "aton_lang").flatMap(AtonLanguage.init(rawValue:)) ?? .ru
        let theme = UserDefaults.standard.string(forKey: "aton_theme").flatMap(AtonTheme.init(rawValue:)) ?? .system
        self.language = lang
        self.theme = theme
    }

    var selectedChat: AtonChat? {
        chats.first { $0.id == selectedChatId }
    }

    var canRegisterPushToken: Bool {
        token != nil
    }

    var orderedChats: [AtonChat] {
        chats.sorted { a, b in
            if a.id == "Akhenaten|golos_aton" || a.id.contains("golos_aton") { return true }
            if b.id == "Akhenaten|golos_aton" || b.id.contains("golos_aton") { return false }
            return lastMessageDate(a.id) > lastMessageDate(b.id)
        }
    }

    func messages(for chatId: String) -> [AtonMessage] {
        messages.filter { $0.chatId == chatId }.sorted { $0.time < $1.time }
    }

    func isLoadingOlderMessages(_ chatId: String) -> Bool {
        messagePaging[chatId]?.loadingOlder == true
    }

    func canLoadOlderMessages(_ chatId: String) -> Bool {
        guard let state = messagePaging[chatId], state.initialLoaded else { return false }
        return state.hasMore
    }

    func olderMessagesText(forLoading loading: Bool) -> String {
        switch language {
        case .ru: return loading ? "Загружаем ранние сообщения..." : "Прокрутите выше, чтобы открыть ранние сообщения"
        case .de: return loading ? "Fruehere Nachrichten werden geladen..." : "Nach oben scrollen, um fruehere Nachrichten zu laden"
        case .en: return loading ? "Loading earlier messages..." : "Scroll up to reveal earlier messages"
        }
    }

    func lastMessageDate(_ chatId: String) -> Date {
        messages.filter { $0.chatId == chatId }.map(\.time).max() ?? .distantPast
    }

    func bootstrap() async {
        token = session.readToken()
        guard token != nil else { return }
        await refreshMe()
        await refreshData()
        await PushManager.shared.requestPermissionIfUseful()
    }

    func login(email: String, password: String) async {
        await auth(path: "/api/login", body: ["email": email, "password": password])
    }

    func register(username: String, email: String, password: String) async {
        await auth(path: "/api/register", body: ["username": username, "email": email, "password": password])
    }

    private func auth(path: String, body: [String: String]) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response: LoginResponse = try await api.request(path, method: "POST", body: body)
            token = response.token
            session.saveToken(response.token)
            currentUser = response.user
            messagePaging = [:]
            await refreshData()
            await PushManager.shared.requestPermissionIfUseful()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() async {
        if let token {
            let _: EmptyResponse? = try? await api.request("/api/logout", method: "POST", token: token)
            let _: EmptyResponse? = try? await api.request("/api/push/unregister", method: "POST", token: token)
        }
        self.token = nil
        session.clear()
        currentUser = nil
        chats = []
        messages = []
        messagePaging = [:]
        selectedChatId = nil
    }

    func refreshMe() async {
        guard let token else { return }
        do {
            currentUser = try await api.request("/api/me", token: token)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateProfile(displayName: String, bio: String, publicId: String, avatarDataUrl: String?) async {
        guard let token else { return }
        do {
            let body = ProfileUpdateBody(
                displayName: displayName,
                bio: bio,
                publicId: publicId,
                avatarDataUrl: avatarDataUrl
            )
            currentUser = try await api.request("/api/profile", method: "POST", token: token, body: body)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refreshData(silent: Bool = false) async {
        guard let token else { return }
        if refreshDataInFlight { return }
        refreshDataInFlight = true
        if !silent { isLoading = true }
        defer {
            refreshDataInFlight = false
            if !silent { isLoading = false }
        }
        do {
            chats = try await api.request("/api/chats", token: token)
            if selectedChatId == nil { selectedChatId = orderedChats.first?.id ?? chats.first?.id }
            if let selectedChatId {
                if messagePaging[selectedChatId]?.initialLoaded == true {
                    await refreshLatestMessages(selectedChatId)
                } else {
                    await loadInitialMessagesIfNeeded(selectedChatId)
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadInitialMessagesIfNeeded(_ chatId: String) async {
        guard let token else { return }
        if messagePaging[chatId]?.initialLoaded == true { return }
        do {
            let page: [AtonMessage] = try await api.request(messagesPath(chatId: chatId), token: token)
            mergeMessages(page, replacingChat: chatId)
            var state = messagePaging[chatId] ?? MessagePagingState()
            state.initialLoaded = true
            state.hasMore = page.count >= messagePageLimit
            messagePaging[chatId] = state
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshLatestMessages(_ chatId: String) async {
        guard let token else { return }
        do {
            let page: [AtonMessage] = try await api.request(messagesPath(chatId: chatId), token: token)
            mergeMessages(page)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadOlderMessages(_ chatId: String) async {
        guard let token else { return }
        var state = messagePaging[chatId] ?? MessagePagingState()
        guard state.hasMore, !state.loadingOlder else { return }
        guard let oldest = messages(for: chatId).first else {
            state.hasMore = false
            messagePaging[chatId] = state
            return
        }
        state.loadingOlder = true
        messagePaging[chatId] = state
        do {
            let page: [AtonMessage] = try await api.request(messagesPath(chatId: chatId, before: oldest.time), token: token)
            mergeMessages(page)
            state.loadingOlder = false
            state.initialLoaded = true
            state.hasMore = page.count >= messagePageLimit
            messagePaging[chatId] = state
        } catch {
            state.loadingOlder = false
            messagePaging[chatId] = state
            errorMessage = error.localizedDescription
        }
    }

    private func messagesPath(chatId: String, before: Date? = nil) -> String {
        var items = [
            URLQueryItem(name: "chatId", value: chatId),
            URLQueryItem(name: "limit", value: "\(messagePageLimit)")
        ]
        if let before {
            items.append(URLQueryItem(name: "before", value: ISO8601DateFormatter.aton.string(from: before)))
        }
        var components = URLComponents()
        components.path = "/api/messages"
        components.queryItems = items
        return components.string ?? "/api/messages"
    }

    private func mergeMessages(_ incoming: [AtonMessage], replacingChat chatId: String? = nil) {
        var byId = Dictionary(uniqueKeysWithValues: messages.map { ($0.id, $0) })
        if let chatId {
            for message in messages where message.chatId == chatId {
                byId.removeValue(forKey: message.id)
            }
        }
        for message in incoming {
            byId[message.id] = message
        }
        messages = byId.values.sorted { $0.time < $1.time }
    }

    func refreshLoop() async {
        while !Task.isCancelled {
            await refreshData(silent: true)
            try? await Task.sleep(nanoseconds: 6_000_000_000)
        }
    }

    func sendText(_ text: String, chatId: String) async {
        guard let token else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            let body = ["chatId": chatId, "type": "text", "text": trimmed]
            let message: AtonMessage = try await api.request("/api/messages", method: "POST", token: token, body: body)
            messages.append(message)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendImage(_ dataUrl: String, chatId: String, caption: String = "") async {
        await sendMedia(chatId: chatId, type: "image", text: caption, imageDataUrl: dataUrl, audioDataUrl: nil)
    }

    func sendAudio(_ dataUrl: String, chatId: String, text: String = "") async {
        await sendMedia(chatId: chatId, type: "audio", text: text, imageDataUrl: nil, audioDataUrl: dataUrl)
    }

    private func sendMedia(chatId: String, type: String, text: String, imageDataUrl: String?, audioDataUrl: String?) async {
        guard let token else { return }
        do {
            let body = MessageCreateBody(chatId: chatId, type: type, text: text, imageDataUrl: imageDataUrl, audioDataUrl: audioDataUrl)
            let message: AtonMessage = try await api.request("/api/messages", method: "POST", token: token, body: body)
            messages.append(message)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func editMessage(_ message: AtonMessage, text: String) async {
        guard let token else { return }
        do {
            let updated: AtonMessage = try await api.request("/api/messages/\(message.id)", method: "PATCH", token: token, body: ["text": text])
            if let idx = messages.firstIndex(where: { $0.id == updated.id }) { messages[idx] = updated }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteMessage(_ message: AtonMessage) async {
        guard let token else { return }
        do {
            let _: EmptyResponse = try await api.request("/api/messages/\(message.id)", method: "DELETE", token: token)
            messages.removeAll { $0.id == message.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func pinMessage(_ message: AtonMessage) async {
        guard let token else { return }
        do {
            let updated: AtonMessage = try await api.request("/api/messages/\(message.id)/pin", method: "POST", token: token)
            if let idx = messages.firstIndex(where: { $0.id == updated.id }) { messages[idx] = updated }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func react(message: AtonMessage, emoji: String) async {
        guard let token else { return }
        do {
            let updated: AtonMessage = try await api.request("/api/messages/\(message.id)/react", method: "POST", token: token, body: ["emoji": emoji])
            if let idx = messages.firstIndex(where: { $0.id == updated.id }) { messages[idx] = updated }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createChat(title: String, type: String, visibility: String, description: String?) async {
        guard let token else { return }
        do {
            let body = ChatCreateBody(title: title, type: type, visibility: visibility, description: description)
            let chat: AtonChat = try await api.request("/api/chats", method: "POST", token: token, body: body)
            chats.append(chat)
            selectedChatId = chat.id
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadDiscoverChats() async {
        guard let token else { return }
        do {
            discoverChats = try await api.request("/api/chats/discover", token: token)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func joinChat(_ chat: AtonChat) async {
        guard let token else { return }
        do {
            let response: JoinChatResponse = try await api.request("/api/chats/\(chat.id)/join", method: "POST", token: token)
            chats.removeAll { $0.id == response.chat.id }
            chats.append(response.chat)
            discoverChats.removeAll { $0.id == response.chat.id }
            selectedChatId = response.chat.id
            await refreshData(silent: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteChat(_ chat: AtonChat) async {
        guard let token else { return }
        do {
            let _: EmptyResponse = try await api.request("/api/chats/\(chat.id)", method: "DELETE", token: token)
            chats.removeAll { $0.id == chat.id }
            messages.removeAll { $0.chatId == chat.id }
            if selectedChatId == chat.id { selectedChatId = orderedChats.first?.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func canDeleteChat(_ chat: AtonChat) -> Bool {
        guard let user = currentUser else { return false }
        if user.isSuperAdmin == true { return true }
        if chat.owner == user.username { return true }
        if chat.ownerId == user.id { return true }
        return false
    }

    func canPost(in chat: AtonChat?) -> Bool {
        guard let chat else { return true }
        guard let user = currentUser else { return false }
        if chat.type != "channel" { return true }
        if user.isSuperAdmin == true { return true }
        if chat.owner == user.username || chat.ownerId == user.id { return true }
        return (chat.admins ?? []).contains(user.id)
    }

    func verifyChat(_ chat: AtonChat) async throws {
        guard let token else { return }
        let updated: AtonChat = try await api.request("/api/chats/\(chat.id)/verify", method: "POST", token: token)
        if let idx = chats.firstIndex(where: { $0.id == updated.id }) { chats[idx] = updated }
    }

    func reportChat(_ chat: AtonChat, reason: String) async {
        guard let token else { return }
        let _: EmptyResponse? = try? await api.request("/api/chats/\(chat.id)/report", method: "POST", token: token, body: ["reason": reason])
    }

    func reportUser(_ id: String, reason: String) async {
        guard let token else { return }
        let _: EmptyResponse? = try? await api.request("/api/users/\(id)/report", method: "POST", token: token, body: ["reason": reason])
    }

    func reportMessage(_ id: String, reason: String) async {
        guard let token else { return }
        let _: EmptyResponse? = try? await api.request("/api/messages/\(id)/report", method: "POST", token: token, body: ["reason": reason])
    }

    func registerPushToken(_ deviceToken: String) async {
        guard let token else { return }
        let body = ["token": deviceToken, "platform": "ios", "appVersion": Bundle.main.releaseVersion, "environment": "auto"]
        let _: EmptyResponse? = try? await api.request("/api/push/register", method: "POST", token: token, body: body)
    }

    func loadAdminUsers() async throws -> [AtonUser] {
        guard let token else { return [] }
        return try await api.request("/api/admin/users", token: token)
    }

    func loadAdminChats() async throws -> [AtonChat] {
        guard let token else { return [] }
        let rows: [AtonChat] = try await api.request("/api/admin/chats", token: token)
        adminChats = rows
        return rows
    }

    func verifyUser(_ id: String) async throws {
        guard let token else { return }
        let _: EmptyResponse = try await api.request("/api/users/\(id)/verify", method: "POST", token: token)
    }

    func loadReports() async throws -> [AtonReport] {
        guard let token else { return [] }
        return try await api.request("/api/reports", token: token)
    }

    func resolveReport(_ id: String) async throws {
        guard let token else { return }
        let _: EmptyResponse = try await api.request("/api/reports/\(id)/resolve", method: "POST", token: token)
    }

    func rejectReport(_ id: String) async throws {
        guard let token else { return }
        let _: EmptyResponse = try await api.request("/api/reports/\(id)/reject", method: "POST", token: token)
    }

    func linkPreview(for url: URL) async -> AtonLinkPreview? {
        guard let token else { return nil }
        return try? await api.linkPreview(for: url, token: token)
    }
}

private struct MessagePagingState {
    var initialLoaded = false
    var hasMore = true
    var loadingOlder = false
}

struct MessageCreateBody: Encodable {
    let chatId: String
    let type: String
    let text: String
    let imageDataUrl: String?
    let audioDataUrl: String?
}

struct ChatCreateBody: Encodable {
    let title: String
    let type: String
    let visibility: String
    let description: String?
}

struct JoinChatResponse: Decodable {
    let ok: Bool
    let chat: AtonChat
}

struct ProfileUpdateBody: Encodable {
    let displayName: String
    let bio: String
    let publicId: String
    let avatarDataUrl: String?
}

extension Bundle {
    var releaseVersion: String {
        object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1.1"
    }
}
