#pragma once

#include <QObject>
#include <QSet>
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
    void getUsers();
    void getAdminUsers();
    void getAdminChats();
    void getDiscoverChats();
    void getReports();
    void getMessagesAll();
    void getMessages(const QString &chatId);
    void updateProfile(const QString &displayName, const QString &bio, const QString &publicId, const QString &avatarDataUrl);
    void updatePeerAlias(const QString &peerUsername, const QString &alias);
    void contactAction(const QString &endpoint, const QString &username);
    void reactToMessage(const QString &messageId, const QString &emoji);
    void updateMessageText(const QString &messageId, const QString &text);
    void pinMessage(const QString &messageId);
    void deleteMessage(const QString &messageId);
    void verifyUser(const QString &userId);
    void createChat(const QString &title, const QString &type, const QString &visibility, const QString &description);
    void joinChat(const QString &chatId);
    void leaveChat(const QString &chatId);
    void deleteChat(const QString &chatId);
    void verifyChat(const QString &chatId);
    void reportChat(const QString &chatId, const QString &reason);
    void reportUser(const QString &userIdOrUsername, const QString &reason);
    void reportMessage(const QString &messageId, const QString &reason);
    void resolveReport(const QString &reportId);
    void rejectReport(const QString &reportId);
    void sendTextMessage(const QString &chatId, const QString &text, const QString &replyTo = {});
    void sendImageMessage(const QString &chatId, const QString &imageDataUrl, const QString &replyTo = {});
    void sendAudioMessage(const QString &chatId, const QString &audioDataUrl, const QString &replyTo = {});
    void markMessagesRead(const QString &chatId);
    void resetSessionAuthState();

signals:
    void requestSucceeded(QString endpoint, QJsonDocument body);
    void requestFailed(QString endpoint, QString message);
    void sessionExpired();

private:
    void getJson(const QString &endpoint);
    void postJson(const QString &endpoint, const QJsonObject &payload);
    void putJson(const QString &endpoint, const QJsonObject &payload);
    void patchJson(const QString &endpoint, const QJsonObject &payload);
    void deleteJson(const QString &endpoint);
    QNetworkRequest makeRequest(const QString &endpoint) const;
    void handleReply(QNetworkReply *reply, const QString &endpoint);

    QUrl m_apiBaseUrl;
    SessionStore *m_sessionStore;
    QNetworkAccessManager m_network;
    QSet<QString> m_pendingGets;
    bool m_sessionExpiredEmitted = false;
};

} // namespace aten
