#pragma once

#include <QObject>
#include <QJsonDocument>
#include <QNetworkAccessManager>
#include <QUrl>

namespace aten {

class SessionStore;

class ApiClient final : public QObject {
    Q_OBJECT

public:
    explicit ApiClient(QUrl apiBaseUrl, SessionStore *sessionStore, QObject *parent = nullptr);

    QUrl apiBaseUrl() const;
    void getHealth();
    void getMe();
    void getChats();

signals:
    void requestSucceeded(QString endpoint, QJsonDocument body);
    void requestFailed(QString endpoint, QString message);

private:
    void getJson(const QString &endpoint);
    QNetworkRequest makeRequest(const QString &endpoint) const;

    QUrl m_apiBaseUrl;
    SessionStore *m_sessionStore;
    QNetworkAccessManager m_network;
};

} // namespace aten
