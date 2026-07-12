import AVFoundation
import SwiftUI
import UIKit

enum AtonPalette {
    static let background = LinearGradient(
        colors: [Color(red: 0.03, green: 0.05, blue: 0.10), Color(red: 0.07, green: 0.10, blue: 0.17)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    static let surface = Color.white.opacity(0.08)
    static let input = Color.white.opacity(0.10)
    static let gold = Color(red: 1.0, green: 0.72, blue: 0.18)
    static let blue = Color(red: 0.19, green: 0.42, blue: 0.95)
}

struct AtonTextField: View {
    let title: String
    @Binding var text: String
    var keyboard: UIKeyboardType

    var body: some View {
        TextField(title, text: $text)
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(14)
            .background(AtonPalette.input, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct AtonSecureField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        SecureField(title, text: $text)
            .textInputAutocapitalization(.never)
            .padding(14)
            .background(AtonPalette.input, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct LanguagePicker: View {
    @EnvironmentObject private var app: AppState

    var body: some View {
        HStack(spacing: 14) {
            ForEach(AtonLanguage.allCases) { lang in
                Button {
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
                        app.language = lang
                    }
                } label: {
                    Text(lang.flag)
                        .font(.system(size: 34))
                        .frame(width: 72, height: 58)
                        .background(app.language == lang ? AtonPalette.blue.opacity(0.24) : Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .stroke(app.language == lang ? Color.blue.opacity(0.75) : Color.white.opacity(0.10), lineWidth: 1.2)
                        }
                        .overlay(alignment: .bottomTrailing) {
                            if app.language == lang {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 17, weight: .bold))
                                    .foregroundStyle(.white, AtonPalette.blue)
                                    .offset(x: 5, y: 5)
                            }
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(lang.title)
            }
        }
    }
}

struct AvatarView: View {
    let title: String
    let imageDataUrl: String?
    var size: CGFloat = 52

    var body: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(colors: [.orange, .yellow], startPoint: .topLeading, endPoint: .bottomTrailing))
            if let uiImage {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .clipShape(Circle())
            } else if let remoteURL {
                AsyncImage(url: remoteURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        fallbackLetter
                    case .empty:
                        ProgressView()
                            .tint(.white)
                    @unknown default:
                        fallbackLetter
                    }
                }
                .clipShape(Circle())
            } else {
                fallbackLetter
            }
        }
        .frame(width: size, height: size)
    }

    private var fallbackLetter: some View {
        Text(String(title.prefix(1)).uppercased())
            .font(.headline.bold())
            .foregroundStyle(.white)
    }

    private var uiImage: UIImage? {
        guard let imageDataUrl else { return nil }
        if imageDataUrl.hasPrefix("data:"), let comma = imageDataUrl.firstIndex(of: ",") {
            let base64 = String(imageDataUrl[imageDataUrl.index(after: comma)...])
            guard let data = Data(base64Encoded: base64) else { return nil }
            return UIImage(data: data)
        }
        return nil
    }

    private var remoteURL: URL? {
        guard let imageDataUrl, !imageDataUrl.hasPrefix("data:") else { return nil }
        return URL(string: imageDataUrl)
    }
}

struct DateSeparator: View {
    let date: Date

    var body: some View {
        Text(date.chatSeparator)
            .font(.caption.bold())
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial, in: Capsule())
            .foregroundStyle(.secondary)
            .padding(.vertical, 4)
    }
}

struct MessageBubble: View {
    @EnvironmentObject private var app: AppState
    let message: AtonMessage
    let isMine: Bool
    @State private var showEditAlert = false
    @State private var editText = ""

    var body: some View {
        HStack(alignment: .bottom) {
            if isMine { Spacer(minLength: 42) }
            if !isMine {
                AvatarView(
                    title: message.senderDisplayName ?? message.from,
                    imageDataUrl: message.senderAvatarDataUrl,
                    size: 34
                )
            }
            VStack(alignment: .leading, spacing: 7) {
                if !isMine {
                    Text(message.senderDisplayName ?? message.from)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                if message.type == "audio" {
                    VoiceMessageBubble(message: message, isMine: isMine)
                } else if message.type == "image" {
                    ImageMessageContent(message: message)
                } else {
                    Text(message.preview)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .textSelection(.enabled)
                }
                HStack(spacing: 8) {
                    Text(message.time.bubbleTime)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if isMine {
                        Image(systemName: message.status == "read" ? "checkmark.circle.fill" : "checkmark")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    ReactionStrip(message: message)
                }
            }
            .padding(12)
            .background(isMine ? Color.blue.opacity(0.32) : Color.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(alignment: .topTrailing) {
                if message.pinned == true {
                    Image(systemName: "pin.fill")
                        .font(.caption2)
                        .padding(6)
                    .foregroundStyle(.secondary)
                }
            }
            .contextMenu {
                if isMine && message.type == "text" {
                    Button {
                        editText = message.text ?? ""
                        showEditAlert = true
                    } label: {
                        Label("Редактировать", systemImage: "pencil")
                    }
                }
                Button {
                    Task { await app.pinMessage(message) }
                } label: {
                    Label(message.pinned == true ? "Открепить" : "Закрепить", systemImage: "pin")
                }
                if isMine {
                    Button(role: .destructive) {
                        Task { await app.deleteMessage(message) }
                    } label: {
                        Label("Удалить", systemImage: "trash")
                    }
                } else {
                    Button(role: .destructive) {
                        awaitReport()
                    } label: {
                        Label("Пожаловаться", systemImage: "exclamationmark.bubble")
                    }
                }
            }
            .alert("Редактировать сообщение", isPresented: $showEditAlert) {
                TextField("Текст", text: $editText, axis: .vertical)
                Button("Отмена", role: .cancel) {}
                Button("Сохранить") {
                    Task { await app.editMessage(message, text: editText) }
                }
            }
            if !isMine { Spacer(minLength: 42) }
        }
    }

    private func awaitReport() {
        Task { await app.reportMessage(message.id, reason: "Жалоба из iOS") }
    }
}

struct ImageMessageContent: View {
    let message: AtonMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let image = message.image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else if let url = message.imageURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit()
                    case .failure:
                        Label("Изображение недоступно", systemImage: "photo")
                    case .empty:
                        ProgressView()
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(maxHeight: 280)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else {
                Label("Изображение", systemImage: "photo")
            }
            if let text = message.text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(text)
                    .font(.body)
                    .textSelection(.enabled)
            }
        }
        .frame(maxWidth: 280, alignment: .leading)
    }
}

struct VoiceMessageBubble: View {
    let message: AtonMessage
    let isMine: Bool
    @State private var player: AVAudioPlayer?
    @State private var isPlaying = false

    var body: some View {
        HStack(spacing: 12) {
            Button {
                togglePlayback()
            } label: {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(isMine ? .white : AtonPalette.blue)
                    .frame(width: 38, height: 38)
                    .background(isMine ? Color.white.opacity(0.18) : AtonPalette.blue.opacity(0.14), in: Circle())
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .center, spacing: 3) {
                    ForEach(0..<22, id: \.self) { index in
                        Capsule()
                            .fill((isMine ? Color.white : AtonPalette.blue).opacity(index < 9 ? 0.82 : 0.32))
                            .frame(width: 3, height: CGFloat([10, 16, 22, 14, 28, 20, 13, 24, 18, 11, 21][index % 11]))
                    }
                }
                Text(message.voiceDurationLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 220, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Голосовое сообщение \(message.voiceDurationLabel)")
    }

    private func togglePlayback() {
        if isPlaying {
            player?.pause()
            isPlaying = false
            return
        }
        guard let data = message.audioData else { return }
        do {
            if player == nil {
                player = try AVAudioPlayer(data: data)
                player?.prepareToPlay()
            }
            player?.play()
            isPlaying = true
            let duration = player?.duration ?? 0
            DispatchQueue.main.asyncAfter(deadline: .now() + max(duration, 0.1)) {
                if player?.isPlaying != true {
                    isPlaying = false
                }
            }
        } catch {
            isPlaying = false
        }
    }
}

struct ReactionStrip: View {
    @EnvironmentObject private var app: AppState
    let message: AtonMessage
    private let options = ["👍", "❤️", "🔥", "👏"]

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { emoji in
                Button(emoji) {
                    Task { await app.react(message: message, emoji: emoji) }
                }
            }
        } label: {
            Image(systemName: "face.smiling")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

struct AtonPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.vertical, 15)
            .foregroundStyle(.black)
            .background(AtonPalette.gold.opacity(configuration.isPressed ? 0.75 : 1), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
    }
}

struct AtonCircleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(width: 48, height: 48)
            .foregroundStyle(.white)
            .background(Color.blue.opacity(configuration.isPressed ? 0.65 : 1), in: Circle())
    }
}

extension AtonMessage {
    var preview: String {
        if type == "audio" { return "Голосовое сообщение" }
        if type == "image" { return "Изображение" }
        return text?.isEmpty == false ? text! : "Сообщение"
    }

    var voiceDurationLabel: String {
        guard let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return "0:02"
        }
        return text
    }
}

extension AtonMessage {
    var image: UIImage? {
        guard let imageDataUrl, imageDataUrl.hasPrefix("data:"), let comma = imageDataUrl.firstIndex(of: ",") else {
            return nil
        }
        let base64 = String(imageDataUrl[imageDataUrl.index(after: comma)...])
        guard let data = Data(base64Encoded: base64) else { return nil }
        return UIImage(data: data)
    }

    var imageURL: URL? {
        guard let imageDataUrl, !imageDataUrl.hasPrefix("data:") else { return nil }
        return URL(string: imageDataUrl)
    }

    var audioData: Data? {
        guard let audioDataUrl, audioDataUrl.hasPrefix("data:"), let comma = audioDataUrl.firstIndex(of: ",") else {
            return nil
        }
        let base64 = String(audioDataUrl[audioDataUrl.index(after: comma)...])
        return Data(base64Encoded: base64)
    }
}

extension AtonLanguage {
    var flag: String {
        switch self {
        case .ru: return "🇷🇺"
        case .de: return "🇩🇪"
        case .en: return "🇬🇧"
        }
    }
}

extension Date {
    var bubbleTime: String {
        formatted(.dateTime.hour().minute())
    }

    var chatListTime: String {
        if Calendar.current.isDateInToday(self) { return formatted(.dateTime.hour().minute()) }
        if Calendar.current.isDateInYesterday(self) { return "вчера" }
        return formatted(.dateTime.day().month(.abbreviated))
    }

    var chatSeparator: String {
        if Calendar.current.isDateInToday(self) { return "Сегодня" }
        if Calendar.current.isDateInYesterday(self) { return "Вчера" }
        return formatted(.dateTime.day().month(.wide).year())
    }
}
