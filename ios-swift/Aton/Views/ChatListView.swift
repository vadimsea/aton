import SwiftUI

struct ChatListView: View {
    @EnvironmentObject private var app: AppState

    var body: some View {
        List {
            Section {
                ForEach(app.orderedChats) { chat in
                    NavigationLink(value: Route.chat(chat.id)) {
                        ChatRow(chat: chat, lastMessage: app.messages(for: chat.id).last)
                    }
                    .simultaneousGesture(TapGesture().onEnded {
                        app.selectedChatId = chat.id
                    })
                    .listRowBackground(Color.clear)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(AtonPalette.background)
        .navigationTitle("Чаты")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if app.currentUser?.isSuperAdmin == true {
                    NavigationLink(value: Route.admin) {
                        Image(systemName: "shield.checkered")
                    }
                }
                NavigationLink(value: Route.profile) {
                    Image(systemName: "person.crop.circle")
                }
            }
        }
        .refreshable {
            await app.refreshData()
        }
    }
}

struct ChatRow: View {
    let chat: AtonChat
    let lastMessage: AtonMessage?

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(title: title, imageDataUrl: chat.avatarDataUrl ?? chat.peerAvatarDataUrl)
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(title)
                        .font(.headline)
                        .lineLimit(1)
                    if chat.verified == true {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(.blue)
                            .font(.caption)
                    }
                    Spacer()
                    if let date = lastMessage?.time {
                        Text(date.chatListTime)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Text(lastMessage?.preview ?? "Нет сообщений")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 7)
    }

    private var title: String {
        if chat.id.contains("golos_aton") { return "Голос Атона" }
        return chat.peerDisplayName ?? chat.title ?? chat.description ?? chat.id
    }
}
