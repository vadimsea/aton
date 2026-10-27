#include "net/ApiClient.h"

#include <QCryptographicHash>
#include <QDir>
#include <QFile>
#include <QJsonObject>
#include <QJsonParseError>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QStandardPaths>
#include <algorithm>
#include <utility>

#include "session/SessionStore.h"

namespace aten {

ApiClient::ApiClient(QUrl apiBaseUrl, SessionStore *sessionStore, QObject *parent)
    : QObject(parent),
      m_apiBaseUrl(std::move(apiBaseUrl)),
      m_sessionStore(sessionStore)
{
}

QUrl ApiClient::apiBaseUrl() const
{
    return m_apiBaseUrl;
}

void ApiClient::getHealth()
{
    getJson("/api/health");
}

void ApiClient::login(const QString &login, const QString &password)
{
    QJsonObject payload;
    const auto trimmed = login.trimmed();
    if (trimmed.contains("@")) {
        payload.insert("email", trimmed);
    } else {
        payload.insert("username", trimmed);
    }
    payload.insert("password", password);
    postJson("/api/login", payload);
}

void ApiClient::registerAccount(const QString &email, const QString &username, const QString &password)
{
    QJsonObject payload;
    payload.insert("email", email.trimmed());
    payload.insert("username", username.trimmed());
    payload.insert("password", password);
    postJson("/api/register", payload);
}

void ApiClient::logout()
{
    postJson("/api/logout", {});
}

void ApiClient::getMe()
{
    getJson("/api/me");
}

void ApiClient::getChats()
{
    getJson("/api/chats");
}

void ApiClient::getContacts()
{
    getJson("/api/contacts");
}

void ApiClient::getDialogs()
{
    getJson("/api/dialogs");
}

void ApiClient::getUsers()
{
    getJson("/api/users");
}

void ApiClient::getAdminUsers()
{
    getJson("/api/admin/users");
}

void ApiClient::getAdminChats()
{
    getJson("/api/admin/chats");
}

void ApiClient::getDiscoverChats()
{
    getJson("/api/chats/discover");
}

void ApiClient::getReports()
{
    getJson("/api/reports");
}

void ApiClient::getLinkPreview(const QString &url)
{
    getJson(QString("/api/link-preview?url=%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(url))));
}

void ApiClient::getMessagesAll()
{
    getJson("/api/messages/all");
}

void ApiClient::getMessages(const QString &chatId, int limit, const QString &before)
{
    const auto encoded = QString::fromUtf8(QUrl::toPercentEncoding(chatId));
    QString endpoint = QString("/api/messages?chatId=%1&limit=%2&lite=1").arg(encoded).arg(std::max(1, limit));
    if (!before.trimmed().isEmpty()) {
        endpoint += QString("&before=%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(before.trimmed())));
    }
    getJson(endpoint);
}

void ApiClient::sendTextMessage(const QString &chatId, const QString &text, const QString &replyTo)
{
    QJsonObject payload;
    payload.insert("chatId", chatId);
    payload.insert("type", "text");
    payload.insert("text", text);
    if (!replyTo.trimmed().isEmpty()) {
        payload.insert("replyTo", replyTo.trimmed());
    }
    postJson("/api/messages", payload);
}

void ApiClient::sendImageMessage(const QString &chatId, const QString &imageDataUrl, const QString &replyTo)
{
    QJsonObject payload;
    payload.insert("chatId", chatId);
    payload.insert("type", "image");
    payload.insert("imageDataUrl", imageDataUrl);
    if (!replyTo.trimmed().isEmpty()) {
        payload.insert("replyTo", replyTo.trimmed());
    }
    postJson("/api/messages", payload);
}

void ApiClient::sendAudioMessage(const QString &chatId, const QString &audioDataUrl, const QString &replyTo)
{
    QJsonObject payload;
    payload.insert("chatId", chatId);
    payload.insert("type", "audio");
    payload.insert("audioDataUrl", audioDataUrl);
    if (!replyTo.trimmed().isEmpty()) {
        payload.insert("replyTo", replyTo.trimmed());
    }
    postJson("/api/messages", payload);
}

void ApiClient::markMessagesRead(const QString &chatId)
{
    if (!m_sessionStore || !m_sessionStore->hasToken()) {
        return;
    }
    QJsonObject payload;
    payload.insert("chatId", chatId);
    payload.insert("lite", true);
    postJson("/api/messages/read", payload);
}

void ApiClient::resetSessionAuthState()
{
    m_sessionExpiredEmitted = false;
}

void ApiClient::updateProfile(const QString &displayName, const QString &bio, const QString &publicId, const QString &avatarDataUrl)
{
    QJsonObject payload;
    payload.insert("displayName", displayName.trimmed());
    payload.insert("bio", bio.trimmed());
    payload.insert("publicId", publicId.trimmed());
    payload.insert("avatarDataUrl", avatarDataUrl);
    postJson("/api/profile", payload);
}

void ApiClient::updatePeerAlias(const QString &peerUsername, const QString &alias)
{
    QJsonObject payload;
    payload.insert("peerUsername", peerUsername.trimmed());
    payload.insert("alias", alias.trimmed());
    putJson("/api/peer-alias", payload);
}

void ApiClient::contactAction(const QString &endpoint, const QString &username)
{
    QJsonObject payload;
    payload.insert("username", username.trimmed());
    postJson(endpoint, payload);
}

void ApiClient::reactToMessage(const QString &messageId, const QString &emoji)
{
    QJsonObject payload;
    payload.insert("emoji", emoji.trimmed());
    postJson(QString("/api/messages/%1/react").arg(QString::fromUtf8(QUrl::toPercentEncoding(messageId))), payload);
}

void ApiClient::updateMessageText(const QString &messageId, const QString &text)
{
    QJsonObject payload;
    payload.insert("text", text.trimmed());
    patchJson(QString("/api/messages/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(messageId))), payload);
}

void ApiClient::pinMessage(const QString &messageId)
{
    postJson(QString("/api/messages/%1/pin").arg(QString::fromUtf8(QUrl::toPercentEncoding(messageId))), {});
}

void ApiClient::deleteMessage(const QString &messageId)
{
    deleteJson(QString("/api/messages/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(messageId))));
}

void ApiClient::verifyUser(const QString &userId)
{
    postJson(QString("/api/users/%1/verify").arg(QString::fromUtf8(QUrl::toPercentEncoding(userId))), {});
}

void ApiClient::createChat(const QString &title, const QString &type, const QString &visibility, const QString &description)
{
    QJsonObject payload;
    payload.insert("title", title.trimmed());
    payload.insert("type", type.trimmed().isEmpty() ? "group" : type.trimmed());
    payload.insert("visibility", visibility == "private" ? "private" : "public");
    if (!description.trimmed().isEmpty()) {
        payload.insert("description", description.trimmed());
    }
    postJson("/api/chats", payload);
}

void ApiClient::joinChat(const QString &chatId)
{
    const auto encoded = QString::fromUtf8(QUrl::toPercentEncoding(chatId));
    postJson(QString("/api/chats/%1/join").arg(encoded), {});
}

void ApiClient::leaveChat(const QString &chatId)
{
    const auto encoded = QString::fromUtf8(QUrl::toPercentEncoding(chatId));
    postJson(QString("/api/chats/%1/leave").arg(encoded), {});
}

void ApiClient::deleteChat(const QString &chatId)
{
    deleteJson(QString("/api/chats/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(chatId))));
}

void ApiClient::verifyChat(const QString &chatId)
{
    postJson(QString("/api/chats/%1/verify").arg(QString::fromUtf8(QUrl::toPercentEncoding(chatId))), {});
}

void ApiClient::reportChat(const QString &chatId, const QString &reason)
{
    QJsonObject payload;
    payload.insert("reason", reason.trimmed());
    postJson(QString("/api/chats/%1/report").arg(QString::fromUtf8(QUrl::toPercentEncoding(chatId))), payload);
}

void ApiClient::reportUser(const QString &userIdOrUsername, const QString &reason)
{
    QJsonObject payload;
    payload.insert("reason", reason.trimmed());
    postJson(QString("/api/users/%1/report").arg(QString::fromUtf8(QUrl::toPercentEncoding(userIdOrUsername))), payload);
}

void ApiClient::reportMessage(const QString &messageId, const QString &reason)
{
    QJsonObject payload;
    payload.insert("reason", reason.trimmed());
    postJson(QString("/api/messages/%1/report").arg(QString::fromUtf8(QUrl::toPercentEncoding(messageId))), payload);
}

void ApiClient::resolveReport(const QString &reportId)
{
    postJson(QString("/api/reports/%1/resolve").arg(QString::fromUtf8(QUrl::toPercentEncoding(reportId))), {});
}

void ApiClient::rejectReport(const QString &reportId)
{
    postJson(QString("/api/reports/%1/reject").arg(QString::fromUtf8(QUrl::toPercentEncoding(reportId))), {});
}

void ApiClient::getJson(const QString &endpoint)
{
    if (m_pendingGets.contains(endpoint)) return;
    m_pendingGets.insert(endpoint);
    auto *reply = m_network.get(makeRequest(endpoint));
    connect(reply, &QNetworkReply::finished, this, [this, reply, endpoint]() {
        m_pendingGets.remove(endpoint);
        handleReply(reply, endpoint);
    });
}

void ApiClient::postJson(const QString &endpoint, const QJsonObject &payload)
{
    auto *reply = m_network.post(makeRequest(endpoint), QJsonDocument(payload).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply, endpoint]() { handleReply(reply, endpoint); });
}

void ApiClient::putJson(const QString &endpoint, const QJsonObject &payload)
{
    auto *reply = m_network.put(makeRequest(endpoint), QJsonDocument(payload).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply, endpoint]() { handleReply(reply, endpoint); });
}

void ApiClient::patchJson(const QString &endpoint, const QJsonObject &payload)
{
    auto *reply = m_network.sendCustomRequest(makeRequest(endpoint), "PATCH", QJsonDocument(payload).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply, endpoint]() { handleReply(reply, endpoint); });
}

void ApiClient::deleteJson(const QString &endpoint)
{
    auto *reply = m_network.deleteResource(makeRequest(endpoint));
    connect(reply, &QNetworkReply::finished, this, [this, reply, endpoint]() { handleReply(reply, endpoint); });
}

void ApiClient::handleReply(QNetworkReply *reply, const QString &endpoint)
{
    reply->deleteLater();

    const auto status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    const auto path = endpoint.split('?').constFirst();
    const auto bytes = reply->readAll();
    QJsonParseError parseError;
    const auto doc = QJsonDocument::fromJson(bytes, &parseError);

    if (reply->error() != QNetworkReply::NoError || status >= 400) {
        if (status == 401 && path != "/api/login" && path != "/api/register" && !m_sessionExpiredEmitted) {
            m_sessionExpiredEmitted = true;
            emit sessionExpired();
        }
        auto message = reply->errorString();
        if (parseError.error == QJsonParseError::NoError && doc.isObject()) {
            const auto apiError = doc.object().value("error").toString();
            if (!apiError.isEmpty()) {
                message = apiError;
            }
        }
        emit requestFailed(endpoint, message);
        return;
    }

    if (parseError.error != QJsonParseError::NoError) {
        emit requestFailed(endpoint, parseError.errorString());
        return;
    }

    emit requestSucceeded(endpoint, doc);
    if (path == "/api/login" || path == "/api/me") {
        m_sessionExpiredEmitted = false;
    }
}

QNetworkRequest ApiClient::makeRequest(const QString &endpoint) const
{
    QUrl url = m_apiBaseUrl;
    const auto marker = endpoint.indexOf("?");
    if (marker >= 0) {
        url.setPath(endpoint.left(marker));
        url.setQuery(endpoint.mid(marker + 1));
    } else {
        url.setPath(endpoint);
    }

    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    request.setRawHeader("Accept", "application/json");
    request.setTransferTimeout(endpoint.startsWith("/api/messages") ? 120000 : 45000);

    const auto token = m_sessionStore ? m_sessionStore->token() : QString();
    if (!token.isEmpty()) {
        request.setRawHeader("Authorization", QByteArray("Bearer ") + token.toUtf8());
    }

    return request;
}

void ApiClient::postTyping(const QString &chatId)
{
    if (!m_sessionStore || !m_sessionStore->hasToken() || chatId.isEmpty()) return;
    QJsonObject payload;
    payload.insert("chatId", chatId);
    postJson("/api/typing", payload);
}

void ApiClient::getChatLive(const QString &chatId)
{
    if (!m_sessionStore || !m_sessionStore->hasToken() || chatId.isEmpty()) return;
    getJson(QString("/api/chat-live?chatId=%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(chatId))));
}

void ApiClient::sendTextMessageTracked(const QString &clientId, const QString &chatId, const QString &text, const QString &replyTo)
{
    if (!m_sessionStore || !m_sessionStore->hasToken()) {
        emit textSendFinished(clientId, false, false, QStringLiteral("Нет активной сессии"), {});
        return;
    }
    QJsonObject payload;
    payload.insert("id", clientId);
    payload.insert("chatId", chatId);
    payload.insert("type", "text");
    payload.insert("text", text);
    if (!replyTo.trimmed().isEmpty()) {
        payload.insert("replyTo", replyTo.trimmed());
    }
    auto *reply = m_network.post(makeRequest("/api/messages"), QJsonDocument(payload).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply, clientId]() {
        reply->deleteLater();
        const auto status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const auto doc = QJsonDocument::fromJson(reply->readAll());
        if (reply->error() == QNetworkReply::NoError && status < 400 && doc.isObject()) {
            emit textSendFinished(clientId, true, false, {}, doc.object());
            return;
        }
        if (status == 401 && !m_sessionExpiredEmitted) {
            m_sessionExpiredEmitted = true;
            emit sessionExpired();
        }
        QString message = reply->errorString();
        if (doc.isObject()) {
            const auto apiError = doc.object().value("error").toString();
            if (!apiError.isEmpty()) message = apiError;
        }
        // Сеть/таймаут/5xx/429 — имеет смысл повторить; 4xx (слишком длинно, нет доступа) — нет.
        const bool retryable = status == 0 || status >= 500 || status == 429 || status == 408;
        emit textSendFinished(clientId, false, retryable, message, {});
    });
}

namespace {

QString mediaCacheDir()
{
    auto dir = QStandardPaths::writableLocation(QStandardPaths::CacheLocation);
    if (dir.isEmpty()) {
        dir = QDir::tempPath() + "/aten-desktop";
    }
    QDir().mkpath(dir);
    return dir;
}

QString mediaFileStem(const QString &messageId)
{
    const auto hash = QCryptographicHash::hash(messageId.toUtf8(), QCryptographicHash::Sha1).toHex();
    return QString("media-%1").arg(QString::fromLatin1(hash));
}

QString extensionForMime(const QString &mime)
{
    if (mime.contains("mpeg") || mime.contains("mp3")) return "mp3";
    if (mime.contains("wav")) return "wav";
    if (mime.contains("mp4")) return "m4a";
    if (mime.contains("ogg")) return "ogg";
    if (mime.contains("png")) return "png";
    if (mime.contains("jpeg") || mime.contains("jpg")) return "jpg";
    if (mime.contains("gif")) return "gif";
    if (mime.contains("webp")) return "webp";
    return "webm";
}

} // namespace

QString ApiClient::cachedMediaPath(const QString &messageId) const
{
    if (messageId.isEmpty()) return {};
    const QDir dir(mediaCacheDir());
    const auto files = dir.entryList({mediaFileStem(messageId) + ".*"}, QDir::Files);
    return files.isEmpty() ? QString() : dir.filePath(files.constFirst());
}

void ApiClient::fetchMessageMedia(const QString &messageId)
{
    if (messageId.isEmpty() || m_pendingMedia.contains(messageId) || m_failedMedia.contains(messageId)) return;
    if (!m_sessionStore || !m_sessionStore->hasToken()) return;
    if (!cachedMediaPath(messageId).isEmpty()) return;
    m_pendingMedia.insert(messageId);

    auto request = makeRequest(QString("/api/messages/%1/media").arg(QString::fromUtf8(QUrl::toPercentEncoding(messageId))));
    request.setRawHeader("Accept", "*/*");
    auto *reply = m_network.get(request);
    connect(reply, &QNetworkReply::finished, this, [this, reply, messageId]() {
        reply->deleteLater();
        m_pendingMedia.remove(messageId);
        const auto status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const auto bytes = reply->readAll();
        if (reply->error() != QNetworkReply::NoError || status >= 400 || bytes.isEmpty()) {
            m_failedMedia.insert(messageId);
            return;
        }
        const auto mime = reply->header(QNetworkRequest::ContentTypeHeader).toString().toLower();
        const auto path = QDir(mediaCacheDir()).filePath(mediaFileStem(messageId) + "." + extensionForMime(mime));
        QFile file(path);
        if (!file.open(QIODevice::WriteOnly)) {
            m_failedMedia.insert(messageId);
            return;
        }
        file.write(bytes);
        file.close();
        emit messageMediaReady(messageId);
    });
}

} // namespace aten
