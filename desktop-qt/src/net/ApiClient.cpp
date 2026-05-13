#include "net/ApiClient.h"

#include <QJsonObject>
#include <QJsonParseError>
#include <QNetworkReply>
#include <QNetworkRequest>
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

void ApiClient::getMessagesAll()
{
    getJson("/api/messages/all");
}

void ApiClient::getMessages(const QString &chatId)
{
    const auto encoded = QString::fromUtf8(QUrl::toPercentEncoding(chatId));
    getJson(QString("/api/messages?chatId=%1").arg(encoded));
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

void ApiClient::updateProfile(const QString &displayName, const QString &bio, const QString &publicId)
{
    QJsonObject payload;
    payload.insert("displayName", displayName.trimmed());
    payload.insert("bio", bio.trimmed());
    payload.insert("publicId", publicId.trimmed());
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

void ApiClient::getJson(const QString &endpoint)
{
    auto *reply = m_network.get(makeRequest(endpoint));
    connect(reply, &QNetworkReply::finished, this, [this, reply, endpoint]() { handleReply(reply, endpoint); });
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

void ApiClient::handleReply(QNetworkReply *reply, const QString &endpoint)
{
    reply->deleteLater();

    const auto status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    const auto bytes = reply->readAll();
    QJsonParseError parseError;
    const auto doc = QJsonDocument::fromJson(bytes, &parseError);

    if (reply->error() != QNetworkReply::NoError || status >= 400) {
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

    const auto token = m_sessionStore ? m_sessionStore->token() : QString();
    if (!token.isEmpty()) {
        request.setRawHeader("Authorization", QByteArray("Bearer ") + token.toUtf8());
    }

    return request;
}

} // namespace aten
