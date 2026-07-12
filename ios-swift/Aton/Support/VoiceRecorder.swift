import AVFoundation
import Foundation

@MainActor
final class VoiceRecorder: NSObject, ObservableObject {
    @Published private(set) var isRecording = false
    @Published private(set) var elapsed: TimeInterval = 0

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var startedAt: Date?
    private var fileUrl: URL?

    func start() async throws {
        let granted = await requestMicrophoneAccess()
        guard granted else { throw VoiceRecorderError.microphoneDenied }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetooth])
        try session.setActive(true)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("aton-voice-\(UUID().uuidString)")
            .appendingPathExtension("m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]

        recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder?.prepareToRecord()
        recorder?.record()
        fileUrl = url
        startedAt = Date()
        elapsed = 0
        isRecording = true
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let startedAt = self.startedAt else { return }
                self.elapsed = Date().timeIntervalSince(startedAt)
            }
        }
    }

    func stop() throws -> RecordedVoice? {
        guard isRecording, let fileUrl else { return nil }
        recorder?.stop()
        recorder = nil
        timer?.invalidate()
        timer = nil
        isRecording = false

        let duration = max(1, Int(round(elapsed)))
        let data = try Data(contentsOf: fileUrl)
        try? FileManager.default.removeItem(at: fileUrl)
        self.fileUrl = nil
        self.startedAt = nil
        self.elapsed = 0

        return RecordedVoice(
            dataUrl: "data:audio/mp4;base64,\(data.base64EncodedString())",
            durationLabel: Self.format(seconds: duration)
        )
    }

    func cancel() {
        recorder?.stop()
        recorder = nil
        timer?.invalidate()
        timer = nil
        isRecording = false
        elapsed = 0
        if let fileUrl {
            try? FileManager.default.removeItem(at: fileUrl)
        }
        self.fileUrl = nil
        self.startedAt = nil
    }

    private func requestMicrophoneAccess() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    static func format(seconds: Int) -> String {
        let minutes = seconds / 60
        let rest = seconds % 60
        return "\(minutes):\(String(format: "%02d", rest))"
    }
}

struct RecordedVoice {
    let dataUrl: String
    let durationLabel: String
}

enum VoiceRecorderError: LocalizedError {
    case microphoneDenied

    var errorDescription: String? {
        switch self {
        case .microphoneDenied:
            return "Нет доступа к микрофону. Разрешите микрофон для ATEN в настройках iPhone."
        }
    }
}
