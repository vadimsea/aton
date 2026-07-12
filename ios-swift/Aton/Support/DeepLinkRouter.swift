import Foundation

@MainActor
final class DeepLinkRouter: ObservableObject {
    @Published var pendingChatId: String?
    @Published var pendingMessageId: String?
    @Published var pendingProfileId: String?

    func handle(_ url: URL) {
        guard url.scheme == "aten" else { return }
        let key = [url.host, url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))]
            .compactMap { $0 }
            .joined(separator: "/")
        if key.hasPrefix("chat/") {
            pendingChatId = String(key.dropFirst("chat/".count))
        } else if key.hasPrefix("message/") {
            pendingMessageId = String(key.dropFirst("message/".count))
        } else if key.hasPrefix("profile/") {
            pendingProfileId = String(key.dropFirst("profile/".count))
        }
    }
}
