import SwiftUI

struct ChatListView: View {
    @EnvironmentObject private var app: AppState
    @State private var showCreateChat = false
    @State private var showDiscoverChats = false

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
                Button {
                    showDiscoverChats = true
                } label: {
                    Image(systemName: "magnifyingglass")
                }
                Button {
                    showCreateChat = true
                } label: {
                    Image(systemName: "plus.message.fill")
                }
                NavigationLink(value: Route.profile) {
                    Image(systemName: "person.crop.circle")
                }
            }
        }
        .sheet(isPresented: $showCreateChat) {
            CreateChatSheet()
                .environmentObject(app)
        }
        .sheet(isPresented: $showDiscoverChats) {
            DiscoverChatsSheet()
                .environmentObject(app)
        }
        .refreshable {
            await app.refreshData()
        }
    }
}

private struct DiscoverChatsSheet: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    var body: some View {
        NavigationStack {
            List {
                if filteredChats.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 38, weight: .semibold))
                            .foregroundStyle(.secondary)
                        Text("Публичных чатов нет")
                            .font(.headline)
                        Text("Здесь появятся открытые группы и каналы, в которые можно вступить.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 34)
                } else {
                    ForEach(filteredChats) { chat in
                        HStack(spacing: 12) {
                            AvatarView(title: chat.displayTitle, imageDataUrl: chat.avatarDataUrl)
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Text(chat.displayTitle)
                                        .font(.headline)
                                    if chat.verified == true {
                                        Image(systemName: "checkmark.seal.fill")
                                            .font(.caption)
                                            .foregroundStyle(.blue)
                                    }
                                }
                                Text(chat.type == "channel" ? "Канал" : "Группа")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if let description = chat.description, !description.isEmpty {
                                    Text(description)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                            }
                            Spacer()
                            Button("Вступить") {
                                Task {
                                    await app.joinChat(chat)
                                    dismiss()
                                }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                }
            }
            .searchable(text: $search, prompt: "Найти группу или канал")
            .navigationTitle("Публичные чаты")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Закрыть") { dismiss() }
                }
            }
            .task { await app.loadDiscoverChats() }
            .refreshable { await app.loadDiscoverChats() }
        }
    }

    private var filteredChats: [AtonChat] {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let rows = app.discoverChats.sorted {
            $0.displayTitle.localizedCaseInsensitiveCompare($1.displayTitle) == .orderedAscending
        }
        guard !q.isEmpty else { return rows }
        return rows.filter {
            [$0.displayTitle, $0.description ?? "", $0.type].joined(separator: " ").lowercased().contains(q)
        }
    }
}

private struct CreateChatSheet: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var type = "group"
    @State private var visibility = "public"

    var body: some View {
        NavigationStack {
            Form {
                Section("Основное") {
                    TextField("Название", text: $title)
                    TextField("Описание", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("Тип") {
                    Picker("Тип", selection: $type) {
                        Text("Группа").tag("group")
                        Text("Канал").tag("channel")
                    }
                    .pickerStyle(.segmented)

                    Text(type == "channel"
                         ? "В канале писать могут владелец и администраторы."
                         : "В группе писать могут участники.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Доступ") {
                    Picker("Доступ", selection: $visibility) {
                        Text("Публичный").tag("public")
                        Text("Приватный").tag("private")
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle(type == "channel" ? "Новый канал" : "Новая группа")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Создать") {
                        Task {
                            await app.createChat(
                                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                                type: type,
                                visibility: visibility,
                                description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : description
                            )
                            dismiss()
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

private extension AtonChat {
    var displayTitle: String {
        title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? title!
            : peerDisplayName ?? description ?? id
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
                    if let date = displayDate {
                        Text(date.chatListTime)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                HStack(spacing: 8) {
                    Text(displayPreview)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    if let unread = chat.unread, unread > 0 {
                        Text("\(min(unread, 99))")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(Color.red))
                    }
                }
            }
        }
        .padding(.vertical, 7)
    }

    private var title: String {
        if chat.id.contains("golos_aton") { return "Голос Атона" }
        return chat.peerDisplayName ?? chat.title ?? chat.description ?? chat.id
    }
}

private extension ChatRow {
    var displayDate: Date? {
        let remote = chat.lastTimeDate
        guard let lastMessage else { return remote }
        guard let remote else { return lastMessage.time }
        return lastMessage.time >= remote ? lastMessage.time : remote
    }

    var displayPreview: String {
        if let lastMessage, lastMessage.time >= (chat.lastTimeDate ?? .distantPast) {
            return lastMessage.preview
        }
        let text = chat.preview?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return text.isEmpty ? "Нет сообщений" : text
    }
}
