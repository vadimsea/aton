import PhotosUI
import SwiftUI
import UIKit

struct ChatView: View {
    @EnvironmentObject private var app: AppState
    let chatId: String
    @StateObject private var voiceRecorder = VoiceRecorder()
    @State private var draft = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var lastBottomMessageId: String?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if app.canLoadOlderMessages(chatId) {
                            OlderMessagesIndicator(
                                title: app.olderMessagesText(forLoading: app.isLoadingOlderMessages(chatId)),
                                isLoading: app.isLoadingOlderMessages(chatId)
                            )
                            .onAppear {
                                Task { await app.loadOlderMessages(chatId) }
                            }
                        }
                        ForEach(groupedMessages, id: \.id) { item in
                            switch item {
                            case .date(let date):
                                DateSeparator(date: date)
                            case .message(let message):
                                MessageBubble(message: message, isMine: message.from == app.currentUser?.username)
                                    .id(message.id)
                            }
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 14)
                }
                .onChange(of: app.messages(for: chatId).last?.id) { id in
                    guard let id, id != lastBottomMessageId else { return }
                    lastBottomMessageId = id
                    if let last = app.messages(for: chatId).last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            if app.canPost(in: app.selectedChat) {
                composer
                    .padding()
                    .background(.ultraThinMaterial)
            } else {
                Label("В этом канале писать могут владелец и администраторы", systemImage: "lock.fill")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(.ultraThinMaterial)
            }
        }
        .background(AtonPalette.background)
        .navigationTitle(app.selectedChat?.title ?? "Чат")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Menu {
                if let peer = app.selectedChat?.peerUsername, !peer.isEmpty {
                    Button("Пожаловаться на пользователя", role: .destructive) {
                        Task { await app.reportUser(peer, reason: "Жалоба из iOS") }
                    }
                }
                Button("Пожаловаться", role: .destructive) {
                    Task { await reportCurrentChat() }
                }
                if let chat = app.selectedChat, app.canDeleteChat(chat) {
                    Button("Удалить чат", role: .destructive) {
                        Task {
                            await app.deleteChat(chat)
                        }
                    }
                }
                Button("Отключить уведомления") {}
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
        .task {
            app.selectedChatId = chatId
            await app.loadInitialMessagesIfNeeded(chatId)
        }
        .onAppear {
            app.selectedChatId = chatId
        }
        .onChange(of: selectedPhoto) { item in
            Task { await sendSelectedPhoto(item) }
        }
    }

    @ViewBuilder
    private var composer: some View {
        if voiceRecorder.isRecording {
            HStack(spacing: 12) {
                Button(role: .destructive) {
                    voiceRecorder.cancel()
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(AtonCircleButtonStyle())

                HStack(spacing: 10) {
                    Circle()
                        .fill(.red)
                        .frame(width: 10, height: 10)
                    Text("Запись \(VoiceRecorder.format(seconds: Int(voiceRecorder.elapsed)))")
                        .font(.headline)
                    Spacer()
                }
                .padding(.horizontal, 14)
                .frame(height: 50)
                .background(AtonPalette.input, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                Button {
                    Task { await stopAndSendVoice() }
                } label: {
                    Image(systemName: "paperplane.fill")
                }
                .buttonStyle(AtonCircleButtonStyle())
            }
        } else {
            HStack(spacing: 10) {
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Image(systemName: "paperclip")
                        .font(.headline)
                }
                .buttonStyle(AtonCircleButtonStyle())

                TextField("Сообщение", text: $draft, axis: .vertical)
                    .lineLimit(1...5)
                    .padding(12)
                    .background(AtonPalette.input, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                Button {
                    Task { await startVoice() }
                } label: {
                    Image(systemName: "mic.fill")
                        .font(.headline)
                }
                .buttonStyle(AtonCircleButtonStyle())

                Button {
                    let text = draft
                    draft = ""
                    Task { await app.sendText(text, chatId: chatId) }
                } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.headline)
                }
                .buttonStyle(AtonCircleButtonStyle())
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var groupedMessages: [MessageListItem] {
        var result: [MessageListItem] = []
        var currentDay: Date?
        for message in app.messages(for: chatId) {
            let day = Calendar.current.startOfDay(for: message.time)
            if day != currentDay {
                currentDay = day
                result.append(.date(day))
            }
            result.append(.message(message))
        }
        return result
    }

    private func startVoice() async {
        do {
            try await voiceRecorder.start()
        } catch {
            app.errorMessage = error.localizedDescription
        }
    }

    private func stopAndSendVoice() async {
        do {
            guard let recording = try voiceRecorder.stop() else { return }
            await app.sendAudio(recording.dataUrl, chatId: chatId, text: recording.durationLabel)
        } catch {
            app.errorMessage = error.localizedDescription
        }
    }

    private func reportCurrentChat() async {
        guard let chat = app.selectedChat else { return }
        await app.reportChat(chat, reason: "Жалоба из iOS")
    }

    private func sendSelectedPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        defer { selectedPhoto = nil }
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = image.downscaled(maxPixel: 1600).jpegData(compressionQuality: 0.82) else {
            app.errorMessage = "Не удалось прочитать изображение"
            return
        }
        let dataUrl = "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
        await app.sendImage(dataUrl, chatId: chatId)
    }
}

extension UIImage {
    func downscaled(maxPixel: CGFloat) -> UIImage {
        let maxSide = max(size.width, size.height)
        guard maxSide > maxPixel else { return self }
        let scale = maxPixel / maxSide
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}

enum MessageListItem: Identifiable {
    case date(Date)
    case message(AtonMessage)

    var id: String {
        switch self {
        case .date(let date): return "date-\(date.timeIntervalSince1970)"
        case .message(let message): return message.id
        }
    }
}

private struct OlderMessagesIndicator: View {
    let title: String
    let isLoading: Bool

    var body: some View {
        HStack(spacing: 9) {
            if isLoading {
                ProgressView()
                    .controlSize(.small)
                    .tint(AtonPalette.blue)
            } else {
                Image(systemName: "arrow.up")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AtonPalette.blue)
            }
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 8)
        .background(.thinMaterial, in: Capsule())
        .overlay(
            Capsule().stroke(AtonPalette.blue.opacity(0.18), lineWidth: 1)
        )
        .padding(.top, 2)
        .accessibilityLabel(title)
    }
}
