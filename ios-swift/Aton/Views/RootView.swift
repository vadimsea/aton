import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: AppState
    @EnvironmentObject private var deepLinks: DeepLinkRouter
    @State private var path: [Route] = []

    var body: some View {
        ZStack {
            AtonPalette.background.ignoresSafeArea()
            if app.currentUser == nil {
                AuthView()
            } else {
                content
            }
        }
        .environment(\.locale, locale)
        .onChange(of: deepLinks.pendingChatId) { chatId in
            guard let chatId else { return }
            app.selectedChatId = chatId
            path = [.chat(chatId)]
        }
        .alert("Ошибка", isPresented: Binding(get: { app.errorMessage != nil }, set: { if !$0 { app.errorMessage = nil } })) {
            Button("OK", role: .cancel) { app.errorMessage = nil }
        } message: {
            Text(app.errorMessage ?? "")
        }
        .task(id: app.currentUser?.id) {
            guard app.currentUser != nil else { return }
            await app.refreshLoop()
        }
    }

    private var locale: Locale {
        switch app.language {
        case .ru: return Locale(identifier: "ru_RU")
        case .de: return Locale(identifier: "de_DE")
        case .en: return Locale(identifier: "en_GB")
        }
    }

    @ViewBuilder
    private var content: some View {
        NavigationStack(path: $path) {
            ChatListView()
                .navigationDestination(for: Route.self) { destination in
                    switch destination {
                    case .chats:
                        ChatListView()
                    case .chat(let id):
                        ChatView(chatId: id)
                    case .profile:
                        ProfileView()
                    case .admin:
                        AdminView()
                    }
                }
        }
    }
}

enum Route: Hashable {
    case chats
    case chat(String)
    case profile
    case admin
}
