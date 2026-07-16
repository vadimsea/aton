import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: AppState
    @EnvironmentObject private var deepLinks: DeepLinkRouter
    @Environment(\.openURL) private var openURL
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
        .alert(updateTitle, isPresented: Binding(get: { app.availableUpdate != nil }, set: { if !$0 { app.dismissUpdatePrompt() } })) {
            Button(updatePrimaryButton) {
                if let url = app.availableUpdate?.pageURL {
                    openURL(url)
                }
                if app.availableUpdate?.mandatory != true {
                    app.dismissUpdatePrompt()
                }
            }
            if app.availableUpdate?.mandatory != true {
                Button(updateLaterButton, role: .cancel) {
                    app.dismissUpdatePrompt()
                }
            }
        } message: {
            Text(updateMessage)
        }
        .task {
            await app.checkForAppUpdate()
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

    private var updateTitle: String {
        switch app.language {
        case .ru: return "\u{0414}\u{043E}\u{0441}\u{0442}\u{0443}\u{043F}\u{043D}\u{043E} \u{043E}\u{0431}\u{043D}\u{043E}\u{0432}\u{043B}\u{0435}\u{043D}\u{0438}\u{0435}"
        case .de: return "Update verfuegbar"
        case .en: return "Update available"
        }
    }

    private var updateMessage: String {
        guard let update = app.availableUpdate else { return "" }
        let installed: String
        switch app.language {
        case .ru: installed = "\u{0423}\u{0441}\u{0442}\u{0430}\u{043D}\u{043E}\u{0432}\u{043B}\u{0435}\u{043D}\u{043D}\u{0430}\u{044F} \u{0432}\u{0435}\u{0440}\u{0441}\u{0438}\u{044F}"
        case .de: installed = "Installierte Version"
        case .en: installed = "Installed version"
        }
        return "\(update.title)\n\n\(update.message)\n\n\(installed): \(Bundle.main.releaseVersion)"
    }

    private var updatePrimaryButton: String {
        switch app.language {
        case .ru: return "\u{041E}\u{0431}\u{043D}\u{043E}\u{0432}\u{0438}\u{0442}\u{044C}"
        case .de: return "Aktualisieren"
        case .en: return "Update"
        }
    }

    private var updateLaterButton: String {
        switch app.language {
        case .ru: return "\u{041F}\u{043E}\u{0437}\u{0436}\u{0435}"
        case .de: return "Spaeter"
        case .en: return "Later"
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
