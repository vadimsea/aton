import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL = URL(string: "https://aton-api-2.onrender.com")!
    private let decoder: JSONDecoder
    private let encoder = JSONEncoder()

    init() {
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = ISO8601DateFormatter.aton.date(from: raw) { return date }
            if let date = ISO8601DateFormatter().date(from: raw) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date \(raw)")
        }
        encoder.dateEncodingStrategy = .iso8601
    }

    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        token: String? = nil,
        body: Encodable? = nil
    ) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        request.httpMethod = method
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try AnyEncodable(body).encode(with: encoder)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? decoder.decode(APIErrorMessage.self, from: data).error) ?? "Ошибка сервера"
            throw APIError.server(message, http.statusCode)
        }
        if T.self == EmptyResponse.self { return EmptyResponse() as! T }
        return try decoder.decode(T.self, from: data)
    }

    func linkPreview(for url: URL, token: String?) async throws -> AtonLinkPreview {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/link-preview"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "url", value: url.absoluteString)]
        guard let previewURL = components?.url else { throw APIError.invalidResponse }
        var request = URLRequest(url: previewURL)
        request.httpMethod = "GET"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? decoder.decode(APIErrorMessage.self, from: data).error) ?? "РћС€РёР±РєР° СЃРµСЂРІРµСЂР°"
            throw APIError.server(message, http.statusCode)
        }
        return try decoder.decode(AtonLinkPreview.self, from: data)
    }
}

struct EmptyResponse: Codable {}

struct APIErrorMessage: Codable {
    let error: String
}

enum APIError: LocalizedError {
    case invalidResponse
    case server(String, Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Нет ответа сервера"
        case .server(let message, _): return message
        }
    }
}

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ value: Encodable) {
        self.encodeClosure = value.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }

    func encode(with encoder: JSONEncoder) throws -> Data {
        try encoder.encode(self)
    }
}

extension ISO8601DateFormatter {
    static let aton: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
