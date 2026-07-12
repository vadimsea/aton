import SwiftUI

struct AdminView: View {
    @EnvironmentObject private var app: AppState
    @State private var users: [AtonUser] = []
    @State private var reports: [AtonReport] = []
    @State private var search = ""
    @State private var isLoading = false

    var body: some View {
        List {
            Section("Пользователи") {
                TextField("Поиск", text: $search)
                ForEach(filteredUsers) { user in
                    HStack {
                        AvatarView(title: user.displayName, imageDataUrl: user.avatarDataUrl)
                        VStack(alignment: .leading) {
                            Text(user.displayName).font(.headline)
                            Text("@\(user.publicId ?? user.username)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(user.email ?? "")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if user.isVerified == true || user.verified == true {
                            Image(systemName: "checkmark.seal.fill").foregroundStyle(.blue)
                        } else {
                            Button("Вериф.") {
                                Task {
                                    try? await app.verifyUser(user.id)
                                    await load()
                                }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                }
            }

            Section("Группы и каналы") {
                ForEach(adminChats) { chat in
                    HStack(spacing: 12) {
                        AvatarView(title: chat.displayTitle, imageDataUrl: chat.avatarDataUrl)
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(chat.displayTitle).font(.headline)
                                if chat.verified == true {
                                    Image(systemName: "checkmark.seal.fill")
                                        .foregroundStyle(.blue)
                                }
                            }
                            Text(chat.type == "channel" ? "Канал" : "Группа")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if chat.verified == true {
                            Text("Верифицирован")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        } else {
                            Button("Вериф.") {
                                Task {
                                    try? await app.verifyChat(chat)
                                    await app.refreshData()
                                }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                    .swipeActions {
                        Button(role: .destructive) {
                            Task { await app.deleteChat(chat) }
                        } label: {
                            Label("Удалить", systemImage: "trash")
                        }
                    }
                }
            }

            Section("Жалобы") {
                ForEach(reports) { report in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(reportTitle(report)).font(.headline)
                        Text(report.reason).font(.subheadline)
                        Text(report.status).font(.caption).foregroundStyle(.secondary)
                        HStack {
                            Button("Решить") {
                                Task {
                                    try? await app.resolveReport(report.id)
                                    await load()
                                }
                            }
                            Button("Отклонить", role: .destructive) {
                                Task {
                                    try? await app.rejectReport(report.id)
                                    await load()
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Админ")
        .overlay {
            if isLoading { ProgressView().controlSize(.large) }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var filteredUsers: [AtonUser] {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return users }
        return users.filter {
            [$0.username, $0.publicId ?? "", $0.displayName, $0.email ?? ""].joined(separator: " ").lowercased().contains(q)
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        users = (try? await app.loadAdminUsers()) ?? []
        reports = (try? await app.loadReports()) ?? []
        await app.refreshData()
    }

    private func reportTitle(_ report: AtonReport) -> String {
        switch report.targetType {
        case "user": return "Пользователь \(report.targetUser?.displayName ?? report.targetUserId ?? "")"
        case "message": return "Сообщение \(report.messageId ?? "")"
        default: return "Чат \(report.chat?.title ?? report.chatId ?? "")"
        }
    }

    private var adminChats: [AtonChat] {
        app.chats
            .filter { ["group", "channel"].contains($0.type) }
            .sorted { $0.displayTitle.localizedCaseInsensitiveCompare($1.displayTitle) == .orderedAscending }
    }
}

private extension AtonChat {
    var displayTitle: String {
        title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? title! : id
    }
}
