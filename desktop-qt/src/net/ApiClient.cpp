#include "net/ApiClient.h"

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

void ApiClient::getMe()
{
    getJson("/api/me");
}

void ApiClient::getChats()
{
    getJson("/api/chats");
}

void ApiClient::getJson(const QString &endpoint)
{
    auto *reply = m_network.get(makeRequest(endpoint));
    connect(reply, &QNetworkReply::finished, this, [this, reply, endpoint]() {
        reply->deleteLater();

        const auto status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const auto bytes = reply->readAll();

        if (reply->error() != QNetworkReply::NoError || status >= 400) {
            emit requestFailed(endpoint, reply->errorString());
            return;
        }

        QJsonParseError parseError;
        const auto doc = QJsonDocument::fromJson(bytes, &parseError);
        if (parseError.error != QJsonParseError::NoError) {
            emit requestFailed(endpoint, parseError.errorString());
            return;
        }

        emit requestSucceeded(endpoint, doc);
    });
}

QNetworkRequest ApiClient::makeRequest(const QString &endpoint) const
{
    QUrl url = m_apiBaseUrl;
    url.setPath(endpoint);

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
