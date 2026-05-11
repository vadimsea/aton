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
    void login(const QString &login, const QString &password);
    void registerAccount(const QString &email, const QString &username, const QString &password);
    void logout();
    void getMe();
    void getChats();
    void getContacts();
    void getDialogs();
    void getMessagesAll();
    void getMessages(const QString &chatId);
    void updateProfile(const QString &displayName, const QString &bio, const QString &publicId);
    void sendTextMessage(const QString &chatId, const QString &text);

signals:
    void requestSucceeded(QString endpoint, QJsonDocument body);
    void requestFailed(QString endpoint, QString message);

private:
    void getJson(const QString &endpoint);
    void postJson(const QString &endpoint, const QJsonObject &payload);
    QNetworkRequest makeRequest(const QString &endpoint) const;
    void handleReply(QNetworkReply *reply, const QString &endpoint);

    QUrl m_apiBaseUrl;
    SessionStore *m_sessionStore;
    QNetworkAccessManager m_network;
};

} // namespace aten
